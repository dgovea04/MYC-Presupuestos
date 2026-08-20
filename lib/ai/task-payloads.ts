import type { KhipuAiTask } from "@/lib/ai/gateway/types";
import type { AiContext } from "@/lib/ai/types";

export type AiPromptAction = "chat" | "apu" | "review" | "autocomplete";

export type AiTaskName =
  | KhipuAiTask
  | "technical_chat"
  | "autocomplete_construction_text";

export type AiOutputFormat = "text" | "json_only";

export type AiOutputSchemaName =
  | "technical_chat_v1"
  | "apu_generation_v1"
  | "apu_review_v1"
  | "budget_review_v1"
  | "autocomplete_text_v1"
  | "formula_polinomica_review_v1"
  | "quantity_takeoff_review_v1"
  | "montecarlo_risk_analysis_v1"
  | "pdf_import_structure_v1"
  | "catalog_insumo_suggestions_v1"
  | "partida_generation_v1";

export type AiTaskPayload = {
  task: AiTaskName;
  role: "construction_cost_assistant_peru";
  output: {
    format: AiOutputFormat;
    schema: AiOutputSchemaName;
  };
  context?: AiContext;
  input: Record<string, string>;
  guardrails: {
    humanReviewRequired: true;
    noAutomaticBudgetMutation: true;
    noExactPriceFabrication: true;
  };
};

type BuildAiTaskPayloadInput = {
  action: AiPromptAction;
  payload: Record<string, unknown>;
};

type BuildKhipuTaskPayloadInput = {
  task: KhipuAiTask;
  payload: Record<string, unknown>;
};

const GUARDRAILS: AiTaskPayload["guardrails"] = {
  humanReviewRequired: true,
  noAutomaticBudgetMutation: true,
  noExactPriceFabrication: true,
};

const LEGACY_ACTION_TO_TASK = {
  chat: "chat",
  apu: "generate_apu",
  review: "review_budget",
  autocomplete: "autocomplete",
} as const satisfies Record<AiPromptAction, KhipuAiTask>;

export function buildAiTaskPayload({ action, payload }: BuildAiTaskPayloadInput): AiTaskPayload {
  const context = readContext(payload.context);

  return {
    task: readTaskName(action),
    role: "construction_cost_assistant_peru",
    output: readOutput(action),
    ...(context ? { context } : {}),
    input: readInput(action, payload),
    guardrails: GUARDRAILS,
  };
}

export function buildBridgeTaskPayload(input: BuildAiTaskPayloadInput): AiTaskPayload {
  return buildAiTaskPayload(input);
}

export function buildKhipuTaskPayload({ task, payload }: BuildKhipuTaskPayloadInput): AiTaskPayload {
  const context = readContext(payload.context);

  return {
    task,
    role: "construction_cost_assistant_peru",
    output: readKhipuOutput(task),
    ...(context ? { context } : {}),
    input: readKhipuInput(task, payload),
    guardrails: GUARDRAILS,
  };
}

function readTaskName(action: AiPromptAction): AiTaskName {
  const officialTask = LEGACY_ACTION_TO_TASK[action];
  if (action === "apu") return "generate_apu";
  if (action === "review") return "review_budget";
  if (action === "autocomplete") return "autocomplete_construction_text";
  return officialTask === "chat" ? "technical_chat" : officialTask;
}

function readOutput(action: AiPromptAction): AiTaskPayload["output"] {
  if (action === "apu") {
    return { format: "json_only", schema: "apu_generation_v1" };
  }

  if (action === "review") {
    return { format: "json_only", schema: "budget_review_v1" };
  }

  if (action === "autocomplete") {
    return { format: "text", schema: "autocomplete_text_v1" };
  }

  return { format: "json_only", schema: "technical_chat_v1" };
}

function readInput(action: AiPromptAction, payload: Record<string, unknown>): Record<string, string> {
  if (action === "apu") {
    return omitEmptyStrings({
      description: readRequiredString(payload.description, "description"),
      unit: readOptionalString(payload.unit),
    });
  }

  if (action === "review") {
    return {
      budgetSummary: readRequiredString(payload.budgetSummary, "budgetSummary"),
    };
  }

  if (action === "autocomplete") {
    return {
      input: readRequiredString(payload.input, "input"),
    };
  }

  return {
    message: readRequiredString(payload.message, "message"),
  };
}

function readKhipuOutput(task: KhipuAiTask): AiTaskPayload["output"] {
  if (task === "chat") {
    return { format: "text", schema: "technical_chat_v1" };
  }

  if (task === "autocomplete") {
    return { format: "text", schema: "autocomplete_text_v1" };
  }

  if (task === "review_apu") {
    return { format: "json_only", schema: "apu_review_v1" };
  }

  if (task === "generate_apu") {
    return { format: "json_only", schema: "apu_generation_v1" };
  }

  if (task === "review_budget") {
    return { format: "json_only", schema: "budget_review_v1" };
  }

  if (task === "review_formula_polinomica") {
    return { format: "json_only", schema: "formula_polinomica_review_v1" };
  }

  if (task === "review_quantity_takeoff") {
    return { format: "json_only", schema: "quantity_takeoff_review_v1" };
  }

  if (task === "montecarlo_risk_analysis") {
    return { format: "json_only", schema: "montecarlo_risk_analysis_v1" };
  }

  if (task === "pdf_import_structure") {
    return { format: "json_only", schema: "pdf_import_structure_v1" };
  }

  if (task === "suggest_insumos") {
    return { format: "json_only", schema: "catalog_insumo_suggestions_v1" };
  }

  return { format: "json_only", schema: "partida_generation_v1" };
}

function readKhipuInput(task: KhipuAiTask, payload: Record<string, unknown>): Record<string, string> {
  if (task === "chat") {
    return {
      message: readRequiredString(payload.message, "message"),
    };
  }

  if (task === "autocomplete") {
    return {
      input: readRequiredString(payload.input, "input"),
    };
  }

  if (task === "review_budget") {
    return {
      budgetSummary: readRequiredString(payload.budgetSummary, "budgetSummary"),
    };
  }

  if (task === "review_formula_polinomica") {
    return {
      formulaSummary: readRequiredString(payload.formulaSummary, "formulaSummary"),
    };
  }

  if (task === "review_quantity_takeoff") {
    return {
      quantityTakeoffSummary: readRequiredString(payload.quantityTakeoffSummary, "quantityTakeoffSummary"),
    };
  }

  if (task === "montecarlo_risk_analysis") {
    return {
      riskSummary: readRequiredString(payload.riskSummary, "riskSummary"),
    };
  }

  if (task === "suggest_insumos") {
    return omitEmptyStrings({
      description: readRequiredString(payload.description, "description"),
      unit: readOptionalString(payload.unit),
    });
  }

  if (task === "pdf_import_structure") {
    return {
      prompt: readRequiredString(payload.prompt, "prompt"),
    };
  }

  return omitEmptyStrings({
    description: readRequiredString(payload.description, "description"),
    unit: readOptionalString(payload.unit),
  });
}

function readContext(value: unknown): AiContext | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const context: AiContext = {
    route: readOptionalString(value.route),
    projectId: readOptionalString(value.projectId),
    budgetId: readOptionalString(value.budgetId),
    project: readOptionalString(value.project),
    module: readOptionalString(value.module),
    selectedItem: readOptionalString(value.selectedItem),
    selectionType: readSelectionType(value.selectionType),
    selectionId: readOptionalString(value.selectionId),
    unit: readOptionalString(value.unit),
    currentCost: typeof value.currentCost === "number" ? value.currentCost : undefined,
    activeTable: readOptionalString(value.activeTable),
    viewSummary: readOptionalString(value.viewSummary),
  };

  const entries = Object.entries(context).filter(([, entryValue]) => entryValue !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function omitEmptyStrings(value: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
    ),
  );
}

function readRequiredString(value: unknown, key: string) {
  const stringValue = readOptionalString(value);
  if (!stringValue) {
    throw new Error(`Missing AI task input: ${key}`);
  }

  return stringValue;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readSelectionType(value: unknown): AiContext["selectionType"] {
  return value === "project" || value === "budget" || value === "partida" || value === "resource" || value === "metrado"
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
