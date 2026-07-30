// Bilingual UI chrome (docs/Design-guidance.md §8). Selected once, at the
// top level, from the CV's own detectedLanguage — never re-checked inside
// leaf components. Every other visible string comes 1:1 from the extracted
// data; only these fixed labels are localized.
export interface UiContent {
  eyebrow: string;
  about: string;
  experience: string;
  education: string;
  skills: string;
  additional: string;
  present: string;
  endUnspecified: string;
  // Not part of §8's literal table — the fullName-absent placeholder
  // heading §3 calls for ("flag this case to whoever owns the copy").
  // Placeholder pending real copy review.
  nameUnavailable: string;
}

const CONTENT: Record<"en" | "es", UiContent> = {
  es: {
    eyebrow: "Hola, soy",
    about: "Sobre mí",
    experience: "Experiencia",
    education: "Educación",
    skills: "Skills",
    additional: "Más",
    present: "Presente",
    endUnspecified: "fin no especificado",
    nameUnavailable: "Nombre no disponible",
  },
  en: {
    eyebrow: "Hi, I'm",
    about: "About",
    experience: "Experience",
    education: "Education",
    skills: "Skills",
    additional: "More",
    present: "Present",
    endUnspecified: "end date not specified",
    nameUnavailable: "Name not available",
  },
};

export function getContent(lang: "en" | "es"): UiContent {
  return CONTENT[lang];
}
