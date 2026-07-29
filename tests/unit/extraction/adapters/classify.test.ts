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

  it("returns route_not_implemented for an image file", async () => {
    const file = new File(["dummy"], "resume.png", { type: "image/png" });
    const result = await classifyDocument(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ kind: "route_not_implemented", route: "image" });
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
