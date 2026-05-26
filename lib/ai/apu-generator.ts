import { buildApuCatalogContext } from "@/lib/ai/apu-context-builder";
import { AiRuntimeError } from "@/lib/ai/errors";
import { tokenizeCatalogText } from "@/lib/ai/catalog-search";
import { validateApuCatalogProposal } from "@/lib/ai/apu-validator";
import { buildCatalogApuPrompt, buildCatalogApuSystemPrompt } from "@/lib/ai/prompts";
import { generateAiResponse } from "@/lib/ai/service";
import { aiApuCatalogProposalSchema } from "@/lib/ai/structured-output";
import type { AiApuCatalogGenerationResult, AiApuCatalogProposal, AiEndpointResult, AiMessage } from "@/lib/ai/types";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

type GenerateAiResponseLike = (input: {
  action: "json";
  messages: AiMessage[];
  schema: typeof aiApuCatalogProposalSchema;
  userId?: string;
}) => Promise<AiEndpointResult>;

type GenerateCatalogBackedApuProposalInput = {
  query: string;
  unit?: string;
  category?: string;
  projectType?: string;
  partidas: CatalogPartidaRecord[];
  resources: ResourceRecord[];
  includeDebug?: boolean;
  userId?: string;
  generateAiResponseImpl?: GenerateAiResponseLike;
};

const DIRECT_CATALOG_SIMILARITY_LIMIT = 0.95;

export async function generateCatalogBackedApuProposal({
  query,
  unit,
  category,
  projectType,
  partidas,
  resources,
  includeDebug = false,
  userId,
  generateAiResponseImpl = generateAiResponse,
}: GenerateCatalogBackedApuProposalInput): Promise<AiApuCatalogGenerationResult> {
  const context = buildApuCatalogContext({
    query,
    unit,
    category,
    projectType,
    partidas,
    resources,
  });
  const messages: AiMessage[] = [
    { role: "system", content: buildCatalogApuSystemPrompt() },
    { role: "user", content: buildCatalogApuPrompt(context) },
  ];
  const fallbackProposal = buildFallbackCatalogProposal({
    query,
    unit,
    context,
  });
  const similarPartidaSuggestions = context.similarPartidas.map((partida) => ({
    id: partida.id,
    description: partida.description,
    unit: partida.unit,
    similarity: partida.similarity,
    items: buildFallbackItemsFromRows(partida.apuRows, context),
  }));
  const catalogDirectProposal = buildDirectCatalogProposal({ fallbackProposal, context });

  if (catalogDirectProposal) {
    const validation = validateApuCatalogProposal({
      proposal: catalogDirectProposal,
      resources,
    });

    return {
      proposal: validation.proposal,
      similar_partidas: similarPartidaSuggestions,
      matching_resources: mapMatchingResources(context),
      warnings: validation.warnings,
      confidence: validation.proposal.confidence,
      validation: {
        isValid: validation.isValid,
        warnings: validation.warnings,
      },
      model: "catalog",
      requestedModel: "catalog",
      fallbackUsed: false,
      debug: includeDebug
        ? {
            enabled: true,
            context,
            messages,
            ai: {
              answer: "No se llamo a Ollama porque el catalogo tenia una partida similar fuerte con APU.",
              structuredParseStatus: "not_requested",
            },
            fallback: {
              used: false,
              reason: undefined,
              basePartidaId: catalogDirectProposal.based_on_partida_id,
              generatedItems: catalogDirectProposal.items,
              similarPartidaSuggestions,
            },
            validationWarnings: validation.warnings,
          }
        : undefined,
    };
  }

  let result: AiEndpointResult;

  try {
    result = await generateAiResponseImpl({
      action: "json",
      messages,
      schema: aiApuCatalogProposalSchema,
      userId,
    });
  } catch (error) {
    if (error instanceof AiRuntimeError && error.code === "timeout") {
      return buildFallbackGenerationResult({
        context,
        fallbackProposal: {
          ...fallbackProposal,
          warnings: [...fallbackProposal.warnings, error.message],
        },
        includeDebug,
        messages,
        resources,
        similarPartidaSuggestions,
        timeoutMessage: error.message,
      });
    }

    throw error;
  }
  const aiProposal = readCatalogProposal(result.structuredData);
  const initialValidation = validateApuCatalogProposal({
    proposal: aiProposal ?? fallbackProposal,
    resources,
  });
  const shouldFallbackFromInvalidAi =
    aiProposal !== null && initialValidation.proposal.items.length === 0 && fallbackProposal.items.length > 0;
  const validation = shouldFallbackFromInvalidAi
    ? validateApuCatalogProposal({
        proposal: {
          ...fallbackProposal,
          warnings: [
            ...fallbackProposal.warnings,
            ...initialValidation.warnings,
            "La propuesta IA no contenia resource_id validos; se uso fallback desde partida similar.",
          ],
        },
        resources,
      })
    : initialValidation;
  const usedFallback = aiProposal === null || shouldFallbackFromInvalidAi;

  return {
    proposal: validation.proposal,
    similar_partidas: similarPartidaSuggestions,
    matching_resources: mapMatchingResources(context),
    warnings: [...new Set([...result.warnings, ...validation.warnings])],
    confidence: validation.proposal.confidence,
    validation: {
      isValid: validation.isValid,
      warnings: validation.warnings,
    },
    model: result.model,
    requestedModel: result.requestedModel,
    fallbackUsed: result.fallbackUsed,
    latencyMs: result.latencyMs,
    debug: includeDebug
      ? {
          enabled: true,
          context,
          messages,
          ai: {
            answer: result.answer,
            structuredData: result.structuredData,
            rawAnswer: result.debug?.rawAnswer,
            repairedRawAnswer: result.debug?.repairedRawAnswer,
            structuredParseStatus: result.debug?.structuredParseStatus ?? "not_requested",
          },
          fallback: {
            used: usedFallback,
            reason: usedFallback
              ? shouldFallbackFromInvalidAi
                ? "La IA devolvio JSON parseable, pero sin ningun resource_id valido; se uso propuesta base desde catalogo."
                : "La IA no devolvio structuredData valido; se uso propuesta base desde catalogo."
              : undefined,
            basePartidaId: fallbackProposal.based_on_partida_id,
            generatedItems: fallbackProposal.items,
            similarPartidaSuggestions,
          },
          validationWarnings: validation.warnings,
        }
      : undefined,
  };
}

function buildFallbackGenerationResult({
  context,
  fallbackProposal,
  includeDebug,
  messages,
  resources,
  similarPartidaSuggestions,
  timeoutMessage,
}: {
  context: ReturnType<typeof buildApuCatalogContext>;
  fallbackProposal: AiApuCatalogProposal;
  includeDebug: boolean;
  messages: AiMessage[];
  resources: ResourceRecord[];
  similarPartidaSuggestions: AiApuCatalogGenerationResult["similar_partidas"];
  timeoutMessage: string;
}): AiApuCatalogGenerationResult {
  const validation = validateApuCatalogProposal({
    proposal: fallbackProposal,
    resources,
  });

  return {
    proposal: validation.proposal,
    similar_partidas: similarPartidaSuggestions,
    matching_resources: mapMatchingResources(context),
    warnings: [...new Set([timeoutMessage, ...validation.warnings])],
    confidence: validation.proposal.confidence,
    validation: {
      isValid: validation.isValid,
      warnings: validation.warnings,
    },
    model: "catalog-fallback",
    requestedModel: "json",
    fallbackUsed: true,
    debug: includeDebug
      ? {
          enabled: true,
          context,
          messages,
          ai: {
            answer: timeoutMessage,
            rawAnswer: timeoutMessage,
            structuredParseStatus: "failed",
          },
          fallback: {
            used: true,
            reason: "Ollama excedio el tiempo maximo; se uso propuesta base desde catalogo.",
            basePartidaId: fallbackProposal.based_on_partida_id,
            generatedItems: fallbackProposal.items,
            similarPartidaSuggestions,
          },
          validationWarnings: validation.warnings,
        }
      : undefined,
  };
}

function mapMatchingResources(context: ReturnType<typeof buildApuCatalogContext>): AiApuCatalogGenerationResult["matching_resources"] {
  return context.matchingResources.map((resource) => ({
    id: resource.id,
    code: resource.code,
    description: resource.name,
    unit: resource.unit,
    category: resource.category,
  }));
}

function readCatalogProposal(value: unknown): AiApuCatalogProposal | null {
  if (value === undefined) {
    return null;
  }

  return aiApuCatalogProposalSchema.parse(value);
}

function buildDirectCatalogProposal({
  fallbackProposal,
  context,
}: {
  fallbackProposal: AiApuCatalogProposal;
  context: ReturnType<typeof buildApuCatalogContext>;
}): AiApuCatalogProposal | null {
  const basePartida = context.similarPartidas[0];
  if (!basePartida || basePartida.similarity < DIRECT_CATALOG_SIMILARITY_LIMIT || fallbackProposal.items.length === 0) {
    return null;
  }

  return {
    ...fallbackProposal,
    confidence: Math.max(0.9, basePartida.similarity),
    warnings: ["Propuesta generada directamente desde una partida similar del catalogo; requiere revision humana antes de guardarse."],
    requires_human_review: true,
  };
}

function buildFallbackCatalogProposal({
  query,
  unit,
  context,
}: {
  query: string;
  unit?: string;
  context: ReturnType<typeof buildApuCatalogContext>;
}): AiApuCatalogProposal {
  const basePartida = context.similarPartidas[0];
  const items = buildFallbackItemsFromRows(basePartida?.apuRows ?? [], context);
  const fallbackItems = items.length > 0 ? items : buildFallbackItemsFromTopResource(context);

  return {
    partida_name: query,
    unit: unit ?? basePartida?.unit ?? context.matchingResources[0]?.unit ?? "und",
    based_on_partida_id: basePartida?.id,
    confidence: 0.55,
    items: fallbackItems,
    suggested_new_resources: [],
    warnings: ["La IA no devolvio JSON APU valido; se genero una propuesta base desde catalogo para revision."],
    requires_human_review: true,
  };
}

function buildFallbackItemsFromRows(
  rows: ReturnType<typeof buildApuCatalogContext>["similarPartidas"][number]["apuRows"],
  context: ReturnType<typeof buildApuCatalogContext>,
): AiApuCatalogProposal["items"] {
  const availableResourceIds = new Set(context.matchingResources.map((resource) => resource.id));

  return rows
    .map((row) => {
      const resource = findFallbackResourceForRow(row, context.matchingResources, availableResourceIds);
      if (!resource) return null;

      return {
        resource_id: resource.id,
        name: resource.name,
        type: resource.category,
        unit: resource.unit,
        quantity: row.quantity,
        source: "catalog" as const,
        requires_review: true,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function buildFallbackItemsFromTopResource(
  context: ReturnType<typeof buildApuCatalogContext>,
): AiApuCatalogProposal["items"] {
  const resource = context.matchingResources[0];
  if (!resource) return [];

  return [
    {
      resource_id: resource.id,
      name: resource.name,
      type: resource.category,
      unit: resource.unit,
      quantity: 1,
      source: "catalog",
      requires_review: true,
    },
  ];
}

function findFallbackResourceForRow(
  row: ReturnType<typeof buildApuCatalogContext>["similarPartidas"][number]["apuRows"][number],
  resources: ReturnType<typeof buildApuCatalogContext>["matchingResources"],
  availableResourceIds: Set<string>,
) {
  if (typeof row.resource_id === "string" && availableResourceIds.has(row.resource_id)) {
    return resources.find((resource) => resource.id === row.resource_id) ?? null;
  }

  const rowTokens = new Set(tokenizeCatalogText(row.description));
  const normalizedRowUnit = row.unit.trim().toLowerCase();

  return (
    resources
      .map((resource) => {
        const resourceTokens = new Set(tokenizeCatalogText(resource.name));
        const tokenMatches = [...rowTokens].filter((token) => resourceTokens.has(token)).length;
        const unitBoost = resource.unit.trim().toLowerCase() === normalizedRowUnit ? 2 : 0;

        return {
          resource,
          score: tokenMatches + unitBoost,
        };
      })
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)[0]?.resource ?? null
  );
}
