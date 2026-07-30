"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import html2canvas from "html2canvas";
import { useResumeData } from "../resume-data-context";
import { ResumePortfolio } from "@/components/result/resume-portfolio";
import { PartialTruncationNotice } from "@/components/error-states/partial-truncation-notice";

// Filesystem-unsafe characters only — keeps accented names (José, etc.)
// intact rather than over-sanitizing to ASCII.
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-");
}

// One requestAnimationFrame waits for the current frame to finish; a second
// guarantees at least one full paint has occurred after that. document.fonts
// .ready alone only signals that font *loading* is done — next/font's default
// "swap" behavior means a frame can still be pending with the fallback font
// rendered, and html2canvas would capture that instead of the real typeface.
function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export default function ResultPage() {
  const router = useRouter();
  const { resumeData, truncated, clear } = useResumeData();
  const captureRef = useRef<HTMLDivElement>(null);
  const [pngError, setPngError] = useState(false);
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

  // No print-media handling needed here (unlike handlePrint): html2canvas
  // captures the DOM's current computed styles, and globals.css's print
  // palette only ever activates inside an actual @media print context —
  // a plain click never enters that, so the screen palette is what gets
  // captured by construction, not by anything special done here.
  async function handleDownloadPng() {
    if (!captureRef.current) return;
    setPngError(false);

    try {
      // document.fonts.ready only signals font *loading* is done, not that
      // the swap-from-fallback repaint has happened yet (next/font defaults
      // to "swap") — waiting a couple of frames after closes that gap so
      // html2canvas doesn't capture the fallback font mid-swap.
      await document.fonts.ready;
      await waitForNextPaint();

      const canvas = await html2canvas(captureRef.current, {
        scale: 2,
        backgroundColor: null,
      });

      const dataUrl = canvas.toDataURL("image/png");
      const name = sanitizeFilename(resumeData?.contact.fullName?.trim() || "Resume");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${name} - Resume.png`;
      link.click();
    } catch {
      // html2canvas has a real failure surface (tainted-canvas security
      // errors, internal rendering faults) unlike window.print(), which
      // essentially never throws — silently doing nothing would leave the
      // user thinking the click had no effect at all.
      setPngError(true);
    }
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
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="bg-accent text-accent-ink rounded px-4 py-2"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            className="rounded border border-line px-4 py-2 text-ink"
          >
            Download PNG
          </button>
        </div>
        {pngError && (
          <p role="alert" className="mt-2 text-sm text-muted">
            Couldn&apos;t generate the PNG — please try again.
          </p>
        )}
      </div>

      {/* Same max-width as ResumePortfolio's own <article> so the captured
          region is a tight crop of just the card — no extra background
          margin from this wrapper being wider than the centered content. */}
      <div ref={captureRef} className="mx-auto max-w-[820px]">
        <ResumePortfolio data={resumeData} />
      </div>
    </main>
  );
}
