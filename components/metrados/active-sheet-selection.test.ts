import { describe, expect, it } from "vitest";
import { selectActiveSheetByPartidaId } from "@/components/metrados/active-sheet-selection";
import type { MetradoSheetRecord } from "@/types/metrado";

function sheet(id: string, updatedAt: string, isActive = true): MetradoSheetRecord {
  return {
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
    isActive,
    unit: "m3",
    totalQuantity: 1,
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
    updatedAt,
  };
}

describe("selectActiveSheetByPartidaId", () => {
  it("selects the most recently updated active sheet", () => {
    const selected = selectActiveSheetByPartidaId([
      sheet("older", "2026-01-01T00:00:00.000Z"),
      sheet("newer", "2026-02-01T00:00:00.000Z"),
      sheet("inactive", "2026-03-01T00:00:00.000Z", false),
    ]);

    expect(selected.get("item-1")?.id).toBe("newer");
  });
});
