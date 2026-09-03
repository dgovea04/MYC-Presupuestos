import { inflateRawSync, inflateSync } from "node:zlib";

export type DigitalPdfPage = { page: number; text: string; lines: string[] };
export type DigitalPdfExtraction = { pageCount: number; pages: DigitalPdfPage[] };

export async function extractDigitalPdf(input: ArrayBuffer | Uint8Array): Promise<DigitalPdfExtraction> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const source = new TextDecoder("latin1").decode(bytes);
  const pageCount = Math.max(1, (source.match(/\/Type\s*\/Page\b/g) ?? []).length);
  const streams = extractStreams(bytes).map((stream) => extractTextOperators(stream)).filter(Boolean);
  const pageTexts = streams.length >= pageCount ? streams.slice(-pageCount) : [extractLiteralStrings(source).join("\n")];
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const text = normalize(pageTexts[index] ?? "");
    return { page: index + 1, text, lines: text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) };
  });
  return { pageCount, pages };
}

function extractStreams(bytes: Uint8Array): string[] {
  const source = new TextDecoder("latin1").decode(bytes);
  const streams: string[] = [];
  let cursor = 0;
  while (true) {
    const streamIndex = source.indexOf("stream", cursor);
    if (streamIndex < 0) break;
    const endIndex = source.indexOf("endstream", streamIndex + 6);
    if (endIndex < 0) break;
    const dictionary = source.slice(Math.max(0, source.lastIndexOf("<<", streamIndex)), streamIndex);
    let start = streamIndex + 6;
    if (bytes[start] === 13 && bytes[start + 1] === 10) start += 2;
    else if (bytes[start] === 10 || bytes[start] === 13) start += 1;
    let finish = endIndex;
    while (finish > start && (bytes[finish - 1] === 10 || bytes[finish - 1] === 13)) finish -= 1;
    const raw = Buffer.from(bytes.slice(start, finish));
    if (/\/FlateDecode\b/.test(dictionary)) {
      try { streams.push(new TextDecoder("latin1").decode(inflateSync(raw))); }
      catch { try { streams.push(new TextDecoder("latin1").decode(inflateRawSync(raw))); } catch { /* ignore malformed stream */ } }
    } else streams.push(new TextDecoder("latin1").decode(raw));
    cursor = endIndex + 9;
  }
  return streams;
}

function extractTextOperators(stream: string): string {
  const values: string[] = [];
  for (const match of stream.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) values.push(decodeTextArray(match[1] ?? ""));
  for (const match of stream.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*T[jJ]/g)) values.push(unescapePdfString(match[1] ?? ""));
  if (values.length === 0) for (const match of stream.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)/g)) values.push(unescapePdfString(match[1] ?? ""));
  for (const match of stream.matchAll(/<([0-9a-f]{4,})>\s*T[jJ]/gi)) {
    values.push(decodeHexString(match[1] ?? ""));
  }
  return values.join(" ");
}

function decodeTextArray(value: string): string {
  let output = "";
  let insertSpace = false;
  const tokenPattern = /\(([^()]*(?:\\.[^()]*)*)\)|<([0-9a-f]+)>|(-?\d+(?:\.\d+)?)/gi;
  for (const token of value.matchAll(tokenPattern)) {
    const literal = token[1];
    const hex = token[2];
    if (literal !== undefined || hex !== undefined) {
      const decoded = literal !== undefined ? unescapePdfString(literal) : decodeHexString(hex ?? "");
      if (insertSpace && output.length > 0 && !/\s$/.test(output)) output += " ";
      output += decoded;
      insertSpace = false;
    } else if (Number(token[3] ?? 0) <= -100) {
      insertSpace = true;
    }
  }
  return output;
}

function decodeHexString(value: string): string {
  const hex = value.length % 2 === 0 ? value : `${value}0`;
  const bytes = Buffer.from(hex, "hex");
  const latin = new TextDecoder("latin1").decode(bytes);
  const printable = [...latin].filter((char) => char === "\n" || char === "\r" || (char >= " " && char <= "~")).length;
  if (printable / Math.max(1, latin.length) > 0.8) return latin;
  return new TextDecoder("utf-16be").decode(bytes).replace(/\u0000/g, "");
}

function extractLiteralStrings(source: string): string[] { return [...source.matchAll(/\(([^()\r\n]{3,})\)/g)].map((match) => unescapePdfString(match[1] ?? "")); }
function unescapePdfString(value: string): string { return value.replace(/\\([\\()])/g, "$1").replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t"); }
function normalize(value: string): string { return value.replace(/\s+/g, " ").trim(); }
