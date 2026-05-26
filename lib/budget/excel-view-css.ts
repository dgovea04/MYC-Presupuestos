import type { CSSProperties } from "react";

type ExcelViewCssVariables = CSSProperties & Record<`--${string}`, string | number>;

export function getExcelViewCssVariables(
  excelShowFieldBorders: boolean,
  excelRowHeight: number,
): ExcelViewCssVariables {
  return {
    "--excel-field-border-color": excelShowFieldBorders ? "#cbd5e1" : "transparent",
    "--excel-row-height": `${excelRowHeight}px`,
  };
}
