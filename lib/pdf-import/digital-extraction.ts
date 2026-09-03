import { inflateSync } from "node:zlib";

export type DigitalPdfPage = { page: number; text: string; lines: string[] };
export type DigitalPdfExtraction = { pageCount: number; pages: DigitalPdfPage[] };

export async function extractDigitalPdf(input: ArrayBuffer | Uint8Array): Promise<DigitalPdfExtraction> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const source = new TextDecoder("latin1").decode(bytes);
  const pageCount = Math.max(1, (source.match(/\/Type\s*\/Page\b/g) ?? []).length);
  const streams = extractStreams(source).map((stream) => extractTextOperators(stream)).filter(Boolean);
  const pageTexts = streams.length >= pageCount ? streams.slice(0, pageCount) : [extractLiteralStrings(source).join("\n")];
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const text = normalize(pageTexts[index] ?? "");
    return { page: index + 1, text, lines: text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) };
  });
  return { pageCount, pages };
}

function extractStreams(source: string): string[] {
  return [...source.matchAll(/(<<[\s\S]*?>>)\s*stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((match) => {
    const dictionary = match[1] ?? "";
    const raw = match[2] ?? "";
    if (!/\/FlateDecode\b/.test(dictionary)) return raw;
    try { return new TextDecoder("latin1").decode(inflateSync(Buffer.from(raw, "latin1"))); } catch { return ""; }
  });
}

function extractTextOperators(stream: string): string {
  const values: string[] = [];
  for (const match of stream.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*T[jJ]/g)) values.push(unescapePdfString(match[1] ?? ""));
  return values.join(" ");
}

function extractLiteralStrings(source: string): string[] { return [...source.matchAll(/\(([^()\r\n]{3,})\)/g)].map((match) => unescapePdfString(match[1] ?? "")); }
function unescapePdfString(value: string): string { return value.replace(/\\([\\()])/g, "$1").replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t"); }
function normalize(value: string): string { return value.replace(/\s+/g, " ").trim(); }
