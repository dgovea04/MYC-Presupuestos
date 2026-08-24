import type { MetradoSheetRecord } from "@/types/metrado";

export function selectActiveSheetByPartidaId(
  sheets: readonly MetradoSheetRecord[],
): ReadonlyMap<string, MetradoSheetRecord> {
  const selected = new Map<string, MetradoSheetRecord>();

  for (const sheet of sheets
    .filter((candidate) => candidate.isActive && candidate.partidaLink)
    .sort((left, right) => getTime(right.updatedAt) - getTime(left.updatedAt))) {
    const itemId = sheet.partidaLink?.budgetItemId;
    if (itemId && !selected.has(itemId)) selected.set(itemId, sheet);
  }

  return selected;
}

function getTime(value: string | Date | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}
