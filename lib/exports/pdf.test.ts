import { describe, expect, it } from "vitest";

import { buildApprovalSecondaryLabel, buildDocumentSignatureSummary } from "@/lib/exports/document-signature";
import {
  buildApuPdfTableRowLayout,
  buildBudgetPdfTableRowLayout,
  buildResponsibleMetaLines,
  createApuPdf,
  createBudgetPdf,
  estimateApuPdfPartidaBlockHeight,
} from "@/lib/exports/pdf";
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
      { label: "Proyecto", value: "Colegio Central" },
      { label: "Cliente", value: "Municipalidad" },
      { label: "Ubicacion", value: "Lima" },
      { label: "Responsable", value: "Maria Calderon" },
      { label: "Cargo", value: "Ingeniera Residente" },
      { label: "Telefono", value: "987654321" },
      { label: "Empresa", value: "Constructora Andina SAC" },
    ]);
  });

  it("builds a professional approval label from project client metadata", () => {
    expect(buildApprovalSecondaryLabel({ clientName: "Municipalidad", location: "Lima", name: "Colegio Central" })).toBe(
      "Visto bueno documentario de Municipalidad",
    );
    expect(buildApprovalSecondaryLabel({ clientName: "", location: "Lima", name: "Colegio Central" })).toBe(
      "Pendiente de visto bueno del cliente o entidad",
    );
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

  it("keeps long budget PDF row cells aligned inside the printable width", () => {
    const cells = buildBudgetPdfTableRowLayout(
      {
        code: "01.01.001",
        description:
          "Suministro e instalacion de tuberia PVC SAP clase 10 con accesorios, prueba hidraulica, cama de apoyo y relleno compactado segun especificaciones tecnicas del expediente",
        unit: "m",
        quantity: "1234.56",
        unitPrice: "987.65",
        partial: "1219326.84",
        depth: 2,
      },
      36,
      140,
      523,
    );

    expect(new Set(cells.map((cell) => cell.y))).toEqual(new Set([140]));
    expect(Math.max(...cells.map((cell) => cell.x + cell.width))).toBeLessThanOrEqual(559);
    expect(cells[1]?.height).toBeGreaterThan(cells[0]?.height ?? 0);
  });

  it("keeps long APU PDF row cells aligned inside the printable width", () => {
    const cells = buildApuPdfTableRowLayout(
      {
        resource: "Mano de obra especializada para instalacion, alineamiento, pruebas hidraulicas y limpieza final del tramo con control de calidad",
        unit: "jor",
        crew: "1 cuadrilla",
        quantity: "12.3456",
        unitPrice: "150.25",
        subtotal: "1854.19",
      },
      36,
      210,
      523,
    );

    expect(new Set(cells.map((cell) => cell.y))).toEqual(new Set([210]));
    expect(Math.max(...cells.map((cell) => cell.x + cell.width))).toBeLessThanOrEqual(559);
    expect(cells[0]?.height).toBeGreaterThan(cells[1]?.height ?? 0);
  });

  it("generates an APU pdf buffer with resource rows", async () => {
    const pdfBuffer = await createApuPdf(
      {
        ...budgetFixture,
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
            apu: {
              id: "apu-1",
              budgetItemId: "item-1",
              notes: null,
              resources: [
                {
                  id: "resource-1",
                  apuId: "apu-1",
                  resourceId: "catalog-1",
                  quantity: 2,
                  crew: "1 cuadrilla" as unknown as number | null,
                  unitPrice: 75,
                  subtotal: 150,
                  resourceType: "MATERIAL",
                  resource: {
                    id: "catalog-1",
                    code: "MAT-001",
                    description: "Cemento portland tipo I con descripcion extendida para validar ajuste de tabla",
                    unit: "bolsa",
                    unitPrice: 75,
                    category: "MATERIAL",
                    source: null,
                    currency: "PEN",
                    companyId: null,
                    iu: null,
                    subcategory: null,
                  },
                },
              ],
            },
          },
        ],
      },
      { clientName: "Municipalidad", location: "Lima", name: "Colegio Central" },
      2,
      { companyName: "Constructora Andina SAC", name: "Maria Calderon" },
    );

    expect(pdfBuffer.byteLength).toBeGreaterThan(0);
  });

  it("estimates APU partida blocks with row content and separation space", () => {
    const shortBlock = estimateApuPdfPartidaBlockHeight({
      rows: [
        {
          crew: "1 cuadrilla",
          quantity: "1.00",
          resource: "Cemento",
          subtotal: "75.00",
          unit: "bolsa",
          unitPrice: "75.00",
        },
      ],
      subtitle: "Unidad: m2 | Precio unitario: 75.00",
      title: "01.01 - Trazo y replanteo",
    });
    const tallerBlock = estimateApuPdfPartidaBlockHeight({
      rows: [
        {
          crew: "1 cuadrilla",
          quantity: "1.00",
          resource:
            "Cemento portland tipo I con descripcion extendida para validar que la partida reserve suficiente espacio vertical antes de dibujarse",
          subtotal: "75.00",
          unit: "bolsa",
          unitPrice: "75.00",
        },
      ],
      subtitle: "Unidad: m2 | Precio unitario: 75.00",
      title: "01.01 - Trazo y replanteo",
    });

    expect(tallerBlock).toBeGreaterThan(shortBlock);
    expect(shortBlock).toBeGreaterThan(80);
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
