"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { classifyDocument } from "@/lib/extraction/adapters/classify";
import { parseDocx } from "@/lib/extraction/adapters/docx";
import { parsePdf } from "@/lib/extraction/adapters/pdf";
import { renderScannedPdfToImages, compressImageFile } from "@/lib/extraction/adapters/image";
import { truncateToPageLimit } from "@/lib/extraction/limits";
import { MAX_PAGES } from "@/lib/config/limits";
import type { NormalizedResumeData } from "@/lib/extraction/schema/normalized";
import { useResumeData } from "./resume-data-context";
import { UnsupportedFileType } from "@/components/error-states/unsupported-file-type";
import { CorruptFile } from "@/components/error-states/corrupt-file";
import {
  ProviderUnavailable,
  type ProviderUnavailableKind,
} from "@/components/error-states/provider-unavailable";
import { RepairFailed } from "@/components/error-states/repair-failed";

type Status = "idle" | "loading" | "success" | "error";

type ErrorState =
  | { case: "unsupported-file-type" }
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
  return (
    // Fallback mirrors the page's own heading rather than null, so a
    // suspended render shows the page shell instead of a blank screen.
    <Suspense fallback={<h1 className="text-xl font-semibold mb-4 text-ink max-w-2xl mx-auto p-8">CV Parser</h1>}>
      <HomeContent />
    </Suspense>
  );
}

// useSearchParams (for the ?notice=no-result query param) requires a
// Suspense boundary around its caller, or Next.js bails the whole page out
// of static rendering at build time — split out so the boundary is scoped
// tightly rather than wrapping in an ad-hoc way at the call site.
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setResumeData, clear } = useResumeData();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorState, setErrorState] = useState<ErrorState | null>(null);

  const showNoResultNotice = searchParams.get("notice") === "no-result";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setStatus("idle");
    setErrorState(null);
    clear();
  }

  // Shared by both the text and vision paths — POSTs whichever body shape
  // /api/extract accepts, and applies the same success/error handling.
  async function submitExtraction(body: { text: string } | { images: unknown }, truncated: boolean) {
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const responseBody = await res.json();
        setErrorState(serverErrorState(responseBody.error));
        setStatus("error");
        return;
      }
      const data: NormalizedResumeData = await res.json();
      setStatus("success");
      setResumeData(data, truncated);
      router.push("/result");
    } catch {
      setErrorState({ case: "provider-unavailable", kind: "network_error" });
      setStatus("error");
    }
  }

  async function runExtraction(fileToProcess: File) {
    setStatus("loading");
    setErrorState(null);

    const classified = await classifyDocument(fileToProcess);
    if (!classified.ok) {
      if (classified.error.kind === "unrecognized_file_type") {
        setErrorState({ case: "unsupported-file-type" });
      } else {
        // pdf_load_failed, surfaced while classify itself loads the PDF to count pages.
        setErrorState({ case: "corrupt-file" });
      }
      setStatus("error");
      return;
    }

    const { route, file: classifiedFile } = classified.value;

    // pdf-scanned/image have no text layer to extract — they go through the
    // vision path instead (image.ts render/compress → /api/extract's
    // `images` body), same system-prompt rules, no grounding either way
    // (docs/architecture.md: "Known limitation: scanned CVs have no visual
    // highlight" — by design, not a gap this route fills).
    if (route === "pdf-scanned") {
      const rendered = await renderScannedPdfToImages(classifiedFile, MAX_PAGES);
      if (!rendered.ok) {
        setErrorState({ case: "corrupt-file" });
        setStatus("error");
        return;
      }
      await submitExtraction({ images: rendered.value }, false);
      return;
    }

    if (route === "image") {
      const compressed = await compressImageFile(classifiedFile);
      if (!compressed.ok) {
        setErrorState({ case: "corrupt-file" });
        setStatus("error");
        return;
      }
      await submitExtraction({ images: [compressed.value] }, false);
      return;
    }

    const parsed =
      route === "docx" ? await parseDocx(classifiedFile) : await parsePdf(classifiedFile);
    if (!parsed.ok) {
      setErrorState({ case: "corrupt-file" });
      setStatus("error");
      return;
    }

    const { text, truncated: wasTruncated } = truncateToPageLimit(parsed.value, MAX_PAGES);
    await submitExtraction({ text }, wasTruncated);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (file) runExtraction(file);
  }

  function retry() {
    if (file) runExtraction(file);
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-[820px] px-14 py-20 max-sm:px-6 max-sm:py-14">
        <h1 className="mb-10 font-head text-xl font-bold text-ink">CV Parser</h1>

        {showNoResultNotice && (
          <p role="status" className="mb-6 rounded border border-line p-3 text-sm text-muted">
            We couldn&apos;t find an active result — please upload again.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="rounded-lg border border-dashed border-line p-10 text-center">
            <input
              type="file"
              accept=".pdf,application/pdf,.docx,image/*"
              onChange={handleFileChange}
            />
            <p className="mt-3 font-body text-xs text-muted">
              PDF, Word, or a photo/scan — up to 3 pages
            </p>
          </div>

          <button
            type="submit"
            disabled={!file || status === "loading"}
            className="mt-6 bg-accent text-accent-ink rounded px-4 py-2 disabled:opacity-50"
          >
            {status === "loading" ? "Extracting…" : "Extract"}
          </button>
        </form>

        {status === "error" && errorState && (
          <div className="mt-8">
            <ErrorDisplay state={errorState} onRetry={retry} />
          </div>
        )}
      </div>
    </main>
  );
}

function ErrorDisplay({ state, onRetry }: { state: ErrorState; onRetry: () => void }) {
  switch (state.case) {
    case "unsupported-file-type":
      return <UnsupportedFileType />;
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
