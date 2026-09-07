export function countPdfPages(bytes: Uint8Array): number {
  const source = new TextDecoder("latin1").decode(bytes);
  const pageTreeCounts = source
    .split("endobj")
    .filter((object) => /\/Type\s*\/Pages\b/.test(object))
    .flatMap((object) => [...object.matchAll(/\/Count\s+(\d+)/g)].map((match) => Number(match[1])))
    .filter((count) => Number.isInteger(count) && count > 0);

  if (pageTreeCounts.length > 0) {
    return Math.max(...pageTreeCounts);
  }

  const pageObjects = source.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  return Math.max(1, pageObjects);
}
