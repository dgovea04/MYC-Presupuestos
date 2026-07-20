export function parseSpreadsheetClipboard(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));
}

export function serializeSpreadsheetClipboard(rows: string[][]): string {
  return rows.map((row) => row.join("\t")).join("\n");
}
