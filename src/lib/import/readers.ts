import { extractTextTables, parseCsv, type RawTable } from "./parser";

export const ACCEPTED_EXT = ["txt", "md", "markdown", "csv", "xlsx", "pdf"] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIME_OK: Record<string, RegExp> = {
  txt: /^(text\/plain|)$/, md: /^(text\/markdown|text\/x-markdown|text\/plain|)$/, markdown: /^(text\/markdown|text\/plain|)$/,
  csv: /^(text\/csv|application\/vnd\.ms-excel|text\/plain|application\/csv|)$/,
  xlsx: /^(application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/octet-stream|)$/,
  pdf: /^(application\/pdf|)$/,
};

export const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();

export function validateFile(f: File): string | null {
  const ext = extOf(f.name);
  if (!(ACCEPTED_EXT as readonly string[]).includes(ext)) return "Formato não suportado. Use TXT, MD, CSV, XLSX ou PDF.";
  if (f.size > MAX_FILE_BYTES) return "Arquivo muito grande. O limite é 10 MB por importação.";
  if (f.size === 0) return "O arquivo está vazio.";
  if (!MIME_OK[ext]?.test(f.type)) return "O tipo do arquivo não corresponde à extensão. Verifique o arquivo.";
  return null;
}

export type ReadResult = { tables: RawTable[]; sheets?: string[] };
export class ReadError extends Error {}

export async function readText(text: string): Promise<ReadResult> {
  return { tables: extractTextTables(text) };
}

export async function readFile(f: File): Promise<ReadResult> {
  const ext = extOf(f.name);
  if (ext === "csv") return { tables: [parseCsv(await f.text())] };
  if (ext === "xlsx") return readXlsx(f);
  if (ext === "pdf") return readPdf(f);
  return readText(await f.text());
}

async function readXlsx(f: File): Promise<ReadResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellHTML: false, cellFormula: false });
  const tables: RawTable[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const ref = ws?.["!ref"];
    if (!ws || !ref) continue;
    const range = XLSX.utils.decode_range(ref);
    const grid: string[][] = [];
    for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 5000); r++) {
      const row: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        let v = cell ? String(cell.w ?? cell.v ?? "") : "";
        const link = cell?.l?.Target as string | undefined;
        if (link && /^https?:|^mailto:|^www\./i.test(link)) v = `[${v || link}](${link})`;
        row.push(v.trim());
      }
      grid.push(row);
    }
    const rows = grid.filter((r) => r.some(Boolean));
    if (rows.length < 2) continue;
    // header = first row with >= 2 filled cells
    const hi = rows.findIndex((r) => r.filter(Boolean).length >= 2);
    if (hi < 0) continue;
    tables.push({ headers: rows[hi]!, rows: rows.slice(hi + 1), title: name, sheet: name });
  }
  return { tables, sheets: tables.map((t) => t.sheet!) };
}

async function readPdf(f: File): Promise<ReadResult> {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
  } catch {
    throw new ReadError("Não foi possível ler este PDF. Utilize TXT, Markdown, CSV, XLSX ou cole o conteúdo.");
  }
  let text = "";
  for (let i = 1; i <= Math.min(doc.numPages, 200); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
      text += item.str ?? "";
      if (item.hasEOL) text += "\n";
    }
    text += "\n";
  }
  if (text.replace(/\s/g, "").length < 20) {
    throw new ReadError("Não foi possível extrair texto deste PDF. Utilize TXT, Markdown, CSV, XLSX ou cole o conteúdo.");
  }
  return { tables: extractTextTables(text) };
}
