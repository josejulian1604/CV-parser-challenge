import { describe, expect, it } from "vitest";
import { normalizeContact } from "../../../../lib/extraction/normalize/contact";
import type { ContactInfo } from "../../../../lib/extraction/schema/resume";

function baseContact(overrides: Partial<ContactInfo> = {}): ContactInfo {
  return {
    fullName: "Jane Doe",
    email: null,
    phone: null,
    location: null,
    linkedin: null,
    github: null,
    website: null,
    ...overrides,
  };
}

describe("normalizeContact", () => {
  it("marks null email/phone as valid — absence isn't invalidity", () => {
    const result = normalizeContact(baseContact());
    expect(result.isEmailValid).toBe(true);
    expect(result.isPhoneValid).toBe(true);
  });

  it("accepts a well-formed email", () => {
    const result = normalizeContact(baseContact({ email: "jane@example.com" }));
    expect(result.isEmailValid).toBe(true);
    expect(result.email).toBe("jane@example.com");
  });

  it("flags an invalid email without dropping it", () => {
    const result = normalizeContact(baseContact({ email: "not-an-email" }));
    expect(result.isEmailValid).toBe(false);
    expect(result.email).toBe("not-an-email");
  });

  it("flags an email missing a TLD", () => {
    const result = normalizeContact(baseContact({ email: "jane@example" }));
    expect(result.isEmailValid).toBe(false);
  });

  it("accepts common international phone formats", () => {
    for (const phone of ["+1 555-123-4567", "(555) 123-4567", "+506 8899 2214", "5551234567"]) {
      const result = normalizeContact(baseContact({ phone }));
      expect(result.isPhoneValid, `expected "${phone}" to be valid`).toBe(true);
      expect(result.phone).toBe(phone);
    }
  });

  it("flags a too-short phone number without dropping it", () => {
    const result = normalizeContact(baseContact({ phone: "12345" }));
    expect(result.isPhoneValid).toBe(false);
    expect(result.phone).toBe("12345");
  });

  it("flags a phone number with letters", () => {
    const result = normalizeContact(baseContact({ phone: "call-me-maybe" }));
    expect(result.isPhoneValid).toBe(false);
  });

  it("does not reformat a valid phone number to a single style", () => {
    const messyButValid = "+1 (555) 123-4567";
    const result = normalizeContact(baseContact({ phone: messyButValid }));
    expect(result.phone).toBe(messyButValid);
  });
});
