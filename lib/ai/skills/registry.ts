import { formatAssembledContextBlock } from "@/lib/ai/context/assembled-context";
import { buildPromptFromTaskPayload, buildTaskPayloadMessages } from "@/lib/ai/prompts";
import { aiApuStructuredSchema, aiReviewStructuredSchema } from "@/lib/ai/structured-output";
import { buildKhipuTaskPayload } from "@/lib/ai/task-payloads";
import type { KhipuAiTask } from "@/lib/ai/gateway/types";
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
    instruction:
      "skill-autocomplete: Completa texto tecnico breve y reutilizable, sin explicaciones adicionales.",
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
  return [
    ...buildTaskPayloadMessages({
      jsonOnly: taskPayload.output.format === "json_only",
      message: buildPromptFromTaskPayload(taskPayload),
      assembledContextBlock: formatAssembledContextBlock(assembledContext),
    }),
    { role: "system" as const, content: instruction },
  ];
}
