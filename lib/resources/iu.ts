export function normalizeResourceIuCode(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const numericMatch = normalized.match(/^0*(\d+)/);
  if (!numericMatch) {
    return null;
  }

  return numericMatch[1].padStart(2, "0");
}
