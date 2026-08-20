import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { getAiProviderSettings, updateAiProviderSettings, type AiProviderSettingsInput } from "@/lib/data/settings";
import { AGENT_MODELS } from "@/lib/ai/agent/models";
import { isLocalRuntimeEnabled } from "@/lib/runtime/local-capabilities";
import { getFeatureAccessResponse } from "@/lib/billing/route-access";
import { PDF_IMPORT_PROVIDER_OPTIONS, type PdfImportProvider } from "@/types/settings";

const VALID_AGENT_MODEL_IDS = new Set(AGENT_MODELS.map((model) => model.id));
const AI_PROVIDER_PREFERENCE_OPTIONS = [
  "auto",
  "ollama",
  "chatgpt_bridge",
  "openai",
  "gemini",
  "openrouter",
] as const satisfies readonly AiProviderSettingsInput["aiProviderPreference"][];
const VALID_AI_PROVIDER_PREFERENCES = new Set<string>(AI_PROVIDER_PREFERENCE_OPTIONS);
const VALID_PDF_IMPORT_PROVIDERS = new Set<string>(PDF_IMPORT_PROVIDER_OPTIONS);

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const accessResponse = await getFeatureAccessResponse(session.user.id, "khipu.agent");
  if (accessResponse) return accessResponse;

  try {
    const settings = await getAiProviderSettings(session.user.id);
    return NextResponse.json(
      !isLocalRuntimeEnabled() && settings.aiProviderPreference === "ollama"
        ? { ...settings, aiProviderPreference: "auto" }
        : settings,
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al cargar configuración de IA." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const accessResponse = await getFeatureAccessResponse(session.user.id, "khipu.agent");
  if (accessResponse) return accessResponse;

  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
    }

    // Distinguish "caller did not send agentModel" (preserve existing DB value)
    // from "caller explicitly nullified it" (clear it). Without this distinction
    // the data layer's `input.agentModel !== undefined` check would interpret
    // both cases identically and wipe the previously-saved agentModel when
    // CloudAiSettingsCard saves without the field — making the model selected
    // in KhipuAgenteSettingsCard silently revert to DEFAULT_AGENT_MODEL.
    const includeAgentModel = Object.prototype.hasOwnProperty.call(body, "agentModel");
    let candidateAgentModel: string | null | undefined;

    if (includeAgentModel) {
      const validation = validateAgentModel(body.agentModel);
      if (!validation.ok) {
        return NextResponse.json(
          {
            error: validation.message,
            field: "agentModel",
            invalidValue: validation.invalidValue,
            validOptions: AGENT_MODELS.map((model) => model.id),
          },
          { status: 400 },
        );
      }
      candidateAgentModel = validation.value;
    }

    // Same protection for aiProviderPreference: omitting the field must
    // preserve whatever preference the caller previously selected. Previously
    // readAiProviderPreference(undefined) silently fell back to "auto",
    // resetting any non-default preference on every save made by callers
    // that only touched provider-specific fields (e.g. openrouterModel).
    const includeAiProviderPreference = Object.prototype.hasOwnProperty.call(body, "aiProviderPreference");
    let candidateAiProviderPreference: AiProviderSettingsInput["aiProviderPreference"] | undefined;
    const includePdfImportProvider = Object.prototype.hasOwnProperty.call(body, "pdfImportProvider");
    let candidatePdfImportProvider: PdfImportProvider | undefined;

    if (includePdfImportProvider) {
      const validation = validatePdfImportProvider(body.pdfImportProvider);
      if (!validation.ok) {
        return NextResponse.json(
          {
            error: validation.message,
            field: "pdfImportProvider",
            invalidValue: validation.invalidValue,
            validOptions: [...PDF_IMPORT_PROVIDER_OPTIONS],
          },
          { status: 400 },
        );
      }
      candidatePdfImportProvider = validation.value;
    }

    if (includeAiProviderPreference) {
      const validation = validateAiProviderPreference(body.aiProviderPreference);
      if (!validation.ok) {
        return NextResponse.json(
          {
            error: validation.message,
            field: "aiProviderPreference",
            invalidValue: validation.invalidValue,
            validOptions: [...AI_PROVIDER_PREFERENCE_OPTIONS],
          },
          { status: 400 },
        );
      }
      candidateAiProviderPreference = validation.value;
    }

    const input: AiProviderSettingsInput = {
      openaiApiKey: readOptionalTrimmedString(body.openaiApiKey),
      geminiApiKey: readOptionalTrimmedString(body.geminiApiKey),
      openrouterApiKey: readOptionalTrimmedString(body.openrouterApiKey),
      openaiModel: readOptionalTrimmedString(body.openaiModel),
      geminiModel: readOptionalTrimmedString(body.geminiModel),
      openrouterModel: readOptionalTrimmedString(body.openrouterModel),
    };

    if (includeAgentModel) {
      // Explicit clear (caller sent null or empty string) writes null to DB.
      // Absence (caller did not send the key) leaves the field undefined and
      // the data layer skips the agentModel column entirely.
      // `candidateAgentModel` is `string | null` here (the `undefined` branch
      // is unreachable because we only enter this block when validation ran).
      input.agentModel = candidateAgentModel;
    }

    if (includeAiProviderPreference) {
      // When the caller did not include the key we leave the field undefined
      // so the data layer's `supportsAiProviderPreference` branch keeps the
      // existing DB value rather than silently overwriting it with "auto".
      input.aiProviderPreference = candidateAiProviderPreference;
    }

    if (includePdfImportProvider) {
      input.pdfImportProvider = candidatePdfImportProvider;
    }

    const settings = await updateAiProviderSettings(session.user.id, input);
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al guardar configuración de IA." },
      { status: 500 },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Collapse an arbitrary input value to the normalized `string | null` form
 * used by every per-field text read in the PUT body (3 API keys + 3 model ids).
 *
 * Contract — the returned value encodes one of three explicit cases:
 *
 *   | Returned value    | Semantic | Meaning                                  |
 *   | ----------------- | -------- | ---------------------------------------- |
 *   | trimmed non-empty | SET      | caller wants to write the trimmed value  |
 *   | `""`              | CLEAR    | caller wants to explicitly clear         |
 *   | `null`            | SKIP     | caller did not provide the field         |
 *
 * Inputs collapsed:
 *   - non-empty string                 → trimmed string  (SET)
 *   - empty / whitespace-only string   → `""`            (CLEAR)
 *   - `null`                           → `null`          (SKIP)
 *   - `undefined`                      → `null`          (SKIP)
 *   - any other type                   → `null`          (SKIP, defensive — never trust the wire)
 *
 *   Boxed primitives like `new String("x")` are also treated as `null`
 *   because `typeof` reports `"object"` for them. JSON wire payloads
 *   should never produce boxed primitives, and the type guard matches
 *   the runtime contract rather than papering over a structural mismatch.
 *
 *   The data layer (`lib/data/settings.ts`) interprets the returned value
 *   with **per-field semantics** that differ between API keys and model ids:
 *
 *   - **API keys (openai/gemini/openrouter):** the data layer keys off
 *     `input.X === ""` to CLEAR (writes `null` via `|| null`) and treats
 *     `null`/`undefined` as SKIP. So `""` → clear, `null` → skip.
 *   - **Model ids (openai/gemini/openrouter):** the data layer writes
 *     `input.X ?? null` directly, so `""` → writes empty string to DB
 *     and `null` → writes `null` to DB. Both produce `""` in the GET
 *     response (the fallback is `input.X ?? ""`), but the DB content
 *     differs from the pre-refactor behavior where empty string was
 *     collapsed to `null` at this layer. If a future caller needs
 *     "empty string → null" for model ids, either collapse empty strings
 *     to `null` at the call site or update the data layer to normalize
 *     `""` → `null` for model columns.
 *
 * Exported so it can be unit-tested in isolation and reused by sibling
 * routes that need the same per-field text semantics.
 */
export function readOptionalTrimmedString(raw: unknown): string | null {
  if (typeof raw === "string") {
    return raw.trim();
  }
  return null;
}

/**
 * Result type for validateAiProviderPreference. Either the value is in the
 * curated enum (auto/ollama/chatgpt_bridge/openai/gemini/openrouter), or it is
 * malformed / non-string / unknown and we need to surface a user-facing 400.
 *
 * Unlike `validateAgentModel`, there is intentionally no
 * `value: null | "use default"` branch — aiProviderPreference is a required
 * field with no nullable semantic. Only the absent-key case (handled by
 * `includeAiProviderPreference` in the route) means "don't touch".
 */
type AiProviderPreferenceValidation =
  | { ok: true; value: AiProviderSettingsInput["aiProviderPreference"] }
  | { ok: false; message: string; invalidValue: string };

/**
 * Whitelist aiProviderPreference against the curated enum.
 *
 * Rules:
 *   - null / non-string scalar/array/object          → 400 (malformed payload)
 *   - empty / whitespace-only string                 → 400 (malformed value)
 *   - string not matching any enum option            → 400 (unknown provider)
 *   - string matching an enum option                 → ok, value = trimmed id
 *
 * The caller-level absent case (caller did not include the JSON key) is
 * filtered by `includeAiProviderPreference` in the route before this
 * function runs — `undefined` is therefore treated as a programming error
 * here and would hit the non-string branch.
 */
type PdfImportProviderValidation =
  | { ok: true; value: PdfImportProvider }
  | { ok: false; message: string; invalidValue: string };

function validatePdfImportProvider(raw: unknown): PdfImportProviderValidation {
  if (typeof raw !== "string") {
    const received = raw === null ? "null" : typeof raw === "object" ? JSON.stringify(raw) : String(raw);
    return {
      ok: false,
      invalidValue: received,
      message: `pdfImportProvider debe ser uno de: ${PDF_IMPORT_PROVIDER_OPTIONS.join(", ")}. Recibido: ${received}.`,
    };
  }

  const trimmed = raw.trim();
  if (!VALID_PDF_IMPORT_PROVIDERS.has(trimmed)) {
    return {
      ok: false,
      invalidValue: trimmed,
      message: `Proveedor de importación PDF desconocido: "${trimmed}". Valores válidos: ${PDF_IMPORT_PROVIDER_OPTIONS.join(", ")}.`,
    };
  }

  return { ok: true, value: trimmed as PdfImportProvider };
}

function validateAiProviderPreference(raw: unknown): AiProviderPreferenceValidation {
  if (raw === null) {
    return {
      ok: false,
      invalidValue: "null",
      message: [
        "aiProviderPreference debe ser un texto con un valor del enum permitido.",
        "Recibido: null.",
        `Valores válidos: ${AI_PROVIDER_PREFERENCE_OPTIONS.join(", ")}.`,
      ].join(" "),
    };
  }
  if (typeof raw !== "string") {
    // null handled above; objects/arrays use JSON.stringify so we don't lose
    // shape — String() renders them as "[object Object]" or comma-joined
    // lists which would mislead the user reading the error message.
    const received = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
    const kind = Array.isArray(raw) ? "array" : typeof raw;
    return {
      ok: false,
      invalidValue: received,
      message: [
        "aiProviderPreference debe ser un texto con un valor del enum permitido.",
        `Recibido: ${received} (tipo ${kind}).`,
        `Valores válidos: ${AI_PROVIDER_PREFERENCE_OPTIONS.join(", ")}.`,
      ].join(" "),
    };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      invalidValue: trimmed,
      message: [
        "aiProviderPreference no puede ser un texto vacío.",
        `Valores válidos: ${AI_PROVIDER_PREFERENCE_OPTIONS.join(", ")}.`,
      ].join(" "),
    };
  }
  if (!VALID_AI_PROVIDER_PREFERENCES.has(trimmed) || (trimmed === "ollama" && !isLocalRuntimeEnabled())) {
    return {
      ok: false,
      invalidValue: trimmed,
      message:
        trimmed === "ollama" && !isLocalRuntimeEnabled()
          ? "Ollama solo esta disponible en la app local. Selecciona un proveedor cloud o Automatico."
          : buildInvalidAiProviderPreferenceError(trimmed),
    };
  }
  // The .has() lookup above guarantees `trimmed` is in the curated enum, so
  // the cast here is sound — the Set is keyed by string literals from
  // AI_PROVIDER_PREFERENCE_OPTIONS which already satisfies the enum type.
  return { ok: true, value: trimmed as AiProviderSettingsInput["aiProviderPreference"] };
}

/**
 * Build the user-facing error message shown when aiProviderPreference sent
 * by the client isn't part of the curated enum. The message lists every
 * valid value so the user can copy one verbatim.
 */
function buildInvalidAiProviderPreferenceError(invalidValue: string): string {
  return [
    `Proveedor de IA desconocido: "${invalidValue}".`,
    "Solo se permiten los valores del enum aiProviderPreference.",
    `Valores válidos: ${AI_PROVIDER_PREFERENCE_OPTIONS.join(", ")}.`,
  ].join(" ");
}

/**
 * Result type for validateAgentModel. Either the value is acceptable (the
 * optional trimmed string or null when the field is absent/empty), or it is
 * malformed or unknown and we need to surface a user-facing 400.
 */
type AgentModelValidation =
  | { ok: true; value: string | null }
  | { ok: false; message: string; invalidValue: string };

/**
 * Whitelist agentModel against the curated AGENT_MODELS catalogue.
 *
 * Rules:
 *   - absent / null / empty string  → ok, value = null (means "use default")
 *   - non-string scalar/array/object → 400 (malformed payload)
 *   - string not in AGENT_MODELS     → 400 (unknown id)
 *   - string in AGENT_MODELS        → ok, value = trimmed id
 *
 * invalidValue is always coerced to a string in the response so clients
 * always see the same shape regardless of what the caller sent.
 */
function validateAgentModel(raw: unknown): AgentModelValidation {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    // null already handled above. For objects/arrays use JSON.stringify —
    // String() would render them as "[object Object]" or comma-joined lists
    // which are misleading in an error message. Primitives stringify cleanly.
    const received = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
    // typeof [] === "object" in JS, so disambiguate Array.isArray for honesty.
    const kind = Array.isArray(raw) ? "array" : typeof raw;
    return {
      ok: false,
      invalidValue: received,
      message: [
        "agentModel debe ser un texto con un ID del catálogo curado.",
        `Recibido: ${received} (tipo ${kind}).`,
        `Modelos válidos (${AGENT_MODELS.length}): ${AGENT_MODELS.map((model) => model.id).join(", ")}.`,
      ].join(" "),
    };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (!VALID_AGENT_MODEL_IDS.has(trimmed)) {
    return { ok: false, invalidValue: trimmed, message: buildInvalidAgentModelError(trimmed) };
  }
  return { ok: true, value: trimmed };
}

/**
 * Build the user-facing error message shown when the agentModel sent by the
 * client isn't part of the curated AGENT_MODELS catalogue. The message lists
 * every valid model ID so the user can copy one verbatim, and points them at
 * the source of truth (lib/ai/agent/models.ts).
 */
function buildInvalidAgentModelError(invalidValue: string): string {
  const validIds = AGENT_MODELS.map((model) => model.id);
  return [
    `Modelo del agente desconocido: "${invalidValue}".`,
    "Solo se permiten modelos del catálogo curado en lib/ai/agent/models.ts.",
    `Modelos válidos (${validIds.length}): ${validIds.join(", ")}.`,
  ].join(" ");
}
