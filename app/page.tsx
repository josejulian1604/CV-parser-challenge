"use client";

import { useState } from "react";
import { classifyDocument } from "@/lib/extraction/adapters/classify";
import { parsePdf } from "@/lib/extraction/adapters/pdf";
import type { ResumeData } from "@/lib/extraction/schema/resume";

type Status = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setStatus("idle");
    setErrorMessage(null);
    setResumeData(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("loading");
    setErrorMessage(null);

    const classified = await classifyDocument(file);
    if (!classified.ok) {
      if (classified.error.kind === "route_not_implemented") {
        setErrorMessage(
          "This file type isn't supported yet — only text-based PDFs work right now."
        );
      } else {
        setErrorMessage("Extraction failed — please try a different file.");
      }
      setStatus("error");
      return;
    }

    if (classified.value.route !== "pdf-with-text") {
      // classifyDocument only returns ok:true for pdf-with-text today;
      // kept as a defensive guard, not currently reachable.
      setErrorMessage(
        "This file type isn't supported yet — only text-based PDFs work right now."
      );
      setStatus("error");
      return;
    }

    const parsed = await parsePdf(classified.value.file);
    if (!parsed.ok) {
      setErrorMessage("Extraction failed — please try a different file.");
      setStatus("error");
      return;
    }

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: parsed.value.text }),
      });
      if (!res.ok) {
        setErrorMessage("Extraction failed — please try a different file.");
        setStatus("error");
        return;
      }
      const data: ResumeData = await res.json();
      setResumeData(data);
      setStatus("success");
    } catch {
      setErrorMessage("Extraction failed — please try a different file.");
      setStatus("error");
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-xl font-semibold mb-4">CV Parser</h1>

      <form onSubmit={handleSubmit} className="flex items-center gap-3 mb-6">
        <input type="file" accept=".pdf,application/pdf" onChange={handleFileChange} />
        <button type="submit" disabled={!file || status === "loading"}>
          {status === "loading" ? "Extracting…" : "Extract"}
        </button>
      </form>

      {status === "error" && errorMessage && <p role="alert">{errorMessage}</p>}

      {status === "success" && resumeData && <ResumeResult data={resumeData} />}
    </main>
  );
}

function ResumeResult({ data }: { data: ResumeData }) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="font-semibold">Contact</h2>
        <dl>
          <div>
            <dt className="inline font-medium">Name: </dt>
            <dd className="inline">{data.contact.fullName ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Email: </dt>
            <dd className="inline">{data.contact.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Phone: </dt>
            <dd className="inline">{data.contact.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Location: </dt>
            <dd className="inline">{data.contact.location ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">LinkedIn: </dt>
            <dd className="inline">{data.contact.linkedin ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">GitHub: </dt>
            <dd className="inline">{data.contact.github ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Website: </dt>
            <dd className="inline">{data.contact.website ?? "—"}</dd>
          </div>
        </dl>
      </section>

      {data.summary && (
        <section>
          <h2 className="font-semibold">Summary</h2>
          <p>{data.summary}</p>
        </section>
      )}

      <section>
        <h2 className="font-semibold">Experience</h2>
        {data.experience.map((entry, i) => (
          <div key={i} className="mb-3">
            <p className="font-medium">
              {entry.title} — {entry.company}
            </p>
            <p className="text-sm">
              {entry.dateRange.start?.raw ?? "—"} to{" "}
              {entry.dateRange.isCurrent ? "Present" : entry.dateRange.end?.raw ?? "—"}
              {entry.location ? ` · ${entry.location}` : ""}
            </p>
            <ul className="list-disc list-inside">
              {entry.bullets.map((bullet, j) => (
                <li key={j}>{bullet}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-semibold">Education</h2>
        {data.education.map((entry, i) => (
          <div key={i} className="mb-3">
            <p className="font-medium">{entry.institution}</p>
            <p className="text-sm">
              {entry.degree ?? "—"}
              {entry.fieldOfStudy ? `, ${entry.fieldOfStudy}` : ""} ·{" "}
              {entry.dateRange.start?.raw ?? "—"} to{" "}
              {entry.dateRange.isCurrent ? "Present" : entry.dateRange.end?.raw ?? "—"}
            </p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-semibold">Skills</h2>
        <p>{data.skills.join(", ") || "—"}</p>
      </section>

      {data.additionalSections.map((section, i) => (
        <section key={i}>
          <h2 className="font-semibold">{section.title}</h2>
          <ul className="list-disc list-inside">
            {section.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-sm text-gray-500">Detected language: {data.detectedLanguage}</p>
    </div>
  );
}
