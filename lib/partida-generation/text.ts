const STOP_WORDS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "en",
  "para",
  "por",
  "con",
  "sin",
  "y",
  "a",
  "al",
  "kg",
  "cm2",
]);

export function normalizePartidaText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/f\s*'?\s*c\s*=?\s*(\d+)/g, "fc$1")
    .replace(/mezcla\s+(\d+)\s*:\s*(\d+)/g, "mezcla$1:$2")
    .replace(/[^a-z0-9:%/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUnit(value: string | null | undefined) {
  return normalizePartidaText(value ?? "").replace(/\s/g, "");
}

export function tokenizePartidaText(value: string) {
  return normalizePartidaText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function uniqueTokens(value: string) {
  return [...new Set(tokenizePartidaText(value))];
}

export function jaccardSimilarity(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size === 0 && rightSet.size === 0) return 1;
  if (leftSet.size === 0 || rightSet.size === 0) return 0;

  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}
