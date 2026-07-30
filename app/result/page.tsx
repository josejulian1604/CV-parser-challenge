"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useResumeData } from "../resume-data-context";
import { ResumePortfolio } from "@/components/result/resume-portfolio";
import { PartialTruncationNotice } from "@/components/error-states/partial-truncation-notice";

export default function ResultPage() {
  const router = useRouter();
  const { resumeData, truncated, clear } = useResumeData();
  // router.push doesn't synchronously unmount this page — clear()'s state
  // update can commit while ResultPage is still mounted, which would
  // otherwise make the effect below fire and override an intentional
  // "Upload another" navigation with the no-result redirect. This flag
  // distinguishes "leaving on purpose" from "arrived with nothing."
  const isLeavingRef = useRef(false);

  // Reached directly (refresh, typed URL, some back-button cases) rather
  // than via a client-side navigation from "/" — the provider remounted
  // from scratch and resumeData is null. See resume-data-context.tsx for
  // why this is the correct signal rather than a special case to detect.
  useEffect(() => {
    if (!resumeData && !isLeavingRef.current) {
      router.replace("/?notice=no-result");
    }
  }, [resumeData, router]);

  if (!resumeData) {
    return (
      <main className="max-w-2xl mx-auto p-8">
        <p className="text-muted">Redirecting…</p>
      </main>
    );
  }

  function handlePrint() {
    document.title = `${resumeData?.contact.fullName ?? "Resume"} - Resume`;
    window.print();
  }

  function handleBack() {
    // Order matters: mark intent-to-leave BEFORE clear() runs, or the
    // no-result redirect effect above can fire first and hijack this
    // navigation to /?notice=no-result instead. Reuses the same clear()
    // already wired to app/page.tsx's handleFileChange, not a second
    // implementation of the same reset.
    isLeavingRef.current = true;
    clear();
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-line/30 print:bg-transparent">
      <div className="max-w-2xl mx-auto p-8 print:hidden">
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 block text-sm text-muted underline underline-offset-2 hover:text-ink"
        >
          ← Upload another
        </button>

        {truncated && <PartialTruncationNotice />}
        <button
          type="button"
          onClick={handlePrint}
          className="mt-2 bg-accent text-accent-ink rounded px-4 py-2"
        >
          Download PDF
        </button>
      </div>

      <ResumePortfolio data={resumeData} />
    </main>
  );
}
