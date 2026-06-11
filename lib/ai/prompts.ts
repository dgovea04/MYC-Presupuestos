import { buildContextBlock } from "@/lib/ai/context-builder";
import { formatEvidenceBlock, type AiEvidence } from "@/lib/ai/retrieval-context";
import { buildAiTaskPayload, type AiTaskPayload } from "@/lib/ai/task-payloads";
import type { AiContext, AiMessage } from "@/lib/ai/types";

export const MYC_AI_SYSTEM_PROMPT = [
  "Eres un asistente experto en presupuestos de construccion, analisis de precios unitarios, costos, metrados, formula polinomica, ingenieria civil y construccion en Peru.",
  "Responde de forma tecnica, clara, estructurada y profesional.",
  "No ejecutes SQL, no propongas borrar informacion y no modifiques presupuestos automaticamente.",
  "Cuando entregues sugerencias de costos o APU, indica supuestos y pide validacion tecnica antes de aplicar cambios.",
].join(" ");

export function buildTaskPayloadSystemPrompt({ jsonOnly }: { jsonOnly: boolean }) {
  return [
    "Eres un asistente tecnico experto en presupuestos de construccion en Peru, APU, metrados, costos, rendimientos y formula polinomica.",
    "Debes ejecutar la tarea indicada en INPUT JSON.",
    "Reglas obligatorias:",
    jsonOnly ? "- Responde unicamente con JSON valido." : "- Responde de forma tecnica, clara, estructurada y profesional.",
    "- No uses markdown cuando el output.format sea json_only.",
    "- No agregues explicacion antes ni despues cuando el output.format sea json_only.",
    "- No uses bloques de codigo.",
    "- No modifiques presupuestos automaticamente.",
    "- No inventes precios exactos.",
    "- Si falta informacion, declara supuestos o datos requeridos.",
    "- Toda recomendacion debe quedar para revision humana.",
  ].join("\n");
}

export function buildPromptFromTaskPayload(payload: AiTaskPayload) {
  return ["INPUT JSON:", JSON.stringify(payload, null, 2)].join("\n");
}

const APU_OUTPUT_JSON_SHAPE = {
  answer: "resumen corto",
  unit: "...",
  performance: "...",
  crew: "...",
  materials: [{ description: "...", unit: "...", quantity: "...", notes: "..." }],
  labor: [{ description: "...", unit: "...", quantity: "..." }],
  equipment: [{ description: "...", unit: "...", quantity: "..." }],
  observations: ["..."],
  assumptions: ["..."],
};

const REVIEW_OUTPUT_JSON_SHAPE = {
  answer: "resumen corto",
  findings: [
    {
      severity: "low|medium|high",
      type: "duplicate|unit|cost|quantity|consistency|other",
      description: "...",
      impact: "...",
      recommendedAction: "...",
    },
  ],
  assumptions: ["..."],
};

function buildOutputJsonShapeBlock(shape: object) {
  return ["OUTPUT JSON SHAPE:", JSON.stringify(shape, null, 2)].join("\n");
}

function buildEvidenceSystemMessage(evidence: AiEvidence[]): string {
  const evidenceBlock = formatEvidenceBlock(evidence);
  if (!evidenceBlock) return "";

  return ["Usa estas fuentes como contexto de apoyo. Si una respuesta requiere validacion normativa u oficial, indicalo.", evidenceBlock].join("\n");
}

export function buildChatMessages({
  message,
  context,
  evidence = [],
}: {
  message: string;
  context?: AiContext;
  evidence?: AiEvidence[];
}): AiMessage[] {
  const contextBlock = buildContextBlock(context);
  const evidenceBlock = buildEvidenceSystemMessage(evidence);

  return [
    { role: "system", content: MYC_AI_SYSTEM_PROMPT },
    ...(contextBlock ? [{ role: "system" as const, content: contextBlock }] : []),
    ...(evidenceBlock ? [{ role: "system" as const, content: evidenceBlock }] : []),
    { role: "user", content: message },
  ];
}

export function buildApuPrompt(description: string, unit?: string) {
  const taskPrompt = buildPromptFromTaskPayload(
    buildAiTaskPayload({
      action: "apu",
      payload: {
        description,
        unit,
      },
    }),
  );

  return [taskPrompt, "", buildOutputJsonShapeBlock(APU_OUTPUT_JSON_SHAPE)].join("\n");
}

export function buildCatalogApuSystemPrompt() {
  return [
    "Eres un asistente experto en analisis de precios unitarios para construccion en Peru.",
    "REGLAS OBLIGATORIAS:",
    "1. Usa como referencia principal las partidas similares entregadas.",
    "2. Manten la estructura del APU mas parecido cuando sea tecnicamente razonable.",
    "3. Usa unicamente insumos existentes en el catalogo proporcionado como matchingResources.",
    "4. No inventes codigos, nombres, unidades ni resource_id.",
    "5. Si falta un recurso, agregalo en suggested_new_resources y no en items.",
    "6. Devuelve solamente JSON valido, sin markdown ni texto libre.",
    "7. Marca cualquier dato incierto con requires_review=true.",
    "8. El backend validara tu salida antes de mostrarla al usuario.",
    "9. En items, type solo puede ser MATERIAL, LABOR, EQUIPMENT, TOOLS o SUBCONTRACT.",
    "10. En items, source debe ser exactamente catalog.",
    "11. En items, name y unit deben ser strings copiados desde matchingResources; nunca objetos.",
    "12. En items, quantity debe ser number; nunca texto con unidades.",
    "13. Nunca escribas placeholders como matchingResources[0].id, Ejemplo de Material o id-de-partida. Copia valores literales del contexto.",
  ].join("\n");
}

export function buildCatalogApuPrompt(context: unknown) {
  return [
    "Genera una propuesta editable de APU basada exclusivamente en este contexto compacto.",
    "No uses recursos fuera de matchingResources.",
    "Respeta el outputSchema.",
    "Devuelve exactamente un objeto JSON con las claves del ejemplo.",
    "Ejemplo de salida valida usando un recurso real del contexto:",
    JSON.stringify(buildCatalogApuExample(context), null, 2),
    "",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

function buildCatalogApuExample(context: unknown) {
  const resource = readFirstMatchingResource(context);
  const query = readStringProperty(context, "query") ?? "Partida del contexto";
  const unit = readStringProperty(context, "unit") ?? resource?.unit ?? "UND";
  const basedOnPartidaId = readFirstSimilarPartidaId(context);

  return {
    partida_name: query,
    unit,
    based_on_partida_id: basedOnPartidaId,
    confidence: 0.75,
    items: resource
      ? [
          {
            resource_id: resource.id,
            name: resource.name,
            type: resource.category,
            unit: resource.unit,
            quantity: 1,
            source: "catalog",
            requires_review: true,
          },
        ]
      : [],
    suggested_new_resources: [],
    warnings: [],
    requires_human_review: true,
  };
}

function readStringProperty(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const property = value[key];
  return typeof property === "string" && property.trim().length > 0 ? property : null;
}

function readFirstSimilarPartidaId(context: unknown) {
  if (!isRecord(context) || !Array.isArray(context.similarPartidas)) {
    return undefined;
  }

  const partida = context.similarPartidas.find((candidate) => isRecord(candidate) && typeof candidate.id === "string");
  return partida && isRecord(partida) && typeof partida.id === "string" ? partida.id : undefined;
}

function readFirstMatchingResource(context: unknown) {
  if (!isRecord(context) || !Array.isArray(context.matchingResources)) {
    return null;
  }

  const resource = context.matchingResources.find(
    (candidate): candidate is { id: string; name: string; category: "MATERIAL" | "LABOR" | "EQUIPMENT" | "TOOLS" | "SUBCONTRACT"; unit: string } =>
      isRecord(candidate) &&
      typeof candidate.id === "string" &&
      typeof candidate.name === "string" &&
      typeof candidate.unit === "string" &&
      (candidate.category === "MATERIAL" ||
        candidate.category === "LABOR" ||
        candidate.category === "EQUIPMENT" ||
        candidate.category === "TOOLS" ||
        candidate.category === "SUBCONTRACT"),
  );

  return resource ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildReviewPrompt(budgetSummary: string, options: { evidence?: AiEvidence[] } = {}) {
  const evidenceBlock = buildEvidenceSystemMessage(options.evidence ?? []);
  const taskPrompt = buildPromptFromTaskPayload(
    buildAiTaskPayload({
      action: "review",
      payload: {
        budgetSummary,
      },
    }),
  );

  return [taskPrompt, "", buildOutputJsonShapeBlock(REVIEW_OUTPUT_JSON_SHAPE), ...(evidenceBlock ? ["", evidenceBlock] : [])].join("\n");
}

export function buildAutocompletePrompt(input: string) {
  const taskPrompt = buildPromptFromTaskPayload(
    buildAiTaskPayload({
      action: "autocomplete",
      payload: {
        input,
      },
    }),
  );

  return [taskPrompt, "", "Devuelve solo el texto completado, sin explicaciones ni formato adicional."].join("\n");
}

export function buildStructuredRepairPrompt() {
  return [
    "Corrige tu respuesta anterior.",
    "Devuelve solo un JSON valido que cumpla exactamente el esquema solicitado.",
    "No agregues markdown, comentarios ni texto fuera del JSON.",
  ].join("\n");
}
