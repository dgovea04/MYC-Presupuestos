import { describe, expect, it } from "vitest";
import { selectLatestActiveSheet } from "@/lib/metrados/active-sheet-selection";
import type { MetradoSheetRecord } from "@/types/metrado";

const makeSheet = (id: string, updatedAt: string, isActive: boolean): MetradoSheetRecord => ({
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
  partidaLink: { id: `link-${id}`, sheetId: id, budgetItemId: "item-1", budgetItemCode: "01", budgetItemDescription: "Partida", budgetItemUnit: "m3", lastSentQuantity: null },
  updatedAt,
});

describe("selectLatestActiveSheet", () => {
  it("returns the latest active sheet and ignores inactive sheets", () => {
    expect(selectLatestActiveSheet([
      makeSheet("old", "2026-01-01T00:00:00Z", true),
      makeSheet("new", "2026-02-01T00:00:00Z", true),
      makeSheet("inactive", "2026-03-01T00:00:00Z", false),
    ], "item-1")?.id).toBe("new");
  });
});
