import type { ContactInfo, ResumeData } from "./resume";

// Stage 8 output — a distinct shape from ResumeData, same "two schemas, two
// moments" reasoning as GroundedResumeSchema (stage 6): isEmailValid/
// isPhoneValid are server-computed, never model output, so they must not
// live on ContactSchema itself or safeParse would require the model to
// produce them. A plain type, not a Zod schema, since nothing ever parses/
// validates this value — it's our own deterministic transform output, not
// untrusted input.
export interface NormalizedContact extends ContactInfo {
  isEmailValid: boolean;
  isPhoneValid: boolean;
}

export interface NormalizedResumeData extends Omit<ResumeData, "contact"> {
  contact: NormalizedContact;
}
