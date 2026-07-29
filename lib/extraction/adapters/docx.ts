import * as mammoth from "mammoth";
import type { Result } from "../result";
import type { Block, SourceDoc } from "./types";

export type DocxAdapterError =
  | { kind: "docx_load_failed"; cause: unknown }
  | { kind: "empty_document" };

// Mammoth's default style map already converts Word's built-in "Heading 1"
// .. "Heading 6" paragraph styles (and "Title") to <h1>..<h6> — verified
// against the real fixtures' styles.xml, so no custom styleMap is needed.
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const OPEN_TAG_PATTERN = /<(h[1-6]|p|li)(?:\s[^>]*)?>/gi;

// Mammoth's own writer only ever escapes &, <, > in text nodes (attribute
// escaping — &quot;/&#39; — never reaches here since attributes are consumed
// by OPEN_TAG_PATTERN before content starts). &amp; must decode last, or an
// entity like "&amp;lt;" would wrongly collapse all the way to "<".
function decodeEntities(html: string): string {
  return html.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// Mammoth nests multi-level bullet lists as literal <li><ul><li>...</li></ul></li>
// — a naive non-greedy regex closes on the FIRST </li> it finds, which belongs
// to the nested item, silently truncating/merging sibling bullets. Depth-aware
// scanning (counting same-tag opens/closes) finds the true matching close.
function findMatchingClose(html: string, tag: string, contentStart: number): number {
  const tagPattern = new RegExp(`<${tag}(?:\\s[^>]*)?>|</${tag}>`, "gi");
  tagPattern.lastIndex = contentStart;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    if (match[0].startsWith("</")) {
      depth--;
      if (depth === 0) return match.index;
    } else {
      depth++;
    }
  }
  return -1;
}

function blockTextFromHtml(inner: string): string {
  // A nested list's own <li>/<p>/<h1-6> boundaries are stripped below along
  // with every other tag — turn them into line breaks first (like <br>) so
  // sibling bullets merged into a parent block stay separated, not concatenated.
  const withBreaks = inner
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(h[1-6]|p|li)(?:\s[^>]*)?>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  return decodeEntities(stripped).trim();
}

export async function parseDocx(file: File): Promise<Result<SourceDoc, DocxAdapterError>> {
  let html: string;
  try {
    const arrayBuffer = await file.arrayBuffer();
    // mammoth's Node build (used by the vitest suite) only reads `buffer`;
    // its browser build (used at runtime, per architecture's client-side
    // parsing note — see pdf-worker.ts for the same window-check pattern)
    // swaps in a different unzip module that only reads `arrayBuffer`.
    const input =
      typeof window === "undefined"
        ? { buffer: Buffer.from(arrayBuffer) }
        : { arrayBuffer };
    const converted = await mammoth.convertToHtml(input);
    html = converted.value;
  } catch (cause) {
    return { ok: false, error: { kind: "docx_load_failed", cause } };
  }

  let text = "";
  const blocks: Block[] = [];

  let match: RegExpExecArray | null;
  while ((match = OPEN_TAG_PATTERN.exec(html))) {
    const tag = match[1].toLowerCase();
    const contentStart = OPEN_TAG_PATTERN.lastIndex;
    const closeIndex = findMatchingClose(html, tag, contentStart);
    if (closeIndex === -1) continue;

    const blockText = blockTextFromHtml(html.slice(contentStart, closeIndex));
    OPEN_TAG_PATTERN.lastIndex = closeIndex + `</${tag}>`.length;
    if (!blockText) continue;

    const start = text.length;
    text += blockText;
    const end = text.length;
    blocks.push({ start, end, page: 1, isHeading: HEADING_TAGS.has(tag) });
    text += "\n";
  }

  if (blocks.length === 0) {
    return { ok: false, error: { kind: "empty_document" } };
  }

  return { ok: true, value: { kind: "docx", text, blocks, pageCount: 1 } };
}
