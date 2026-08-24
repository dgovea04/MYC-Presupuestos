/* @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMetradoSheetEditor } from "@/hooks/use-metrado-sheet-editor";
import type { MetradoFormulaRecord } from "@/types/metrado";

const formulas: MetradoFormulaRecord[] = [{
  id: "formula-1",
  templateId: "template-1",
  key: "manual",
  label: "Manual",
  expression: "manual",
  requiredInputs: ["manual"],
  resultUnit: "m3",
}];

describe("useMetradoSheetEditor", () => {
  it("calculates the current sheet and exposes validation issues", () => {
    const { result } = renderHook(() => useMetradoSheetEditor({
      rows: [],
      unit: "m3",
      formulas,
      linkedPartidaUnit: "m3",
    }));

    expect(result.current.calculation.primaryTotal).toBe(0);
    expect(result.current.hasBlockingIssues).toBe(true);
  });
});
