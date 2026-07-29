import type { ContactInfo } from "../schema/resume";
import type { NormalizedContact } from "../schema/normalized";

// Pragmatic, not RFC 5322 — good enough to catch what the LLM gets wrong
// (missing @, no TLD, stray whitespace) without chasing full email-spec edge
// cases no real resume needs.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Loose international check: an optional leading +, then 7-15 digits once
// separators are stripped. Deliberately not normalized to one style (E.164 or
// otherwise) — the task asks for validity, not reformatting.
const PHONE_ALLOWED_CHARS = /^\+?[0-9()\-.\s]+$/;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;

// Validity is checked against a trimmed copy, but the stored value in the
// returned NormalizedContact is always the original untrimmed string — this
// is the "no reformatting" design goal, not an oversight: stray whitespace
// doesn't make an otherwise-valid address invalid.
function isValidEmail(email: string | null): boolean {
  if (email === null) return true;
  return EMAIL_PATTERN.test(email.trim());
}

function isValidPhone(phone: string | null): boolean {
  if (phone === null) return true;
  const trimmed = phone.trim();
  if (!PHONE_ALLOWED_CHARS.test(trimmed)) return false;
  const digitCount = trimmed.replace(/\D/g, "").length;
  return digitCount >= MIN_PHONE_DIGITS && digitCount <= MAX_PHONE_DIGITS;
}

export function normalizeContact(contact: ContactInfo): NormalizedContact {
  return {
    ...contact,
    isEmailValid: isValidEmail(contact.email),
    isPhoneValid: isValidPhone(contact.phone),
  };
}
