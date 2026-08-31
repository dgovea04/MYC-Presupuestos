import { formatAssembledContextBlock } from "@/lib/ai/context/assembled-context";
import {
  APU_OUTPUT_JSON_SHAPE,
  buildOutputJsonShapeBlock,
  buildPromptFromTaskPayload,
  buildTaskPayloadMessages,
  REVIEW_OUTPUT_JSON_SHAPE,
} from "@/lib/ai/prompts";
import { aiApuStructuredSchema, aiAutocompleteStructuredSchema, aiReviewStructuredSchema } from "@/lib/ai/structured-output";
import { PDF_IMPORT_OUTPUT_JSON_SHAPE } from "@/lib/pdf-import/prompts";
import { buildKhipuTaskPayload } from "@/lib/ai/task-payloads";
import type { KhipuAiTask } from "@/lib/ai/gateway/types";
import type { AiOutputSchemaName } from "@/lib/ai/task-payloads";
import type { BuildSkillProviderRequestInput, KhipuSkill, SkillMessageInput } from "@/lib/ai/skills/types";

const SKILLS: KhipuSkill[] = [
  createSkill({
    id: "skill-apu",
    tasks: ["review_apu", "generate_apu"],
    schemaName: "apu_generation_v1",
    schema: aiApuStructuredSchema,
    instruction:
      "skill-apu: Genera o revisa APU con supuestos explicitos, sin mutar presupuestos automaticamente y con validacion humana.",
  }),
  createSkill({
    id: "skill-budget",
    tasks: ["review_budget"],
    schemaName: "budget_review_v1",
    schema: aiReviewStructuredSchema,
    instruction:
      "skill-budget: Revisa consistencia de presupuesto, duplicados, unidades, costos y cantidades con recomendaciones accionables.",
  }),
  createSkill({
    id: "skill-metrados",
    tasks: ["review_quantity_takeoff"],
    schemaName: "quantity_takeoff_review_v1",
    schema: aiReviewStructuredSchema,
    instruction:
      "skill-metrados: Verifica metrados, unidades, formulas y trazabilidad con partidas del presupuesto.",
  }),
  createSkill({
    id: "skill-formula-polinomica",
    tasks: ["review_formula_polinomica"],
    schemaName: "formula_polinomica_review_v1",
    schema: aiReviewStructuredSchema,
    instruction:
      "skill-formula-polinomica: Valida coeficientes con 3 decimales, monomios, indices unificados y supuestos normativos peruanos.",
  }),
  createSkill({
    id: "skill-risk",
    tasks: ["montecarlo_risk_analysis"],
    schemaName: "montecarlo_risk_analysis_v1",
    schema: aiReviewStructuredSchema,
    instruction:
      "skill-risk: En V2 entrega analisis asesor y datos faltantes; no inventes P50, P80, P90 ni histogramas sin simulacion backend.",
  }),
  createSkill({
    id: "skill-pdf-import",
    tasks: ["pdf_import_structure"],
    schemaName: "pdf_import_structure_v1",
    instruction:
      "skill-pdf-import: Estructura presupuestos, APUs y subpartidas desde texto OCR/PDF. Devuelve solo JSON valido, sin inventar valores faltantes.",
  }),
  createSkill({
    id: "skill-catalog",
    tasks: ["suggest_insumos", "generate_partida"],
    schemaName: "catalog_insumo_suggestions_v1",
    instruction:
      "skill-catalog: Usa recursos existentes del catalogo antes de sugerir nuevos insumos. Busca partidas similares, insumos similares, calcula score y marca novedades como suggested_new_resources.",
  }),
  createSkill({
    id: "skill-chat",
    tasks: ["chat"],
    schemaName: "technical_chat_v1",
    instruction:
      "skill-chat: Responde como copiloto tecnico de costos y presupuestos de construccion en Peru.",
  }),
  createSkill({
    id: "skill-autocomplete",
    tasks: ["autocomplete"],
    schemaName: "autocomplete_text_v1",
    schema: aiAutocompleteStructuredSchema,
    instruction:
      "skill-autocomplete: Devuelve una sugerencia estructurada de partida utilizable. Busca coincidencias en el contexto, evita duplicados y no inventes ids, códigos, APUs, metrados, precios ni rendimientos.",
  }),
];

export function resolveKhipuSkill(task: KhipuAiTask): KhipuSkill {
  const skill = SKILLS.find((candidate) => candidate.tasks.includes(task));

  if (!skill) {
    throw new Error(`No Khipu skill registered for task ${task}`);
  }

  return skill;
}

export function buildSkillProviderRequest({
  assembledContext,
  payload,
  task,
  userId,
}: BuildSkillProviderRequestInput) {
  const skill = resolveKhipuSkill(task);

  return {
    task,
    messages: skill.buildMessages({ task, payload, assembledContext }),
    schema: skill.schema,
    schemaName: skill.schemaName,
    userId,
  };
}

function createSkill({
  id,
  instruction,
  schema,
  schemaName,
  tasks,
}: Omit<KhipuSkill, "buildMessages"> & { instruction: string }): KhipuSkill {
  return {
    id,
    tasks,
    schema,
    schemaName,
    buildMessages: (input) => buildDefaultSkillMessages(input, instruction),
  };
}

function buildDefaultSkillMessages({ assembledContext, payload, task }: SkillMessageInput, instruction: string) {
  const taskPayload = buildKhipuTaskPayload({ task, payload });
  const taskPrompt = buildPromptFromTaskPayload(taskPayload);
  const outputShapeBlock = getOutputShapeBlock(taskPayload.output.schema);
  const userMessage = outputShapeBlock
    ? [taskPrompt, "", outputShapeBlock].join("\n")
    : taskPrompt;

  return [
    ...buildTaskPayloadMessages({
      jsonOnly: taskPayload.output.format === "json_only",
      message: userMessage,
      assembledContextBlock: formatAssembledContextBlock(assembledContext),
    }),
    { role: "system" as const, content: instruction },
  ];
}

function getOutputShapeBlock(schemaName: AiOutputSchemaName): string {
  switch (schemaName) {
    case "budget_review_v1":
    case "formula_polinomica_review_v1":
    case "quantity_takeoff_review_v1":
    case "montecarlo_risk_analysis_v1":
    case "apu_review_v1":
      return buildOutputJsonShapeBlock(REVIEW_OUTPUT_JSON_SHAPE);
    case "pdf_import_structure_v1":
      return buildOutputJsonShapeBlock(PDF_IMPORT_OUTPUT_JSON_SHAPE);
    case "apu_generation_v1":
      return buildOutputJsonShapeBlock(APU_OUTPUT_JSON_SHAPE);
    case "autocomplete_text_v1":
      return buildOutputJsonShapeBlock({
        answer: "descripcion tecnica corta",
        input: "texto original",
        suggestion: {
          id: "id literal solo si existe",
          code: "codigo literal solo si existe",
          description: "descripcion tecnica de la partida",
          unit: "unidad sugerida",
          category: "categoria sugerida",
          apuId: "id literal solo si existe",
          apuDescription: "descripcion del APU solo si existe",
          matchType: "existing|new",
          missingFields: ["datos a confirmar"],
        },
        alternatives: [],
        assumptions: ["supuestos"],
        requiresHumanReview: true,
      });
    default:
      return "";
  }
}
