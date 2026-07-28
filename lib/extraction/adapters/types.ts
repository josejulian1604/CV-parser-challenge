export interface Block {
  start: number;
  end: number;
  page: number;
  isHeading: boolean;
  bbox?: { x: number; y: number; w: number; h: number };
}

export interface SourceDoc {
  kind: "pdf" | "docx" | "image";
  text: string;
  blocks: Block[];
  pageCount: number;
  lang?: "en" | "es";
}
