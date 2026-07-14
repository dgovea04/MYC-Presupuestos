import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

const { getAiProviderSettingsMock, updateAiProviderSettingsMock } = vi.hoisted(() => ({
  getAiProviderSettingsMock: vi.fn(),
  updateAiProviderSettingsMock: vi.fn(),
}));

vi.mock("@/lib/data/settings", () => ({
  getAiProviderSettings: getAiProviderSettingsMock,
  updateAiProviderSettings: updateAiProviderSettingsMock,
}));

import { PUT, readOptionalTrimmedString } from "@/app/api/settings/ai-provider/route";
import { getAuthSession } from "@/lib/auth/session";
import { AGENT_MODELS } from "@/lib/ai/agent/models";

function mockAuthSession(userId = "user-1") {
  vi.mocked(getAuthSession).mockResolvedValue({
    expires: new Date().toISOString(),
    user: { id: userId, email: "u@example.com", name: "Test User" },
  });
}

function mockUnauthenticated() {
  vi.mocked(getAuthSession).mockResolvedValue(null);
}

function makeAiSettingsPayload(overrides?: {
  openaiConfigured?: boolean;
  geminiConfigured?: boolean;
  openrouterConfigured?: boolean;
  agentModel?: string;
  openaiModel?: string;
  geminiModel?: string;
  openrouterModel?: string;
}) {
  return {
    aiProviderPreference: "auto",
    openaiApiKeyMasked: "",
    geminiApiKeyMasked: "",
    openrouterApiKeyMasked: "",
    openaiModel: overrides?.openaiModel ?? "",
    geminiModel: overrides?.geminiModel ?? "",
    openrouterModel: overrides?.openrouterModel ?? "",
    agentModel: overrides?.agentModel ?? "",
    openaiConfigured: overrides?.openaiConfigured ?? false,
    geminiConfigured: overrides?.geminiConfigured ?? false,
    openrouterConfigured: overrides?.openrouterConfigured ?? false,
  };
}

async function put(body: unknown): Promise<Response> {
  return PUT(
    new Request("http://localhost/api/settings/ai-provider", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("/api/settings/ai-provider — agentModel whitelist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthSession();
    updateAiProviderSettingsMock.mockResolvedValue(makeAiSettingsPayload());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a known agentModel from AGENT_MODELS", async () => {
    const knownId = AGENT_MODELS[0].id; // first catalogue entry is always valid
    const response = await put({ agentModel: knownId, aiProviderPreference: "auto" });

    expect(response.status).toBe(200);
    expect(updateAiProviderSettingsMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ agentModel: knownId }),
    );
  });

  it("accepts every single AGENT_MODELS id (round-trip)", async () => {
    for (const model of AGENT_MODELS) {
      vi.clearAllMocks();
      mockAuthSession();
      updateAiProviderSettingsMock.mockResolvedValue(makeAiSettingsPayload({ agentModel: model.id }));

      const response = await put({ agentModel: model.id, aiProviderPreference: "auto" });
      expect(response.status, `model id="${model.id}" should be accepted`).toBe(200);
    }
  });

  it("rejects an unknown agentModel with 400 and a user-facing error message", async () => {
    const response = await put({ agentModel: "totally/made-up-model", aiProviderPreference: "auto" });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: string;
      field: string;
      invalidValue: string;
      validOptions: string[];
    };

    expect(body.field).toBe("agentModel");
    expect(body.invalidValue).toBe("totally/made-up-model");
    expect(body.error).toContain("totally/made-up-model");
    expect(body.error).toContain("Modelo del agente desconocido");
    // Error must enumerate every valid id so the user can copy one verbatim.
    for (const model of AGENT_MODELS) {
      expect(body.error, `error should mention valid id "${model.id}"`).toContain(model.id);
    }
    expect(body.validOptions).toEqual(AGENT_MODELS.map((model) => model.id));
    expect(updateAiProviderSettingsMock).not.toHaveBeenCalled();
  });

  it("trims whitespace before validating (server-side normalization)", async () => {
    const knownId = AGENT_MODELS[0].id;
    const response = await put({ agentModel: `  ${knownId}  `, aiProviderPreference: "auto" });

    expect(response.status).toBe(200);
    expect(updateAiProviderSettingsMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ agentModel: knownId }),
    );
  });

  it("treats explicit null as clearing (input.agentModel === null)", async () => {
    const response = await put({ agentModel: null, aiProviderPreference: "auto" });
    expect(response.status).toBe(200);
    expect(updateAiProviderSettingsMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ agentModel: null }),
    );
  });

  it("treats explicit empty string as clearing (input.agentModel === null)", async () => {
    const response = await put({ agentModel: "", aiProviderPreference: "auto" });
    expect(response.status).toBe(200);
    expect(updateAiProviderSettingsMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ agentModel: null }),
    );
  });

  it("OMITS agentModel from input when caller did not include the key (independencia entre cards)", async () => {
    // BUGFIX: CloudAiSettingsCard nunca envía `agentModel` en el PUT (solo
    // escribe openaiModel / geminiModel / openrouterModel / preferences). Si
    // la ruta aplanaba la ausencia a "input.agentModel = null", el data layer
    // escribía null en la DB y al refrescar KhipuAgente su `data.agentModel`
    // venía vacío → caía al DEFAULT_AGENT_MODEL (openrouter/free), aunque
    // el usuario hubiera seleccionado gemini-3.1. Después de esta
    // corrección la clave agentModel debe quedar literalmente ausente del
    // input, así el data layer aplica su short-circuit
    // `input.agentModel !== undefined` y preserva la fila persistida.
    const response = await put({
      aiProviderPreference: "openrouter",
      openrouterModel: "anthropic/claude-sonnet-4",
      openrouterApiKey: "sk-or-test-1234",
    });

    expect(response.status).toBe(200);
    expect(updateAiProviderSettingsMock).toHaveBeenCalledTimes(1);
    const callArg = updateAiProviderSettingsMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect("agentModel" in callArg).toBe(false);
    // Los demás campos sí deben propagarse.
    expect(callArg.aiProviderPreference).toBe("openrouter");
    expect(callArg.openrouterModel).toBe("anthropic/claude-sonnet-4");
  });

  it("REGRESIÓN del usuario: configurar openrouter en Proveedores Cloud IA NO cambia el modelo en Khipu Agente", async () => {
    // Reproduce el flujo exacto que reportó el usuario:
    //   1) Khipu Agente selecciona gemini-3.1 y guarda
    //   2) Proveedores Cloud IA configura openrouter y guarda
    //   3) GET de Khipu Agente — debe seguir resolviendo a gemini-3.1, no a
    //      openrouter/free (el DEFAULT_AGENT_MODEL).
    //
    // El bug era que el paso 2 metía `agentModel = null` en el input del
    // data layer, escribiendo null en la DB. Después de esta corrección el
    // paso 2 deja agentModel intacto y la columna se conserva.

    // Paso 1: Khipu Agente guarda gemini-3.1.
    const firstResponse = await put({
      agentModel: "google/gemini-2.5-flash",
      aiProviderPreference: "auto",
    });
    expect(firstResponse.status).toBe(200);
    expect(updateAiProviderSettingsMock.mock.calls[0]?.[1]).toMatchObject({
      agentModel: "google/gemini-2.5-flash",
    });

    vi.clearAllMocks();
    mockAuthSession();
    updateAiProviderSettingsMock.mockResolvedValue(makeAiSettingsPayload({ agentModel: "google/gemini-2.5-flash" }));

    // Paso 2: Proveedores Cloud IA guarda openrouter sin tocar agentModel.
    const secondResponse = await put({
      aiProviderPreference: "openrouter",
      openrouterModel: "openrouter/free",
      openrouterApiKey: "sk-or-v1-user-key",
    });
    expect(secondResponse.status).toBe(200);
    const secondCallArg = updateAiProviderSettingsMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect("agentModel" in secondCallArg).toBe(false); // <-- el bug original
    expect(secondCallArg.openrouterModel).toBe("openrouter/free");
    expect(secondCallArg.aiProviderPreference).toBe("openrouter");
  });
});

describe("/api/settings/ai-provider — aiProviderPreference whitelist + ausencia vs explícito", () => {
  const VALID_AI_PROVIDER_PREFERENCES = [
    "auto",
    "ollama",
    "chatgpt_bridge",
    "openai",
    "gemini",
    "openrouter",
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthSession();
    updateAiProviderSettingsMock.mockResolvedValue(makeAiSettingsPayload());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("acepta cada uno de los valores válidos del enum aiProviderPreference", async () => {
    for (const preference of VALID_AI_PROVIDER_PREFERENCES) {
      vi.clearAllMocks();
      mockAuthSession();
      updateAiProviderSettingsMock.mockResolvedValue(makeAiSettingsPayload());

      const response = await put({ aiProviderPreference: preference });
      expect(response.status, `preference "${preference}" should be accepted`).toBe(200);
      expect(updateAiProviderSettingsMock).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ aiProviderPreference: preference }),
      );
    }
  });

  it("trims whitespace antes de validar", async () => {
    const response = await put({ aiProviderPreference: "  gemini  " });
    expect(response.status).toBe(200);
    expect(updateAiProviderSettingsMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ aiProviderPreference: "gemini" }),
    );
  });

  it("rechaza un aiProviderPreference desconocido con 400 y lista los valores válidos", async () => {
    const response = await put({ aiProviderPreference: "made-up-provider" });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: string;
      field: string;
      invalidValue: string;
      validOptions: string[];
    };
    expect(body.field).toBe("aiProviderPreference");
    expect(body.invalidValue).toBe("made-up-provider");
    expect(body.error).toContain("made-up-provider");
    expect(body.error).toContain("Proveedor de IA desconocido");
    expect(body.validOptions).toEqual([...VALID_AI_PROVIDER_PREFERENCES]);
    expect(updateAiProviderSettingsMock).not.toHaveBeenCalled();
  });

  it("rechaza aiProviderPreference null con 400 (no es un valor válido)", async () => {
    const response = await put({ aiProviderPreference: null });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { field: string; invalidValue: string; error: string };
    expect(body.field).toBe("aiProviderPreference");
    expect(body.invalidValue).toBe("null");
    expect(body.error).toContain("Recibido: null");
    expect(updateAiProviderSettingsMock).not.toHaveBeenCalled();
  });

  it("rechaza aiProviderPreference string vacío con 400", async () => {
    const response = await put({ aiProviderPreference: "" });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { field: string; invalidValue: string; error: string };
    expect(body.field).toBe("aiProviderPreference");
    expect(body.invalidValue).toBe("");
    expect(body.error).toContain("no puede ser un texto vacío");
    expect(updateAiProviderSettingsMock).not.toHaveBeenCalled();
  });

  it("rechaza aiProviderPreference no-string con 400 (boolean / number / object / array)", async () => {
    const cases = [
      { input: true, kind: "boolean" as const, expectedInvalidValue: "true" },
      { input: 42, kind: "number" as const, expectedInvalidValue: "42" },
      { input: { provider: "openai" }, kind: "object" as const, expectedInvalidValue: '{"provider":"openai"}' },
      { input: ["openai", "gemini"], kind: "array" as const, expectedInvalidValue: '["openai","gemini"]' },
    ];

    for (const testCase of cases) {
      vi.clearAllMocks();
      mockAuthSession();
      updateAiProviderSettingsMock.mockResolvedValue(makeAiSettingsPayload());

      const response = await put({ aiProviderPreference: testCase.input });
      expect(response.status, `case ${testCase.kind}`).toBe(400);
      const body = (await response.json()) as { field: string; invalidValue: string; error: string };
      expect(body.field).toBe("aiProviderPreference");
      expect(body.invalidValue).toBe(testCase.expectedInvalidValue);
      expect(body.error).toContain(`(tipo ${testCase.kind})`);
      expect(updateAiProviderSettingsMock).not.toHaveBeenCalled();
    }
  });

  it("OMITE aiProviderPreference del input cuando el caller NO incluye la clave (independencia entre cards)", async () => {
    // BUGFIX: anteriormente `readAiProviderPreference(undefined)` devolvía
    // "auto" silenciosamente, lo que reseteaba cualquier preferencia no-auto
    // cada vez que un caller (e.g. CloudAiSettingsCard) guardaba campos
    // per-proveedor sin tocar la preferencia. Ahora, si la clave está ausente,
    // la ruta la deja fuera del input → el data layer conserva la fila
    // persistida vía `supportsAiProviderPreference`.
    const response = await put({
      agentModel: "google/gemini-2.5-flash",
      openrouterModel: "anthropic/claude-sonnet-4",
      openrouterApiKey: "sk-or-test-1234",
    });

    expect(response.status).toBe(200);
    expect(updateAiProviderSettingsMock).toHaveBeenCalledTimes(1);
    const callArg = updateAiProviderSettingsMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect("aiProviderPreference" in callArg).toBe(false);
    // Otros campos sí deben propagarse.
    expect(callArg.agentModel).toBe("google/gemini-2.5-flash");
    expect(callArg.openrouterModel).toBe("anthropic/claude-sonnet-4");
  });

  it("REGRESIÓN: cambiar openrouterModel sin tocar aiProviderPreference preserva la preferencia existente", async () => {
    // Reproduce el escenario espejo al bug de agentModel pero para
    // aiProviderPreference: usuario selecciona "openrouter" en
    // CloudAiSettingsCard, luego guarda openrouterModel — la preferencia
    // debe seguir siendo "openrouter" en la DB.

    // Paso 1: seleccionar openrouter como preferencia.
    const firstResponse = await put({
      aiProviderPreference: "openrouter",
      openrouterApiKey: "sk-or-v1-user-key",
    });
    expect(firstResponse.status).toBe(200);
    expect(updateAiProviderSettingsMock.mock.calls[0]?.[1]).toMatchObject({
      aiProviderPreference: "openrouter",
    });

    vi.clearAllMocks();
    mockAuthSession();
    updateAiProviderSettingsMock.mockResolvedValue(makeAiSettingsPayload());

    // Paso 2: cambiar solo el openrouterModel — la preferencia debe persistir.
    const secondResponse = await put({
      openrouterModel: "anthropic/claude-sonnet-4",
    });
    expect(secondResponse.status).toBe(200);
    const secondCallArg = updateAiProviderSettingsMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect("aiProviderPreference" in secondCallArg).toBe(false); // <- el bug original
    expect(secondCallArg.openrouterModel).toBe("anthropic/claude-sonnet-4");
  });

  it("401 tiene precedencia sobre la validación de aiProviderPreference", async () => {
    vi.clearAllMocks();
    mockUnauthenticated();

    const response = await put({ aiProviderPreference: "made-up-provider" });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("No autorizado");
    expect(updateAiProviderSettingsMock).not.toHaveBeenCalled();
  });

  // ── Non-string rejection with JSON.stringify content assertions ─────────────

  it("rejects non-string agentModel values with 400 (invalidValue coerced to string)", async () => {
    const response = await put({ agentModel: 12345, aiProviderPreference: "auto" });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; field: string; invalidValue: unknown };
    expect(body.field).toBe("agentModel");
    // invalidValue must always be a string for client shape consistency
    expect(typeof body.invalidValue).toBe("string");
    expect(body.invalidValue).toBe("12345");
    expect(body.error).toContain("debe ser un texto");
    expect(updateAiProviderSettingsMock).not.toHaveBeenCalled();
  });

  it("rejects boolean/object/array/numeric agentModel values with 400 and pins JSON.stringify output", async () => {
    type Case = {
      input: unknown;
      expectedKind: "boolean" | "object" | "array" | "number";
      expectedInvalidValue: string;
    };
    const cases: Case[] = [
      { input: true, expectedKind: "boolean", expectedInvalidValue: "true" },
      { input: { id: "openrouter/free" }, expectedKind: "object", expectedInvalidValue: '{"id":"openrouter/free"}' },
      {
        input: ["openrouter/free", "openai/gpt-4o"],
        expectedKind: "array",
        expectedInvalidValue: '["openrouter/free","openai/gpt-4o"]',
      },
      { input: 12.34, expectedKind: "number", expectedInvalidValue: "12.34" },
    ];

    for (const testCase of cases) {
      vi.clearAllMocks();
      mockAuthSession();
      updateAiProviderSettingsMock.mockResolvedValue(makeAiSettingsPayload());

      const response = await put({ agentModel: testCase.input, aiProviderPreference: "auto" });
      expect(response.status, `case ${testCase.expectedKind}`).toBe(400);
      const body = (await response.json()) as {
        field: string;
        invalidValue: unknown;
        error: string;
      };
      expect(body.field).toBe("agentModel");
      expect(body.invalidValue).toBe(testCase.expectedInvalidValue);
      expect(body.error).toContain(`(tipo ${testCase.expectedKind})`);
      expect(updateAiProviderSettingsMock).not.toHaveBeenCalled();
    }
  });

  it("rejects nested object agentModel with full JSON output", async () => {
    const response = await put({
      agentModel: { provider: "openrouter", id: "free" },
      aiProviderPreference: "auto",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.invalidValue).toBe('{"provider":"openrouter","id":"free"}');
    expect(body.error).toContain("(tipo object)");
  });

  it("rejects empty-array agentModel with 400", async () => {
    const response = await put({ agentModel: [], aiProviderPreference: "auto" });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { field: string; invalidValue: string; error: string };
    expect(body.field).toBe("agentModel");
    expect(body.invalidValue).toBe("[]");
    expect(body.error).toContain("(tipo array)");
    expect(updateAiProviderSettingsMock).not.toHaveBeenCalled();
  });

  it("rejects empty-object agentModel with 400", async () => {
    const response = await put({ agentModel: {}, aiProviderPreference: "auto" });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { field: string; invalidValue: string; error: string };
    expect(body.field).toBe("agentModel");
    expect(body.invalidValue).toBe("{}");
    expect(body.error).toContain("(tipo object)");
    expect(updateAiProviderSettingsMock).not.toHaveBeenCalled();
  });

  it("does NOT validate when user is unauthenticated (401 takes precedence)", async () => {
    vi.clearAllMocks();
    mockUnauthenticated();

    const response = await put({ agentModel: "totally/made-up-model", aiProviderPreference: "auto" });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("No autorizado");
    expect(updateAiProviderSettingsMock).not.toHaveBeenCalled();
  });

  it("valid agentModel alongside other fields succeeds", async () => {
    const knownId = AGENT_MODELS.find((model) => model.provider === "openrouter")?.id ?? AGENT_MODELS[0].id;
    const response = await put({
      agentModel: knownId,
      openaiModel: "gpt-5-mini",
      geminiModel: "gemini-2.5-flash",
      openrouterModel: "deepseek/deepseek-chat-v3-0324:free",
      aiProviderPreference: "openrouter",
    });

    expect(response.status).toBe(200);
    expect(updateAiProviderSettingsMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        agentModel: knownId,
        openaiModel: "gpt-5-mini",
        geminiModel: "gemini-2.5-flash",
        openrouterModel: "deepseek/deepseek-chat-v3-0324:free",
        aiProviderPreference: "openrouter",
      }),
    );
  });
});

// ─── readOptionalTrimmedString — direct unit tests ─────────────────────────
//
// The helper collapses 4 input shapes (non-empty string, empty string,
// null, undefined) into a normalized `string | null` with explicit
// SET / CLEAR / SKIP semantics. The data layer (`lib/data/settings.ts`)
// keys off these return values to decide whether to encrypt+write the
// field, write `""`, or leave the DB column untouched.

describe("readOptionalTrimmedString — direct unit tests", () => {
  it("SET: trims and returns a non-empty string", () => {
    expect(readOptionalTrimmedString("  hello  ")).toBe("hello");
  });

  it("SET: preserves internal whitespace", () => {
    expect(readOptionalTrimmedString("  hello world  ")).toBe("hello world");
  });

  it("SET: returns a single-character string untouched after trim", () => {
    expect(readOptionalTrimmedString("  x  ")).toBe("x");
  });

  it("CLEAR: returns '' for an empty string", () => {
    expect(readOptionalTrimmedString("")).toBe("");
  });

  it("CLEAR: trims a whitespace-only string to ''", () => {
    expect(readOptionalTrimmedString("   ")).toBe("");
  });

  it("CLEAR: trims tabs and newlines to ''", () => {
    expect(readOptionalTrimmedString("\t\n  \t")).toBe("");
  });

  it("SKIP: returns null for null", () => {
    expect(readOptionalTrimmedString(null)).toBeNull();
  });

  it("SKIP: returns null for undefined", () => {
    expect(readOptionalTrimmedString(undefined)).toBeNull();
  });

  it("SKIP (defensive): returns null for boolean", () => {
    expect(readOptionalTrimmedString(true)).toBeNull();
    expect(readOptionalTrimmedString(false)).toBeNull();
  });

  it("SKIP (defensive): returns null for number", () => {
    expect(readOptionalTrimmedString(0)).toBeNull();
    expect(readOptionalTrimmedString(42)).toBeNull();
    expect(readOptionalTrimmedString(NaN)).toBeNull();
  });

  it("SKIP (defensive): returns null for object", () => {
    expect(readOptionalTrimmedString({})).toBeNull();
    expect(readOptionalTrimmedString({ key: "value" })).toBeNull();
  });

  it("SKIP (defensive): returns null for array", () => {
    expect(readOptionalTrimmedString([])).toBeNull();
    expect(readOptionalTrimmedString(["a", "b"])).toBeNull();
  });
});

// ─── readOptionalTrimmedString — clear-vs-skip semantics for the 6 call sites ─
//
// Each of the 6 fields (3 API keys + 3 model ids) is wired through the
// same helper. These tests pin the end-to-end contract: whatever the
// helper returns ends up verbatim in the AiProviderSettingsInput that
// reaches the data layer. The data layer itself decides what to do with
// `""` vs `null` (per-field semantics differ — keys treat `""` as CLEAR
// and `null` as SKIP; models treat both as a write of an empty/null value).

describe("readOptionalTrimmedString — clear-vs-skip semantics for the 6 input fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthSession();
    updateAiProviderSettingsMock.mockResolvedValue(makeAiSettingsPayload());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const TRIMMED_FIELDS = [
    "openaiApiKey",
    "geminiApiKey",
    "openrouterApiKey",
    "openaiModel",
    "geminiModel",
    "openrouterModel",
  ] as const;

  for (const field of TRIMMED_FIELDS) {
    describe(field, () => {
      it("SET: trims a non-empty string and forwards the trimmed value to the data layer", async () => {
        const response = await put({ [field]: "  value-1  " });
        expect(response.status).toBe(200);
        expect(updateAiProviderSettingsMock).toHaveBeenCalledWith(
          "user-1",
          expect.objectContaining({ [field]: "value-1" }),
        );
      });

      it("CLEAR: forwards an explicit empty string as \"\" to the data layer", async () => {
        const response = await put({ [field]: "" });
        expect(response.status).toBe(200);
        expect(updateAiProviderSettingsMock).toHaveBeenCalledWith(
          "user-1",
          expect.objectContaining({ [field]: "" }),
        );
      });

      it("SKIP: forwards an absent key as null to the data layer", async () => {
        const response = await put({});
        expect(response.status).toBe(200);
        expect(updateAiProviderSettingsMock).toHaveBeenCalledWith(
          "user-1",
          expect.objectContaining({ [field]: null }),
        );
      });
    });
  }
});
