"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { NormalizedResumeData } from "@/lib/extraction/schema/normalized";

interface ResumeDataContextValue {
  resumeData: NormalizedResumeData | null;
  truncated: boolean;
  setResumeData: (data: NormalizedResumeData, truncated: boolean) => void;
  clear: () => void;
}

const ResumeDataContext = createContext<ResumeDataContextValue | undefined>(undefined);

// In-memory only — no sessionStorage/localStorage/server persistence, per
// this project's zero-persistence stance (the source file never leaves the
// browser; the extracted result shouldn't outlive the tab either). A hard
// navigation (refresh, typed URL) remounts this provider from scratch,
// resetting resumeData to null — that reset is what app/result/page.tsx's
// redirect-if-empty check relies on, not a special case to detect separately.
export function ResumeDataProvider({ children }: { children: React.ReactNode }) {
  const [resumeData, setResumeDataState] = useState<NormalizedResumeData | null>(null);
  const [truncated, setTruncated] = useState(false);

  const setResumeData = useCallback((data: NormalizedResumeData, wasTruncated: boolean) => {
    setResumeDataState(data);
    setTruncated(wasTruncated);
  }, []);

  const clear = useCallback(() => {
    setResumeDataState(null);
    setTruncated(false);
  }, []);

  const value = useMemo(
    () => ({ resumeData, truncated, setResumeData, clear }),
    [resumeData, truncated, setResumeData, clear]
  );

  return <ResumeDataContext.Provider value={value}>{children}</ResumeDataContext.Provider>;
}

// Throws if called outside the provider — a real bug (the provider wraps
// the whole app), a different failure mode than resumeData legitimately
// being null (an expected, normal empty state callers must still handle).
// Currently unreachable: nothing in app/ renders outside RootLayout. Stays
// that way unless a future app/global-error.tsx is added — Next renders
// that file in place of the root layout entirely, so it would sit outside
// this provider and any useResumeData() call from within it would throw.
export function useResumeData(): ResumeDataContextValue {
  const context = useContext(ResumeDataContext);
  if (!context) {
    throw new Error("useResumeData must be used within a ResumeDataProvider");
  }
  return context;
}
