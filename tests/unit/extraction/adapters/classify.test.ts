import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyDocument } from "../../../../lib/extraction/adapters/classify";

const FIXTURES_DIR = join(__dirname, "..", "..", "..", "fixtures", "pdf");

function loadFixture(name: string, type = "application/pdf"): File {
  const bytes = readFileSync(join(FIXTURES_DIR, name));
  return new File([bytes], name, { type });
}

describe("classifyDocument", () => {
  it.each(["sample-1.pdf", "sample-2.pdf", "sample-3.pdf"])(
    "classifies %s as pdf-with-text",
    async (name) => {
      const result = await classifyDocument(loadFixture(name));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.route).toBe("pdf-with-text");
      }
    }
  );

  it("routes a .docx file to the docx route", async () => {
    const file = new File(["dummy"], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const result = await classifyDocument(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.route).toBe("docx");
    }
  });

  it("routes an image file to the image route", async () => {
    const file = new File(["dummy"], "resume.png", { type: "image/png" });
    const result = await classifyDocument(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.route).toBe("image");
    }
  });

  it("routes a scanned (no-text-layer) PDF to the pdf-scanned route", async () => {
    const bytes = readFileSync(
      join(__dirname, "..", "..", "..", "fixtures", "pdf-scanned", "sample-1.pdfScanned.pdf")
    );
    const file = new File([bytes], "sample-1.pdfScanned.pdf", { type: "application/pdf" });
    const result = await classifyDocument(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.route).toBe("pdf-scanned");
    }
  });

  it("returns unrecognized_file_type for an unknown type", async () => {
    const file = new File(["dummy"], "resume.txt", { type: "text/plain" });
    const result = await classifyDocument(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("unrecognized_file_type");
    }
  });
});
