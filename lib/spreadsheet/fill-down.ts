import { getCellKey, type SpreadsheetCellAddress } from "@/lib/spreadsheet/cell-address";

export type SpreadsheetCellValueMap = ReadonlyMap<string, string>;

export type SpreadsheetFillDownPatch = {
  cell: SpreadsheetCellAddress;
  value: string;
};

export function createFillDownPatches({
  source,
  targets,
  values,
}: {
  source: SpreadsheetCellAddress;
  targets: SpreadsheetCellAddress[];
  values: SpreadsheetCellValueMap;
}): SpreadsheetFillDownPatch[] {
  const sourceValue = values.get(getCellKey(source));
  if (typeof sourceValue === "undefined") {
    return [];
  }

  return targets
    .filter((target) => target.columnId === source.columnId)
    .filter((target) => target.rowId !== source.rowId)
    .map((target) => ({
      cell: target,
      value: sourceValue,
    }));
}
