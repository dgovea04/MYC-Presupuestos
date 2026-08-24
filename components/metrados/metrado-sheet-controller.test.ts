import { describe, expect, it } from "vitest";
import { getMetradoSheetContext, mergeMetradoSheet, selectSheetForPartida } from "@/components/metrados/metrado-sheet-controller";
import type { MetradoSheetRecord } from "@/types/metrado";

const base = (id: string): MetradoSheetRecord => ({
  id,
  userId: "user-1",
  projectId: "project-1",
  projectName: "Proyecto",
  budgetId: "budget-1",
  budgetName: "Presupuesto",
  templateId: "template-1",
  templateType: "CUSTOM",
  name: id,
  status: "DRAFT",
  isActive: true,
  unit: "m3",
  totalQuantity: 0,
  rows: [],
  partidaLink: {
    id: `link-${id}`,
    sheetId: id,
    budgetItemId: "item-1",
    budgetItemCode: "01",
    budgetItemDescription: "Partida",
    budgetItemUnit: "m3",
    lastSentQuantity: null,
  },
});

describe("metrado-sheet-controller", () => {
  it("builds the context of a linked sheet", () => {
    expect(getMetradoSheetContext(base("sheet-1"))).toEqual({ projectId: "project-1", budgetId: "budget-1", itemId: "item-1" });
  });

  it("selects the active sheet for a partida", () => {
    expect(selectSheetForPartida([base("sheet-1")], "item-1")?.id).toBe("sheet-1");
  });

  it("replaces an existing sheet without duplicates", () => {
    const result = mergeMetradoSheet([base("sheet-1"), base("sheet-2")], base("sheet-1"));
    expect(result.map((sheet) => sheet.id)).toEqual(["sheet-1", "sheet-2"]);
  });
});
