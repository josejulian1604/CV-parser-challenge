import { describe, expect, it } from "vitest";
import {
  computeScaledDimensions,
  extractBase64FromDataUrl,
  checkTotalPayloadSize,
} from "../../../../lib/extraction/adapters/image";
import type { RenderedImage } from "../../../../lib/extraction/adapters/image";

// Only the deterministic, DOM-free logic is unit-tested here.
// renderScannedPdfToImages/compressImageFile need a real <canvas> — genuinely
// browser-only, and vitest.config.ts runs in plain Node with no canvas
// polyfill — verified manually/end-to-end instead, per this task's own
// "test the deterministic parts" scope.

describe("computeScaledDimensions", () => {
  it("leaves dimensions unchanged when already within the cap", () => {
    expect(computeScaledDimensions(800, 600, 1568)).toEqual({ width: 800, height: 600 });
  });

  it("is a no-op when the long edge exactly equals the cap", () => {
    expect(computeScaledDimensions(1568, 1000, 1568)).toEqual({ width: 1568, height: 1000 });
  });

  it("scales down proportionally when the long edge (width) exceeds the cap", () => {
    // 3136x2000 -> long edge halved to 1568, height scales by the same factor
    expect(computeScaledDimensions(3136, 2000, 1568)).toEqual({ width: 1568, height: 1000 });
  });

  it("scales down proportionally when the long edge (height) exceeds the cap", () => {
    expect(computeScaledDimensions(1000, 3136, 1568)).toEqual({ width: 500, height: 1568 });
  });

  it("handles a square image", () => {
    expect(computeScaledDimensions(2000, 2000, 1568)).toEqual({ width: 1568, height: 1568 });
  });
});

describe("extractBase64FromDataUrl", () => {
  it("strips the data: URI prefix", () => {
    expect(extractBase64FromDataUrl("data:image/jpeg;base64,ABC123")).toBe("ABC123");
  });

  it("returns the input unchanged if there's no comma (not a data URI)", () => {
    expect(extractBase64FromDataUrl("ABC123")).toBe("ABC123");
  });

  it("handles an empty base64 payload", () => {
    expect(extractBase64FromDataUrl("data:image/jpeg;base64,")).toBe("");
  });
});

function fakeImage(base64Length: number): RenderedImage {
  return { mediaType: "image/jpeg", data: "A".repeat(base64Length) };
}

describe("checkTotalPayloadSize", () => {
  it("passes for a small payload", () => {
    const result = checkTotalPayloadSize([fakeImage(1000)]);
    expect(result.ok).toBe(true);
  });

  it("passes for an empty image list", () => {
    const result = checkTotalPayloadSize([]);
    expect(result.ok).toBe(true);
  });

  it("sums multiple images and fails when the total exceeds the cap", () => {
    // ~4_000_000 bytes cap; base64 length ~4/3 of byte size, so push well over it.
    const large = fakeImage(4_000_000);
    const result = checkTotalPayloadSize([large, large]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("payload_too_large");
    }
  });

  it("is right at the boundary just under the cap", () => {
    // 4_000_000 base64 chars ~= 3_000_000 bytes, under the ~4_000_000 byte cap.
    const result = checkTotalPayloadSize([fakeImage(4_000_000)]);
    expect(result.ok).toBe(true);
  });

  it("passes when the total is exactly equal to the cap", () => {
    // base64 length 5_333_333 -> ceil(5_333_333 * 3 / 4) = 4_000_000 bytes,
    // exactly equal to MAX_TOTAL_PAYLOAD_BYTES — the boundary itself must
    // still pass (the check is strictly greater-than, not >=).
    const result = checkTotalPayloadSize([fakeImage(5_333_333)]);
    expect(result.ok).toBe(true);
  });

  it("fails when the total is exactly one byte over the cap", () => {
    // base64 length 5_333_334 -> ceil(5_333_334 * 3 / 4) = 4_000_001 bytes.
    const result = checkTotalPayloadSize([fakeImage(5_333_334)]);
    expect(result.ok).toBe(false);
  });
});
