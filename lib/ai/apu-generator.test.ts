import { describe, expect, it } from "vitest";
import { generateCatalogBackedApuProposal } from "@/lib/ai/apu-generator";
import { AiRuntimeError } from "@/lib/ai/errors";
import type { AiEndpointResult } from "@/lib/ai/types";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

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

const partidas: CatalogPartidaRecord[] = [
  {
    id: "par-1",
    description: "Concreto f'c=210 kg/cm2 en columnas",
    unit: "m3",
    unitPrice: 280,
    currency: "PEN",
    performance: 12,
    apuRows: [
      {
        id: "row-1",
        catalogPartidaId: "par-1",
        resourceId: "res-cemento",
        description: "Cemento Portland Tipo I",
        unit: "bol",
        quantity: 7.5,
        unitPrice: 32,
        subtotal: 240,
        resourceType: "MATERIAL",
        sortOrder: 0,
      },
    ],
  },
];

describe("apu-generator", () => {
  it("uses catalog directly when a strong similar partida already has APU rows", async () => {
    const result = await generateCatalogBackedApuProposal({
      query: "Concreto f'c=210 kg/cm2 en columnas",
      unit: "m3",
      partidas,
      resources,
      generateAiResponseImpl: async () => {
        throw new Error("Ollama should not be called for strong catalog matches.");
      },
    });

    expect(result.proposal.items[0]?.resource_id).toBe("res-cemento");
    expect(result.similar_partidas[0]?.id).toBe("par-1");
    expect(result.similar_partidas[0]?.items[0]?.resource_id).toBe("res-cemento");
    expect(result.matching_resources[0]?.id).toBe("res-cemento");
    expect(result.model).toBe("catalog");
    expect(result.requestedModel).toBe("catalog");
    expect(result.confidence).toBe(1);
    expect(result.warnings).toContain("Propuesta generada directamente desde una partida similar del catalogo; requiere revision humana antes de guardarse.");
  });

  it("routes catalog-backed APU generation through the structured JSON model action", async () => {
    const aiResponse: AiEndpointResult = {
      answer: "Propuesta",
      model: "deepseek-coder",
      requestedModel: "deepseek-coder",
      fallbackUsed: false,
      warnings: [],
      structuredData: {
        partida_name: "Concreto f'c=210 kg/cm2 para columnas",
        unit: "m3",
        confidence: 0.88,
        items: [],
        suggested_new_resources: [],
        warnings: [],
        requires_human_review: true,
      },
    };

    await generateCatalogBackedApuProposal({
      query: "Partida generica con cemento",
      unit: "m3",
      partidas: [],
      resources,
      generateAiResponseImpl: async ({ action, messages }) => {
        expect(action).toBe("json");
        expect(messages.at(-1)?.content).toContain("matchingResources");
        expect(messages.at(-1)?.content).toContain("res-cemento");
        return aiResponse;
      },
    });
  });

  it("falls back to a catalog-based proposal when the model does not return structured JSON", async () => {
    const result = await generateCatalogBackedApuProposal({
      query: "Partida generica con cemento",
      unit: "m3",
      partidas,
      resources,
      generateAiResponseImpl: async () => ({
        answer: "No pude generar JSON valido",
        model: "mistral",
        requestedModel: "mistral",
        fallbackUsed: false,
        warnings: ["La IA no devolvio una estructura valida despues del reintento."],
        structuredData: undefined,
      }),
    });

    expect(result.proposal.items[0]).toMatchObject({
      resource_id: "res-cemento",
      name: "Cemento Portland Tipo I",
      unit: "bol",
      quantity: 7.5,
      requires_review: true,
    });
    expect(result.warnings).toContain("La IA no devolvio JSON APU valido; se genero una propuesta base desde catalogo para revision.");
    expect(result.confidence).toBe(0.55);
  });

  it("matches fallback APU rows by resource description when similar partidas do not store resource ids", async () => {
    const partidasWithoutLinkedResources: CatalogPartidaRecord[] = [
      {
        ...partidas[0],
        apuRows: [
          {
            id: "row-unlinked-cemento",
            catalogPartidaId: "par-1",
            resourceId: null,
            description: "Cemento Portland Tipo I",
            unit: "bol",
            quantity: 7.5,
            unitPrice: 32,
            subtotal: 240,
            resourceType: "MATERIAL",
            sortOrder: 0,
          },
        ],
      },
    ];

    const result = await generateCatalogBackedApuProposal({
      query: "Partida generica con cemento",
      unit: "m3",
      partidas: partidasWithoutLinkedResources,
      resources,
      generateAiResponseImpl: async () => ({
        answer: "No pude generar JSON valido",
        model: "deepseek-coder",
        requestedModel: "deepseek-coder",
        fallbackUsed: false,
        warnings: ["La IA no devolvio una estructura valida despues del reintento."],
        structuredData: undefined,
      }),
    });

    expect(result.proposal.items).toEqual([
      expect.objectContaining({
        resource_id: "res-cemento",
        name: "Cemento Portland Tipo I",
        type: "MATERIAL",
        unit: "bol",
        quantity: 7.5,
        requires_review: true,
      }),
    ]);
  });

  it("returns development debug data with context, raw AI answer, and fallback suggestions when requested", async () => {
    const result = await generateCatalogBackedApuProposal({
      query: "Partida generica con cemento",
      unit: "m3",
      partidas,
      resources,
      includeDebug: true,
      generateAiResponseImpl: async () => ({
        answer: "No pude generar JSON valido",
        model: "deepseek-coder",
        requestedModel: "deepseek-coder",
        fallbackUsed: false,
        warnings: ["La IA no devolvio una estructura valida despues del reintento."],
        structuredData: undefined,
        debug: {
          structuredParseStatus: "failed",
          rawAnswer: "texto libre inicial",
          repairedRawAnswer: "texto libre reparado",
        },
      }),
    });

    expect(result.debug?.context).toEqual(expect.objectContaining({ query: "Partida generica con cemento" }));
    expect(result.debug?.ai.rawAnswer).toBe("texto libre inicial");
    expect(result.debug?.ai.repairedRawAnswer).toBe("texto libre reparado");
    expect(result.debug?.fallback.used).toBe(true);
    expect(result.debug?.fallback.generatedItems[0]?.resource_id).toBe("res-cemento");
    expect(result.debug?.fallback.similarPartidaSuggestions[0]?.items[0]?.resource_id).toBe("res-cemento");
  });

  it("falls back to the catalog base when the model returns parseable JSON with placeholder resource ids", async () => {
    const result = await generateCatalogBackedApuProposal({
      query: "Partida generica con cemento",
      unit: "m3",
      partidas,
      resources,
      includeDebug: true,
      generateAiResponseImpl: async () => ({
        answer: "Ejemplo de Partida",
        model: "deepseek-coder-v2",
        requestedModel: "deepseek-coder-v2",
        fallbackUsed: false,
        warnings: [],
        structuredData: {
          partida_name: "Ejemplo de Partida",
          unit: "UND",
          confidence: 0.9,
          items: [
            {
              resource_id: "matchingResources[0].id",
              name: "Ejemplo de Material",
              type: "MATERIAL",
              unit: "KG",
              quantity: 10,
              source: "catalog",
              requires_review: false,
            },
          ],
          suggested_new_resources: [],
          warnings: [],
          requires_human_review: true,
        },
        debug: {
          structuredParseStatus: "parsed",
          rawAnswer: "{\"resource_id\":\"matchingResources[0].id\"}",
        },
      }),
    });

    expect(result.proposal.items[0]?.resource_id).toBe("res-cemento");
    expect(result.warnings).toContain("El recurso matchingResources[0].id no existe en el catalogo disponible.");
    expect(result.warnings).toContain("La propuesta IA no contenia resource_id validos; se uso fallback desde partida similar.");
    expect(result.debug?.fallback.used).toBe(true);
    expect(result.debug?.fallback.reason).toContain("sin ningun resource_id valido");
  });

  it("falls back to the top matching resource when no similar partida has APU rows", async () => {
    const result = await generateCatalogBackedApuProposal({
      query: "ALAMBRE FIERRO GALVANIZADO N°16",
      unit: "KG",
      partidas: [],
      resources: [
        {
          id: "res-alambre-16",
          code: "MAT-008",
          description: "ALAMBRE FIERRO GALVANIZADO N° 16",
          category: "MATERIAL",
          unit: "KG",
          unitPrice: 3.5,
          currency: "PEN",
        },
      ],
      generateAiResponseImpl: async () => ({
        answer: "respuesta malformada",
        model: "deepseek-coder",
        requestedModel: "deepseek-coder",
        fallbackUsed: false,
        warnings: ["La IA no devolvio una estructura valida despues del reintento."],
        structuredData: undefined,
      }),
    });

    expect(result.proposal.items).toEqual([
      expect.objectContaining({
        resource_id: "res-alambre-16",
        name: "ALAMBRE FIERRO GALVANIZADO N° 16",
        type: "MATERIAL",
        unit: "KG",
        quantity: 1,
        requires_review: true,
      }),
    ]);
    expect(result.proposal.unit).toBe("KG");
  });

  it("returns catalog fallback suggestions when Ollama times out", async () => {
    const result = await generateCatalogBackedApuProposal({
      query: "Partida generica con cemento",
      unit: "m3",
      partidas,
      resources,
      includeDebug: true,
      generateAiResponseImpl: async () => {
        throw new AiRuntimeError("timeout", "Ollama tardo mas de 90 segundos en responder.");
      },
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.model).toBe("catalog-fallback");
    expect(result.proposal.items[0]?.resource_id).toBe("res-cemento");
    expect(result.similar_partidas[0]?.id).toBe("par-1");
    expect(result.warnings).toContain("Ollama tardo mas de 90 segundos en responder.");
    expect(result.debug?.fallback.used).toBe(true);
    expect(result.debug?.fallback.reason).toContain("tiempo maximo");
  });
});
