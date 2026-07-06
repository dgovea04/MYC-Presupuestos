import type { AiProviderRequest, AiProviderResult } from "@/lib/ai/gateway/types";
import type { AiMessage } from "@/lib/ai/types";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

/**
 * Models that are restricted to autocomplete only.
 * These models output chain-of-thought reasoning as response text
 * and are not suitable for chat, APU generation, or review tasks.
 */
const AUTOCOMPLETE_ONLY_MODELS = new Set(["gemma-4-31b-it"]);

/**
 * Resolves the effective model to use for a given task.
 * If the requested model is Gemma and the task is not autocomplete,
 * falls back to DEFAULT_GEMINI_MODEL with a warning.
 */
export function resolveEffectiveGeminiModel(
  requestedModel: string,
  task?: string,
): { model: string; warning?: string } {
  if (AUTOCOMPLETE_ONLY_MODELS.has(requestedModel) && task !== "autocomplete") {
    return {
      model: DEFAULT_GEMINI_MODEL,
      warning: `El modelo ${requestedModel} solo funciona para autocomplete. Usando ${DEFAULT_GEMINI_MODEL}.`,
    };
  }

  return { model: requestedModel };
}

export const GEMINI_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
  { value: "gemma-4-31b-it", label: "Gemma 4 31B" },
];

/**
 * Detects if a model name corresponds to gemma (instruction-tuned, benefits from flat prompts).
 */
export function isGemmaModel(model: string): boolean {
  return model.startsWith("gemma-");
}

/**
 * Simplifies messages for gemma models, which respond better to a flat Ollama-like
 * structure without verbose INPUT JSON wrapping, empty context sections, or
 * output-format rules.
 *
 * Transforms from:
 *   [system: MYC_AI_SYSTEM_PROMPT, system: contextBlock, user: INPUT JSON, system: skill]
 * To:
 *   [system: clean instructions, system: concise context, user: plain message]
 */
export function simplifyMessagesForGemma(messages: AiMessage[]): AiMessage[] {
  let systemPrompt = "";
  let contextInfo = "";
  let userMessage = "";
  let skillInfo = "";

  for (const msg of messages) {
    if (msg.role === "system") {
      // Detect main system prompt (contains role definition)
      if (msg.content.includes("Eres un asistente")) {
        systemPrompt = msg.content
          // Remove JSON/output format instructions specific to other models
          // Match the entire line including optional bullet prefix to avoid orphaned "- " chains
          .replace(/Debes ejecutar la tarea indicada en INPUT JSON\.\s*/g, "")
          .replace(/- No uses markdown cuando el output\.format sea json_only\.\s*/g, "")
          .replace(/- No agregues explicacion antes ni despues cuando el output\.format sea json_only\.\s*/g, "")
          .replace(/- No uses bloques de codigo\.\s*/g, "")
          // Remove empty bullet lines left over after rule removal
          .replace(/^\s*-\s*$/gm, "")
          // Collapse consecutive blank lines
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      }
      // Detect skill prompt
      else if (/^skill[-:]/.test(msg.content)) {
        skillInfo = msg.content.replace(/^skill[-:]+\s*/, "").trim();
      }
      // Detect pre-built context block from buildChatMessages / buildContextString
      else if (msg.content.startsWith("Contexto operativo de MC Presupuestos:")) {
        contextInfo = msg.content;
      }
      // Detect context block (contains "Solicitud del usuario")
      else if (msg.content.includes("Solicitud del usuario")) {
        const solicitudMatch = msg.content.match(/"Solicitud del usuario"\s*\n(\{[\s\S]*\})/);
        if (solicitudMatch) {
          try {
            const solicitud = JSON.parse(solicitudMatch[1]);
            const ctx = solicitud.payload?.context;
            if (ctx) {
              contextInfo = buildContextString(ctx);
            }
          } catch {
            // Fallback: try to extract from the solicitud directly
          }
        }
      }
    }

    if (msg.role === "user") {
      if (msg.content.startsWith("INPUT JSON:")) {
        // Try to parse INPUT JSON and extract the plain message + context
        try {
          const jsonStr = msg.content.replace(/^INPUT JSON:\s*\n?/, "");
          const parsed = JSON.parse(jsonStr);

          userMessage = parsed.input?.message ?? "";

          // Extract context if not already found from the context block
          if (!contextInfo && parsed.context) {
            contextInfo = buildContextString(parsed.context);
          }
        } catch {
          // If parsing fails, use the content as-is
          userMessage = msg.content;
        }
      } else if (!userMessage) {
        // Plain user message (no INPUT JSON wrapping) — use as-is
        userMessage = msg.content;
      }
    }
  }

  // Append skill info to system prompt
  if (skillInfo && systemPrompt && !systemPrompt.includes(skillInfo)) {
    systemPrompt += `\n\n${skillInfo}`;
  }

  // Gemma-specific: prevent the model from outputting its reasoning/planning as the response
  if (systemPrompt) {
    systemPrompt += [
      "",
      "IMPORTANTE: No incluyas tu proceso de razonamiento, esquemas ni planificacion en tu respuesta.",
      "Responde DIRECTAMENTE con el contenido solicitado, sin anteponer un indice ni un outline mental.",
    ].join("\n");
  }

  const result: AiMessage[] = [];

  if (systemPrompt) {
    result.push({ role: "system", content: systemPrompt });
  }

  if (contextInfo) {
    result.push({ role: "system", content: contextInfo });
  }

  if (userMessage) {
    result.push({ role: "user", content: userMessage });
  }

  return result.length > 0 ? result : messages;
}

function buildContextString(ctx: Record<string, unknown>): string {
  const items: string[] = [];
  if (ctx.project) items.push(`Proyecto: ${ctx.project}`);
  if (ctx.module) items.push(`Módulo: ${ctx.module}`);
  if (ctx.selectedItem) items.push(`Partida seleccionada: ${ctx.selectedItem}`);
  if (ctx.unit) items.push(`Unidad: ${ctx.unit}`);
  if (ctx.currentCost != null) items.push(`Costo actual: ${ctx.currentCost}`);
  if (ctx.activeTable) items.push(`Tabla activa: ${ctx.activeTable}`);

  if (items.length === 0) return "";

  return `Contexto operativo de MC Presupuestos:\n${items.map((i) => `- ${i}`).join("\n")}`;
}

/**
 * Builds a Gemini-compatible request body.
 *
 * When `useFlatPrompt` is false (default):
 * - System messages go into top-level system_instruction
 * - User/assistant messages go into contents with proper roles
 *
 * When `useFlatPrompt` is true (gemma models):
 * - All messages go into contents, with system messages prefixed "SYSTEM:\n"
 * - This mirrors the Ollama-style prompt structure that gemma handles better
 */
export function buildGeminiRequestBody(
  messages: AiMessage[],
  opts?: { useFlatPrompt?: boolean },
) {
  const useFlatPrompt = opts?.useFlatPrompt ?? false;

  if (useFlatPrompt) {
    // Flat structure: all messages in contents, system prefixed with "SYSTEM:\n"
    return {
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{
          text: m.role === "system" ? `SYSTEM:\n${m.content}` : m.content,
        }],
      })),
    };
  }

  // Native structure: system_instruction for system, contents for conversation
  const systemMessages = messages.filter((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {};

  if (systemMessages.length > 0) {
    body.system_instruction = {
      parts: [{ text: systemMessages.map((m) => m.content).join("\n\n") }],
    };
  }

  if (conversationMessages.length > 0) {
    body.contents = conversationMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  } else if (systemMessages.length > 0) {
    // If all messages are system, send an empty user message to trigger the model
    body.contents = [{ role: "user", parts: [{ text: "" }] }];
  }

  return body;
}

export async function executeGeminiProvider({
  fetchImpl = fetch,
  messages,
  apiKey: requestApiKey,
  modelPreference,
  task,
}: AiProviderRequest): Promise<AiProviderResult> {
  const apiKey = requestApiKey || process.env.GEMINI_API_KEY;
  const rawModel = modelPreference || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const resolved = resolveEffectiveGeminiModel(rawModel, task);
  const resolvedModel = resolved.model;
  const warnings: string[] = resolved.warning ? [resolved.warning] : [];

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurado");
  }

  const isGemma = isGemmaModel(resolvedModel);
  const effectiveMessages = isGemma ? simplifyMessagesForGemma(messages) : messages;
  // Gemma uses simplified messages with flat prompt (Ollama-style SYSTEM: prefix in contents)
  const requestBody = buildGeminiRequestBody(effectiveMessages, { useFlatPrompt: isGemma });

  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(resolvedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) {
    let detail = "";
    try {
      const errorBody: unknown = await response.json();
      if (isRecord(errorBody) && isRecord(errorBody.error)) {
        detail = `: ${String(errorBody.error.message ?? JSON.stringify(errorBody.error))}`;
      }
    } catch {
      // Best-effort error parsing
    }
    throw new Error(`Gemini respondio con estado ${response.status}${detail}.`);
  }

  const payload: unknown = await response.json();

  return {
    answer: parseGeminiResponseText(payload),
    provider: "gemini",
    model: resolvedModel,
    requestedModel: rawModel,
    fallbackUsed: false,
    warnings,
    requestBody,
  };
}

export function parseGeminiResponseText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) {
    throw new Error("Gemini devolvio una respuesta sin candidatos.");
  }

  const text = payload.candidates
    .flatMap((candidate) => {
      if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
        return [];
      }

      return candidate.content.parts;
    })
    .map((part) => readStringProperty(part, "text"))
    .find((partText): partText is string => typeof partText === "string" && partText.trim().length > 0);

  if (!text) {
    throw new Error("Gemini devolvio una respuesta sin texto.");
  }

  return text.trim();
}

function readStringProperty(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  const property = value[key];
  return typeof property === "string" && property.trim().length > 0 ? property : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
