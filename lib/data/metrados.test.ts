import { describe, expect, test } from "vitest";

import {
  buildBudgetItemQuantityPatch,
  buildMetradoPartidaLinkCreateInput,
  parseMetradoInputs,
} from "@/lib/data/metrados";

describe("metrado data helpers", () => {
  test("parses JSON formula inputs into numeric input records", () => {
    expect(parseMetradoInputs({ largo: 2, ancho: "3", ignored: true })).toEqual({
      largo: 2,
      ancho: 3,
    });
  });

  test("builds the budget item quantity patch from the primary total", () => {
    expect(buildBudgetItemQuantityPatch(12.3456)).toEqual({
      quantity: 12.346,
    });
  });

  test("builds metrado partida link create input with required budget id", () => {
    expect(
      buildMetradoPartidaLinkCreateInput({
        sheetId: "sheet-1",
        budgetId: "budget-1",
        budgetItemId: "item-1",
      }),
    ).toEqual({
      sheetId: "sheet-1",
      budgetId: "budget-1",
      budgetItemId: "item-1",
    });
  });
});
