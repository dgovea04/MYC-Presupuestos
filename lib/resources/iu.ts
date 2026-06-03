export function normalizeResourceIuCode(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const numericMatch = normalized.match(/^0*(\d+)/);
  if (!numericMatch) {
    return null;
  }

  if (Number(numericMatch[1]) === 0) {
    return null;
  }

  return numericMatch[1].padStart(2, "0");
}
