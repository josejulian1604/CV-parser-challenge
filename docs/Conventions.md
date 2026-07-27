# Conventions

## Error handling
No exceptions for expected failure paths inside `lib/extraction/**`.
Every function that can fail returns `Result<T, E>`:

    type Result<T, E> =
      | { ok: true; value: T }
      | { ok: false; error: E };

Each stage defines its own error union instead of throwing strings:

    type StructureError =
      | { kind: 'llm_unavailable'; cause: unknown }
      | { kind: 'schema_validation_failed'; issues: ZodIssue[] }
      | { kind: 'budget_exceeded' };

Exceptions are reserved for truly unexpected states (a programming
bug, not a business-logic failure like "email missing from CV").
`app/api/extract/route.ts` is the boundary: it's the only place
allowed to catch a stray exception and turn it into an HTTP error
response.

## Comments
Comment the *why*, never the *what*. The code already says what it
does if it's named well.

    // Bad
    // loop through experience entries
    for (const entry of experience) { ... }

    // Good
    // Normalized offsets don't match doc.text directly — map back to
    // the original string before storing bbox, or highlighting breaks.
    const originalOffset = mapToOriginal(normalizedOffset, offsetMap);

A comment justifies itself by answering "why would someone reading
this be confused otherwise?" If nothing needs justifying, no comment.

## Naming
- Functions & variables: camelCase — `extractContact`, `groundedResume`
- Types & components: PascalCase — `ResumeData`, `UploadDropzone`
- Files: kebab-case — `offset-mapping.ts`, `upload-dropzone.tsx`
- One exported concept per file where practical; the filename should
  say what the file exports.
- Booleans read as a question: `isCurrent`, `hasScannedSource`.

## Function size
A function does one stage's worth of work. If you're scrolling to
read one function, it's doing too much — this maps directly onto the
pipeline: one function per numbered stage, composed in `pipeline.ts`.

## Testing
Every module in `lib/extraction/**` has a matching file in
`tests/unit/`, mirroring the path. A stage isn't "done" until its
test file exists — this is a gate, not a follow-up task. See
`testing.md` for the full testing strategy.