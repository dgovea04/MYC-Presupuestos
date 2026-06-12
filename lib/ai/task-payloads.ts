import type { AiContext } from "@/lib/ai/types";

export type AiPromptAction = "chat" | "apu" | "review" | "autocomplete";

export type AiTaskName =
  | "technical_chat"
  | "generate_apu"
  | "review_budget"
  | "autocomplete_construction_text";

export type AiOutputFormat = "text" | "json_only";

export type AiOutputSchemaName =
  | "technical_chat_v1"
  | "apu_generation_v1"
  | "budget_review_v1"
  | "autocomplete_text_v1";

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

const GUARDRAILS: AiTaskPayload["guardrails"] = {
  humanReviewRequired: true,
  noAutomaticBudgetMutation: true,
  noExactPriceFabrication: true,
};

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

function readTaskName(action: AiPromptAction): AiTaskName {
  if (action === "apu") return "generate_apu";
  if (action === "review") return "review_budget";
  if (action === "autocomplete") return "autocomplete_construction_text";
  return "technical_chat";
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

function readContext(value: unknown): AiContext | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const context: AiContext = {
    project: readOptionalString(value.project),
    module: readOptionalString(value.module),
    selectedItem: readOptionalString(value.selectedItem),
    unit: readOptionalString(value.unit),
    currentCost: typeof value.currentCost === "number" ? value.currentCost : undefined,
    activeTable: readOptionalString(value.activeTable),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
