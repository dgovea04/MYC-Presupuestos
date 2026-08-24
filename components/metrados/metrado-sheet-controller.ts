import type { MetradoSheetRecord } from "@/types/metrado";

export type MetradoSheetContext = {
  projectId: string;
  budgetId: string;
  itemId: string;
};

export function getMetradoSheetContext(sheet: MetradoSheetRecord): MetradoSheetContext | null {
  const itemId = sheet.partidaLink?.budgetItemId;
  if (!itemId) return null;
  return { projectId: sheet.projectId, budgetId: sheet.budgetId, itemId };
}

export function mergeMetradoSheet(
  sheets: readonly MetradoSheetRecord[],
  nextSheet: MetradoSheetRecord,
): MetradoSheetRecord[] {
  return [nextSheet, ...sheets.filter((sheet) => sheet.id !== nextSheet.id)];
}

export function selectSheetForPartida(
  sheets: readonly MetradoSheetRecord[],
  itemId: string,
): MetradoSheetRecord | null {
  return sheets
    .filter((sheet) => sheet.isActive && sheet.partidaLink?.budgetItemId === itemId)
    .sort((left, right) => getTime(right.updatedAt) - getTime(left.updatedAt))[0] ?? null;
}

function getTime(value: string | Date | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}
