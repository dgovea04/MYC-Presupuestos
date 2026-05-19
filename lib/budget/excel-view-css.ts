import type { CSSProperties } from "react";

export function getExcelViewCssVariables(excelShowFieldBorders: boolean, excelRowHeight: number): CSSProperties {
  return {
    "--excel-field-border-color": excelShowFieldBorders ? "#cbd5e1" : "transparent",
    "--excel-row-height": `${excelRowHeight}px`,
  };
}
