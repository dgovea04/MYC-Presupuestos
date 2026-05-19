import { describe, expect, it } from "vitest";
import { getExcelViewCssVariables } from "@/lib/budget/excel-view-css";

describe("getExcelViewCssVariables", () => {
  it("returns excel css variables using the active settings", () => {
    expect(getExcelViewCssVariables(false, 40)).toEqual({
      "--excel-field-border-color": "transparent",
      "--excel-row-height": "40px",
    });

    expect(getExcelViewCssVariables(true, 60)).toEqual({
      "--excel-field-border-color": "#cbd5e1",
      "--excel-row-height": "60px",
    });
  });
});
