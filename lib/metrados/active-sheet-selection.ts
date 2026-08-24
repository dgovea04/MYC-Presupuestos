import type { MetradoSheetRecord } from "@/types/metrado";

export function selectLatestActiveSheet(
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
