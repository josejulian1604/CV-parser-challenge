"use client";

import { useState } from "react";
import { classifyDocument } from "@/lib/extraction/adapters/classify";
import { parseDocx } from "@/lib/extraction/adapters/docx";
import { parsePdf } from "@/lib/extraction/adapters/pdf";
import { truncateToPageLimit } from "@/lib/extraction/limits";
import { MAX_PAGES } from "@/lib/config/limits";
import type { NormalizedResumeData } from "@/lib/extraction/schema/normalized";
import { UnsupportedFileType } from "@/components/error-states/unsupported-file-type";
import { NotYetSupported } from "@/components/error-states/not-yet-supported";
import { CorruptFile } from "@/components/error-states/corrupt-file";
import {
  ProviderUnavailable,
  type ProviderUnavailableKind,
} from "@/components/error-states/provider-unavailable";
import { RepairFailed } from "@/components/error-states/repair-failed";
import { PartialTruncationNotice } from "@/components/error-states/partial-truncation-notice";
import { ResumePortfolio } from "@/components/result/resume-portfolio";

type Status = "idle" | "loading" | "success" | "error";

type ErrorState =
  | { case: "unsupported-file-type" }
  | { case: "not-yet-supported"; route: "pdf-scanned" | "image" }
  | { case: "corrupt-file" }
  | { case: "provider-unavailable"; kind: ProviderUnavailableKind; retryAfterMs?: number | null }
  | { case: "repair-failed" };

// The two ProviderError-shaped kinds that route here regardless of which
// stage produced them: StructureError IS ProviderError, and RepairError's
// repair_call_failed wraps a ProviderError as its cause — same failure mode.
const PROVIDER_ERROR_KINDS = new Set<string>([
  "auth_failed",
  "rate_limited",
  "provider_unavailable",
  "network_error",
  "refused",
  "malformed_response",
]);

function serverErrorState(error: { kind: string; retryAfterMs?: number | null }): ErrorState {
  if (error.kind === "repair_call_failed") {
    return { case: "provider-unavailable", kind: "repair_call_failed" };
  }
  if (error.kind === "validation_failed") {
    return { case: "repair-failed" };
  }
  if (PROVIDER_ERROR_KINDS.has(error.kind)) {
    return {
      case: "provider-unavailable",
      kind: error.kind as ProviderUnavailableKind,
      retryAfterMs: error.retryAfterMs,
    };
  }
  // Unrecognized server error shape — defensive fallback, not currently
  // reachable given the two error unions runServerPipeline can return.
  return { case: "provider-unavailable", kind: "provider_unavailable" };
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [resumeData, setResumeData] = useState<NormalizedResumeData | null>(null);
  const [truncated, setTruncated] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setStatus("idle");
    setErrorState(null);
    setResumeData(null);
    setTruncated(false);
  }

  async function runExtraction(fileToProcess: File) {
    setStatus("loading");
    setErrorState(null);
    setTruncated(false);

    const classified = await classifyDocument(fileToProcess);
    if (!classified.ok) {
      if (classified.error.kind === "unrecognized_file_type") {
        setErrorState({ case: "unsupported-file-type" });
      } else if (classified.error.kind === "route_not_implemented") {
        setErrorState({ case: "not-yet-supported", route: classified.error.route });
      } else {
        // pdf_load_failed, surfaced while classify itself loads the PDF to count pages.
        setErrorState({ case: "corrupt-file" });
      }
      setStatus("error");
      return;
    }

    const { route, file: classifiedFile } = classified.value;
    const parsed =
      route === "docx" ? await parseDocx(classifiedFile) : await parsePdf(classifiedFile);
    if (!parsed.ok) {
      setErrorState({ case: "corrupt-file" });
      setStatus("error");
      return;
    }

    const { text, truncated: wasTruncated } = truncateToPageLimit(parsed.value, MAX_PAGES);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = await res.json();
        setErrorState(serverErrorState(body.error));
        setStatus("error");
        return;
      }
      const data: NormalizedResumeData = await res.json();
      setResumeData(data);
      setTruncated(wasTruncated);
      setStatus("success");
    } catch {
      setErrorState({ case: "provider-unavailable", kind: "network_error" });
      setStatus("error");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (file) runExtraction(file);
  }

  function retry() {
    if (file) runExtraction(file);
  }

  function handlePrint() {
    document.title = `${resumeData?.contact.fullName ?? "Resume"} - Resume`;
    window.print();
  }

  return (
    <main className="min-h-screen bg-line/30 print:bg-transparent">
      <div className="max-w-2xl mx-auto p-8 print:hidden">
        <h1 className="text-xl font-semibold mb-4 text-ink">CV Parser</h1>

        <form onSubmit={handleSubmit} className="flex items-center gap-3 mb-6">
          <input type="file" accept=".pdf,application/pdf,.docx" onChange={handleFileChange} />
          <button
            type="submit"
            disabled={!file || status === "loading"}
            className="bg-accent text-accent-ink rounded px-4 py-2 disabled:opacity-50"
          >
            {status === "loading" ? "Extracting…" : "Extract"}
          </button>
        </form>

        {status === "error" && errorState && <ErrorDisplay state={errorState} onRetry={retry} />}

        {status === "success" && resumeData && (
          <div>
            {truncated && <PartialTruncationNotice />}
            <button
              type="button"
              onClick={handlePrint}
              className="mt-2 bg-accent text-accent-ink rounded px-4 py-2"
            >
              Download PDF
            </button>
          </div>
        )}
      </div>

      {status === "success" && resumeData && <ResumePortfolio data={resumeData} />}
    </main>
  );
}

function ErrorDisplay({ state, onRetry }: { state: ErrorState; onRetry: () => void }) {
  switch (state.case) {
    case "unsupported-file-type":
      return <UnsupportedFileType />;
    case "not-yet-supported":
      return <NotYetSupported route={state.route} />;
    case "corrupt-file":
      return <CorruptFile />;
    case "provider-unavailable":
      return (
        <ProviderUnavailable kind={state.kind} retryAfterMs={state.retryAfterMs} onRetry={onRetry} />
      );
    case "repair-failed":
      return <RepairFailed onRetry={onRetry} />;
  }
}
