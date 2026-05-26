import type { CSSProperties } from "react";

type ExcelViewCssVariables = CSSProperties & {
  "--excel-field-border-color": string;
  "--excel-row-height": string;
};

export function getExcelViewCssVariables(excelShowFieldBorders: boolean, excelRowHeight: number): ExcelViewCssVariables {
  return {
    "--excel-field-border-color": excelShowFieldBorders ? "#cbd5e1" : "transparent",
    "--excel-row-height": `${excelRowHeight}px`,
  };
}
