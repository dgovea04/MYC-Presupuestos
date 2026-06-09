import { describe, expect, it } from "vitest";
import { buildAiRetrievalEvidence, formatEvidenceBlock } from "@/lib/ai/retrieval-context";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

const partidas: CatalogPartidaRecord[] = [
  {
    id: "par-concreto-columnas",
    description: "Concreto f'c=210 kg/cm2 en columnas",
    unit: "m3",
    unitPrice: 280,
    currency: "PEN",
    source: "S10_OBRA_MYC",
    performance: 12,
    apuRows: [
      {
        id: "row-cemento",
        catalogPartidaId: "par-concreto-columnas",
        resourceId: "res-cemento",
        description: "Cemento Portland Tipo I",
        unit: "bol",
        quantity: 7.5,
        unitPrice: 32,
        subtotal: 240,
        resourceType: "MATERIAL",
        sortOrder: 0,
      },
      {
        id: "row-arena",
        catalogPartidaId: "par-concreto-columnas",
        resourceId: "res-arena",
        description: "Arena gruesa",
        unit: "m3",
        quantity: 0.5,
        unitPrice: 80,
        subtotal: 40,
        resourceType: "MATERIAL",
        sortOrder: 1,
      },
    ],
  },
  {
    id: "par-tarrajeo",
    description: "Tarrajeo en muros interiores",
    unit: "m2",
    unitPrice: 45,
    currency: "PEN",
    source: "catalogo-propio",
    performance: 20,
    apuRows: [],
  },
];

const resources: ResourceRecord[] = [
  {
    id: "res-cemento",
    code: "MAT-001",
    description: "Cemento Portland Tipo I",
    category: "MATERIAL",
    unit: "bol",
    unitPrice: 32,
    currency: "PEN",
    source: "catalogo-propio",
    iu: "21",
    iuCurrent: "CEMENTO PORTLAND TIPO I",
  },
  {
    id: "res-operario",
    code: "MO-001",
    description: "Operario",
    category: "LABOR",
    unit: "hh",
    unitPrice: 25,
    currency: "PEN",
    source: "S10_OBRA_MYC",
  },
];

describe("retrieval-context", () => {
  it("maps similar catalog partidas into compact traceable evidence and classifies S10 sources", () => {
    const evidence = buildAiRetrievalEvidence({
      query: "concreto fc 210 columnas cemento",
      action: "apu",
      unit: "m3",
      catalogPartidas: partidas,
      resources,
      limit: 4,
    });

    const concreteEvidence = evidence.find((item) => item.id === "partida:par-concreto-columnas");
    const irrelevantPartida = evidence.find((item) => item.id === "partida:par-tarrajeo");
    expect(concreteEvidence).toMatchObject({
      sourceType: "s10_import",
      title: "Concreto f'c=210 kg/cm2 en columnas",
      metadata: expect.objectContaining({
        partidaId: "par-concreto-columnas",
        unit: "m3",
        source: "S10_OBRA_MYC",
      }),
    });
    expect(concreteEvidence?.excerpt).toContain("Unidad: m3");
    expect(concreteEvidence?.excerpt).toContain("Fuente: S10_OBRA_MYC");
    expect(concreteEvidence?.excerpt).toContain("APU: Cemento Portland Tipo I, Arena gruesa");
    expect(concreteEvidence?.score).toBeGreaterThan(0.6);
    expect(concreteEvidence?.score).toBeLessThanOrEqual(1);
    expect(String(concreteEvidence?.score)).toMatch(/^\d(?:\.\d{1,3})?$/);
    expect(irrelevantPartida).toBeUndefined();
  });

  it("maps catalog resources with category, unit, source, IU, and rounded score", () => {
    const evidence = buildAiRetrievalEvidence({
      query: "cemento portland concreto",
      action: "chat",
      catalogPartidas: partidas,
      resources,
      limit: 6,
    });

    const resourceEvidence = evidence.find((item) => item.id === "resource:res-cemento");
    expect(resourceEvidence).toMatchObject({
      sourceType: "catalog_resource",
      title: "Cemento Portland Tipo I",
      metadata: expect.objectContaining({
        resourceId: "res-cemento",
        category: "MATERIAL",
        unit: "bol",
        source: "catalogo-propio",
        iu: "21",
      }),
    });
    expect(resourceEvidence?.excerpt).toContain("Categoria: MATERIAL");
    expect(resourceEvidence?.excerpt).toContain("Unidad: bol");
    expect(resourceEvidence?.excerpt).toContain("IU: 21");
    expect(resourceEvidence?.score).toBeLessThanOrEqual(1);
    expect(String(resourceEvidence?.score)).toMatch(/^\d(?:\.\d{1,3})?$/);
  });

  it("retrieves curated technical document evidence without treating it as official law", () => {
    const evidence = buildAiRetrievalEvidence({
      query: "formula polinomica monomios incidencia menor 0.05",
      action: "review",
      limit: 4,
    });

    const technicalEvidence = evidence.find((item) => item.sourceType === "technical_doc");
    expect(technicalEvidence).toMatchObject({
      id: "technical:formula-polinomica-monomios",
      title: "Formula polinomica Peru - reglas de monomios",
      metadata: expect.objectContaining({
        sourcePath: "prd/formula-polinomica-peru-webapp-spec.md",
        referenceType: "internal_technical_reference",
      }),
    });
    expect(technicalEvidence?.excerpt).toContain("Referencia interna");
    expect(technicalEvidence?.excerpt.toLowerCase()).not.toContain("norma oficial");
  });

  it("formats evidence deterministically and returns an empty block when no evidence exists", () => {
    const evidence = buildAiRetrievalEvidence({
      query: "concreto fc 210 columnas cemento",
      action: "apu",
      unit: "m3",
      catalogPartidas: partidas,
      resources,
      limit: 3,
    });

    const block = formatEvidenceBlock(evidence);
    const repeatedBlock = formatEvidenceBlock(evidence);
    expect(repeatedBlock).toBe(block);
    expect(block).toContain("Fuentes consultadas:");
    expect(block).toContain("1. [s10_import] Concreto f'c=210 kg/cm2 en columnas");
    expect(block).toContain("score ");
    expect(block).toContain("[catalog_resource] Cemento Portland Tipo I");
    expect(block.split("\n").length).toBeLessThanOrEqual(10);
    expect(formatEvidenceBlock([])).toBe("");
  });
});
