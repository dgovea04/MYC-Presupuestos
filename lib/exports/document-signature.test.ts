import { describe, expect, it } from "vitest";
import { buildBudgetCoverSummary, buildDocumentSignatureSummary } from "@/lib/exports/document-signature";

describe("document signature summary", () => {
  it("builds the shared documentary signature data with sensible fallbacks", () => {
    expect(
      buildDocumentSignatureSummary("Presupuesto General", {
        clientName: "Municipalidad",
        location: "Lima",
        name: "Colegio Central",
      }, {
        companyName: "Constructora Andina SAC",
        name: "Maria Calderon",
        jobTitle: "Ingeniera Residente",
        phone: "987654321",
      }),
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

  it("builds the budget cover summary for the optional first pdf page", () => {
    expect(
      buildBudgetCoverSummary(
        "Presupuesto General",
        "PEN",
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
      title: "PRESUPUESTO DE OBRA",
      budgetName: "Presupuesto General",
      companyName: "Constructora Andina SAC",
      projectName: "Colegio Central",
      metadata: [
        ["Cliente", "Municipalidad"],
        ["Ubicacion", "Lima"],
        ["Moneda", "PEN"],
        ["Responsable", "Maria Calderon"],
      ],
      signatureTitle: "Responsable tecnico",
      signaturePrimary: "Maria Calderon",
      signatureSecondary: "Ingeniera Residente",
    });
  });
});
