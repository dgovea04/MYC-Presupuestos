import { describe, expect, it } from "vitest";

import { buildDocumentSignatureSummary } from "@/lib/exports/document-signature";
import { buildResponsibleMetaLines, createBudgetPdf } from "@/lib/exports/pdf";
import type { BudgetRecord } from "@/types/budget";

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
  items: [],
};

describe("report pdf exports", () => {
  it("builds responsible technical lines for budget pdf metadata", async () => {
    expect(
      buildResponsibleMetaLines(
        {
          clientName: "Municipalidad",
          location: "Lima",
          name: "Colegio Central",
        },
        {
          companyName: "Constructora Andina SAC",
          name: "Maria Calderon",
          jobTitle: "Ingeniera Residente",
          phone: "987654321",
        },
      ),
    ).toEqual([
      "Proyecto: Colegio Central",
      "Cliente: Municipalidad",
      "Ubicacion: Lima",
      "Responsable: Maria Calderon",
      "Cargo: Ingeniera Residente",
      "Telefono: 987654321",
      "Empresa: Constructora Andina SAC",
    ]);
  });

  it("still generates a pdf buffer when responsible metadata is provided", async () => {
    const pdfBuffer = await createBudgetPdf(
      budgetFixture,
      { clientName: "Municipalidad", location: "Lima", name: "Colegio Central" },
      2,
      {
        companyName: "Constructora Andina SAC",
        name: "Maria Calderon",
        jobTitle: "Ingeniera Residente",
        phone: "987654321",
      },
    );

    expect(pdfBuffer.byteLength).toBeGreaterThan(0);
  });

  it("builds the documentary signature summary used by the pdf footer block", () => {
    expect(
      buildDocumentSignatureSummary(
        "Presupuesto General",
        {
          clientName: "Municipalidad",
          location: "Lima",
          name: "Colegio Central",
        },
        {
          companyName: "Constructora Andina SAC",
          name: "Maria Calderon",
          jobTitle: "Ingeniera Residente",
          phone: "987654321",
        },
      ),
    ).toEqual({
      approverLabel: "Municipalidad",
      document: [
        ["Presupuesto", "Presupuesto General"],
        ["Proyecto", "Colegio Central"],
        ["Cliente", "Municipalidad"],
        ["Ubicacion", "Lima"],
      ],
      responsible: [
        ["Responsable", "Maria Calderon"],
        ["Cargo", "Ingeniera Residente"],
        ["Empresa", "Constructora Andina SAC"],
        ["Telefono", "987654321"],
      ],
      responsibleRole: "Ingeniera Residente",
      responsibleSigner: "Maria Calderon",
    });
  });
});
