import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import type { BudgetRecord } from "@/types/budget";

vi.mock("@/lib/exports/report-assets", () => ({
  loadReportIdentityAssets: vi.fn(async () => ({
    avatar: {
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      ),
      extension: "png",
    },
    companyLogo: {
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      ),
      extension: "png",
    },
  })),
}));

import { createBudgetWorkbook } from "@/lib/exports/excel";

const budgetFixture: BudgetRecord = {
  id: "budget-1",
  projectId: "project-1",
  kind: "GENERAL",
  name: "Presupuesto General",
  currency: "PEN",
  igvRate: 0.18,
  generalExpensesRate: 0.1,
  utilityRate: 0.08,
  totalDirectCost: 1500,
  totalGeneralExpenses: 150,
  totalUtility: 120,
  totalTax: 318.6,
  totalAmount: 2088.6,
  levels: [],
  items: [
    {
      id: "item-1",
      budgetId: "budget-1",
      code: "01.01",
      description: "Trazo y replanteo",
      unit: "m2",
      quantity: 10,
      unitPrice: 150,
      partial: 1500,
      sortOrder: 1,
      apu: null,
    },
  ],
};

describe("report excel image exports", () => {
  it("embeds identity images without using the ExcelJS Anchor constructor", async () => {
    const workbookBuffer = await createBudgetWorkbook(
      budgetFixture,
      { clientName: "Municipalidad", location: "Lima", name: "Colegio Central" },
      2,
      {
        avatarUrl: "/uploads/avatars/user-1.png",
        companyLogoUrl: "/uploads/logos/company-1.png",
        companyName: "Constructora Andina SAC",
        jobTitle: "Ingeniera Residente",
        name: "Maria Calderon",
        phone: "987654321",
      },
    );
    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(workbookBuffer);

    expect(workbook.getWorksheet("Presupuesto")?.getImages().length).toBeGreaterThan(0);
  });
});
