import { describe, expect, it } from "vitest";
import { buildApuResourcesFromCatalogProposal, buildApuRowsFromCatalogProposal, selectCatalogProposalBasePartida } from "@/lib/ai/apu-suggestion";
import type { AiApuCatalogGenerationResult, AiApuCatalogProposal } from "@/lib/ai/types";
import type { ResourceRecord } from "@/types/resource";

const proposal: AiApuCatalogProposal = {
  partida_name: "Concreto f'c=210 kg/cm2 para columnas",
  unit: "m3",
  confidence: 0.9,
  items: [
    {
      resource_id: "res-cemento",
      name: "Cemento Portland Tipo I",
      type: "MATERIAL",
      unit: "bol",
      quantity: 7.5,
      source: "catalog",
      requires_review: false,
    },
  ],
  suggested_new_resources: [
    {
      type: "suggested_new_resource",
      reason: "No existe aditivo equivalente",
      based_on: "Aditivo plastificante",
    },
  ],
  warnings: [],
  requires_human_review: true,
};

const resources: ResourceRecord[] = [
  {
    id: "res-cemento",
    code: "MAT-001",
    description: "Cemento Portland Tipo I",
    category: "MATERIAL",
    unit: "bol",
    unitPrice: 32,
    currency: "PEN",
  },
];

describe("catalog-backed APU suggestion mapping", () => {
  it("builds catalog partida rows with existing resource ids and prices", () => {
    const rows = buildApuRowsFromCatalogProposal({
      proposal,
      catalogPartidaId: "par-new",
      resources,
      existingRowsCount: 0,
      createId: (index) => `row-${index}`,
    });

    expect(rows).toEqual([
      {
        id: "row-0",
        catalogPartidaId: "par-new",
        resourceId: "res-cemento",
        description: "Cemento Portland Tipo I",
        unit: "bol",
        crew: undefined,
        quantity: 7.5,
        unitPrice: 32,
        subtotal: 240,
        resourceType: "MATERIAL",
        groupLabel: undefined,
        sortOrder: 0,
      },
    ]);
  });

  it("builds budget APU resources without creating synthetic catalog resources", () => {
    const rows = buildApuResourcesFromCatalogProposal({
      proposal,
      apuId: "apu-1",
      resources,
      createId: (index) => `apu-row-${index}`,
    });

    expect(rows[0]?.resourceId).toBe("res-cemento");
    expect(rows[0]?.resource.id).toBe("res-cemento");
    expect(rows[0]?.unitPrice).toBe(32);
    expect(rows[0]?.subtotal).toBe(240);
  });

  it("replaces the editable catalog proposal when a similar partida is selected", () => {
    const selectedItem = {
      resource_id: "res-cemento",
      name: "Cemento Portland Tipo I",
      type: "MATERIAL" as const,
      unit: "bol",
      quantity: 8,
      source: "catalog" as const,
      requires_review: true,
    };
    const result: AiApuCatalogGenerationResult = {
      proposal,
      similar_partidas: [
        {
          id: "par-2",
          description: "Concreto f'c=210 en losa",
          unit: "m3",
          similarity: 0.62,
          items: [selectedItem],
        },
      ],
      matching_resources: [],
      warnings: [],
      confidence: 0.9,
      validation: { isValid: true, warnings: [] },
      model: "deepseek-coder",
      requestedModel: "deepseek-coder",
      fallbackUsed: false,
    };

    const nextResult = selectCatalogProposalBasePartida({ result, partidaId: "par-2" });

    expect(nextResult.proposal.based_on_partida_id).toBe("par-2");
    expect(nextResult.proposal.items).toEqual([selectedItem]);
    expect(nextResult.confidence).toBe(0.62);
  });
});
