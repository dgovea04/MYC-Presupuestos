import { describe, expect, it, vi } from "vitest";
import {
  buildGeminiRequestBody,
  executeGeminiProvider,
  isGemmaModel,
  parseGeminiResponseText,
  resolveEffectiveGeminiModel,
  simplifyMessagesForGemma,
} from "@/lib/ai/gateway/providers/gemini-provider";

describe("buildGeminiRequestBody", () => {
  it("uses system_instruction for system messages and contents for user messages", () => {
    const body = buildGeminiRequestBody([
      { role: "system", content: "Eres un asistente experto." },
      { role: "user", content: "Hola" },
    ]);

    expect(body).toEqual({
      system_instruction: {
        parts: [{ text: "Eres un asistente experto." }],
      },
      contents: [
        { role: "user", parts: [{ text: "Hola" }] },
      ],
    });
  });

  it("maps assistant role to model role", () => {
    const body = buildGeminiRequestBody([
      { role: "user", content: "Hola" },
      { role: "assistant", content: "Respuesta" },
    ]);

    expect(body).toEqual({
      contents: [
        { role: "user", parts: [{ text: "Hola" }] },
        { role: "model", parts: [{ text: "Respuesta" }] },
      ],
    });
  });

  it("joins multiple system messages into one system_instruction", () => {
    const body = buildGeminiRequestBody([
      { role: "system", content: "Instruccion 1" },
      { role: "system", content: "Instruccion 2" },
      { role: "user", content: "Pregunta" },
    ]);

    expect(body).toEqual({
      system_instruction: {
        parts: [{ text: "Instruccion 1\n\nInstruccion 2" }],
      },
      contents: [
        { role: "user", parts: [{ text: "Pregunta" }] },
      ],
    });
  });

  it("sends empty user message when all messages are system", () => {
    const body = buildGeminiRequestBody([
      { role: "system", content: "Instruccion" },
    ]);

    expect(body).toEqual({
      system_instruction: {
        parts: [{ text: "Instruccion" }],
      },
      contents: [
        { role: "user", parts: [{ text: "" }] },
      ],
    });
  });

  describe("useFlatPrompt mode (gemma)", () => {
    it("puts all messages in contents with SYSTEM prefix for system messages", () => {
      const body = buildGeminiRequestBody(
        [
          { role: "system", content: "Eres un asistente experto." },
          { role: "system", content: "Contexto del proyecto." },
          { role: "user", content: "Genera recomendaciones." },
        ],
        { useFlatPrompt: true },
      );

      expect(body).toEqual({
        contents: [
          { role: "user", parts: [{ text: "SYSTEM:\nEres un asistente experto." }] },
          { role: "user", parts: [{ text: "SYSTEM:\nContexto del proyecto." }] },
          { role: "user", parts: [{ text: "Genera recomendaciones." }] },
        ],
      });
    });

    it("maps assistant role to model role in flat mode", () => {
      const body = buildGeminiRequestBody(
        [
          { role: "system", content: "Instrucciones" },
          { role: "user", content: "Hola" },
          { role: "assistant", content: "Respuesta" },
        ],
        { useFlatPrompt: true },
      );

      expect(body).toEqual({
        contents: [
          { role: "user", parts: [{ text: "SYSTEM:\nInstrucciones" }] },
          { role: "user", parts: [{ text: "Hola" }] },
          { role: "model", parts: [{ text: "Respuesta" }] },
        ],
      });
    });

    it("does not include system_instruction field when useFlatPrompt is true", () => {
      const body = buildGeminiRequestBody(
        [{ role: "system", content: "Instruccion" }],
        { useFlatPrompt: true },
      );

      expect(body).not.toHaveProperty("system_instruction");
      expect(body.contents).toHaveLength(1);
    });
  });

  describe("simplifyMessagesForGemma", () => {
    // Matches buildTaskPayloadSystemPrompt format from prompts.ts (with bullet prefixes)
    const systemPrompt = "Eres un asistente tecnico experto en presupuestos de construccion en Peru, APU, metrados, costos, rendimientos y formula polinomica.\n" +
      "Responde SIEMPRE en espanol. Nunca uses ingles en tus respuestas.\n" +
      "Debes ejecutar la tarea indicada en INPUT JSON.\n" +
      "Reglas obligatorias:\n" +
      "- Responde de forma tecnica, clara, estructurada y profesional.\n" +
      "- No uses markdown cuando el output.format sea json_only.\n" +
      "- No agregues explicacion antes ni despues cuando el output.format sea json_only.\n" +
      "- No uses bloques de codigo.\n" +
      "- No modifiques presupuestos automaticamente.\n" +
      "- No inventes precios exactos.\n" +
      "- Si falta informacion, declara supuestos o datos requeridos.\n" +
      "- Toda recomendacion debe quedar para revision humana.";

    const contextBlock = "Contexto del proyecto\nSin contexto de proyecto disponible.\n\n" +
      "Historial reciente\nSin historial reciente.\n\n" +
      "Solicitud del usuario\n" +
      '{"task":"chat","payload":{"message":"Genera recomendaciones.","context":{"project":"Edificio Multifamiliar","module":"APU","selectedItem":"Concreto f\'c=210","unit":"m3","currentCost":420,"activeTable":"Analisis de precios unitarios"}}}';

    const inputJsonMessage =
      'INPUT JSON:\n{"task":"chat","role":"construction_cost_assistant_peru","output":{"format":"text"},' +
      '"context":{"project":"Edificio Multifamiliar","module":"APU","selectedItem":"Concreto f\'c=210","unit":"m3","currentCost":420,"activeTable":"Analisis de precios unitarios"},' +
      '"input":{"message":"Genera recomendaciones."},"guardrails":{"humanReviewRequired":true}}';

    const skillPrompt = "skill-chat: Responde como copiloto tecnico de costos y presupuestos de construccion en Peru.";

    it("simplifies the standard 4-message format to 3 clean messages", () => {
      const result = simplifyMessagesForGemma([
        { role: "system", content: systemPrompt },
        { role: "system", content: contextBlock },
        { role: "user", content: inputJsonMessage },
        { role: "system", content: skillPrompt },
      ]);

      expect(result).toHaveLength(3);

      // System 1: clean instructions without JSON/output format rules, with no-reasoning guard
      expect(result[0].role).toBe("system");
      expect(result[0].content).not.toContain("INPUT JSON");
      expect(result[0].content).not.toContain("json_only");
      expect(result[0].content).not.toContain("bloques de codigo");
      expect(result[0].content).toContain("Eres un asistente tecnico");
      expect(result[0].content).toContain("Responde SIEMPRE en espanol");
      expect(result[0].content).toContain("copiloto tecnico"); // skill appended
      expect(result[0].content).toContain("IMPORTANTE: No incluyas tu proceso de razonamiento");

      // System 2: concise context block
      expect(result[1].role).toBe("system");
      expect(result[1].content).toContain("Contexto operativo de MYC Presupuestos");
      expect(result[1].content).toContain("Proyecto: Edificio Multifamiliar");
      expect(result[1].content).toContain("Partida seleccionada: Concreto f'c=210");
      expect(result[1].content).toContain("Unidad: m3");
      expect(result[1].content).toContain("Costo actual: 420");
      expect(result[1].content).not.toContain("Sin contexto de proyecto disponible");

      // User 3: plain message without INPUT JSON wrapping
      expect(result[2].role).toBe("user");
      expect(result[2].content).toBe("Genera recomendaciones.");
    });

    it("returns original messages if no simplification is possible", () => {
      const original = [{ role: "user", content: "Hola" }];
      const result = simplifyMessagesForGemma(original);
      expect(result).toEqual(original);
    });

    it("handles messages without INPUT JSON", () => {
      const result = simplifyMessagesForGemma([
        { role: "system", content: "Eres un asistente experto." },
        { role: "user", content: "Hola, necesito ayuda." },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("system");
      expect(result[0].content).toContain("IMPORTANTE: No incluyas tu proceso de razonamiento");
      expect(result[1].role).toBe("user");
      expect(result[1].content).toBe("Hola, necesito ayuda.");
    });

    it("preserves pre-built context blocks from buildContextString / buildChatMessages", () => {
      const prebuiltContext = "Contexto operativo de MYC Presupuestos:\n- Proyecto: Edificio Multifamiliar\n- Módulo: Editor APU";
      const result = simplifyMessagesForGemma([
        { role: "system", content: "Eres un asistente tecnico experto en presupuestos de construccion en Peru.\nResponde SIEMPRE en espanol." },
        { role: "system", content: prebuiltContext },
        { role: "user", content: "Genera recomendaciones." },
      ]);

      expect(result).toHaveLength(3);
      expect(result[0].role).toBe("system");
      expect(result[0].content).toContain("Eres un asistente tecnico");
      expect(result[1].role).toBe("system");
      expect(result[1].content).toBe(prebuiltContext);
      expect(result[2].role).toBe("user");
      expect(result[2].content).toBe("Genera recomendaciones.");
    });
  });

  describe("isGemmaModel", () => {
    it("returns true for gemma models", () => {
      expect(isGemmaModel("gemma-4-31b-it")).toBe(true);
      expect(isGemmaModel("gemma-3-12b-it")).toBe(true);
      expect(isGemmaModel("gemma-2-2b-it")).toBe(true);
    });

    it("returns false for other Gemini models", () => {
      expect(isGemmaModel("gemini-2.5-flash")).toBe(false);
      expect(isGemmaModel("gemini-2.5-flash-lite")).toBe(false);
      expect(isGemmaModel("gemini-3.1-flash-lite")).toBe(false);
    });
  });

  describe("resolveEffectiveGeminiModel", () => {
    it("returns the requested model for non-Gemma models regardless of task", () => {
      expect(resolveEffectiveGeminiModel("gemini-2.5-flash", "chat")).toEqual({ model: "gemini-2.5-flash" });
      expect(resolveEffectiveGeminiModel("gemini-2.5-flash-lite", "generate_apu")).toEqual({ model: "gemini-2.5-flash-lite" });
    });

    it("returns Gemma model for autocomplete task", () => {
      const result = resolveEffectiveGeminiModel("gemma-4-31b-it", "autocomplete");
      expect(result).toEqual({ model: "gemma-4-31b-it" });
      expect(result.warning).toBeUndefined();
    });

    it("falls back to DEFAULT_GEMINI_MODEL for Gemma with non-autocomplete tasks", () => {
      for (const task of ["chat", "generate_apu", "review_budget", "montecarlo_risk_analysis"]) {
        const result = resolveEffectiveGeminiModel("gemma-4-31b-it", task);
        expect(result.model).toBe("gemini-2.5-flash-lite");
        expect(result.warning).toContain("gemma-4-31b-it solo funciona para autocomplete");
      }
    });

    it("falls back when task is undefined (non-autocomplete)", () => {
      const result = resolveEffectiveGeminiModel("gemma-4-31b-it");
      expect(result.model).toBe("gemini-2.5-flash-lite");
      expect(result.warning).toBeDefined();
    });
  });
});

describe("Gemini gateway provider", () => {
  it("maps generateContent candidates into the shared provider result", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "Analisis largo" }],
              },
            },
          ],
          usageMetadata: {
            totalTokenCount: 33,
          },
        }),
        { status: 200 },
      ),
    );

    const result = await executeGeminiProvider({
      task: "montecarlo_risk_analysis",
      messages: [{ role: "user", content: "Analiza riesgo" }],
      fetchImpl: fetchMock,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("key=test-key");
    // Verify the body uses native system_instruction format
    const requestBody: unknown = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body ?? "{}");
    expect(requestBody).toMatchObject({
      contents: [{ role: "user", parts: [{ text: "Analiza riesgo" }] }],
    });
    expect(result).toMatchObject({
      answer: "Analisis largo",
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      requestedModel: "gemini-2.5-flash-lite",
      fallbackUsed: false,
      warnings: [],
    });
  });

  it("does not expose API keys when Gemini returns an error", async () => {
    vi.stubEnv("GEMINI_API_KEY", "secret-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Bad request" } }), { status: 400 }));

    await expect(
      executeGeminiProvider({
        task: "chat",
        messages: [{ role: "user", content: "Hola" }],
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("Gemini respondio con estado 400");
  });

  it("falls back to DEFAULT_GEMINI_MODEL when Gemma is used for non-autocomplete task", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Respuesta via Gemini default" }] } }],
        }),
        { status: 200 },
      ),
    );

    const result = await executeGeminiProvider({
      task: "chat",
      modelPreference: "gemma-4-31b-it",
      messages: [{ role: "user", content: "Hola" }],
      fetchImpl: fetchMock,
    });

    // Should use DEFAULT_GEMINI_MODEL (gemini-2.5-flash-lite), not gemma
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
    );
    // Should NOT use gemma in the URL
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain("models/gemma");

    expect(result).toMatchObject({
      answer: "Respuesta via Gemini default",
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      requestedModel: "gemma-4-31b-it",
      fallbackUsed: false,
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("gemma-4-31b-it solo funciona para autocomplete");
  });

  it("parses Gemini text parts", () => {
    expect(
      parseGeminiResponseText({
        candidates: [
          {
            content: {
              parts: [{ text: "Texto Gemini" }],
            },
          },
        ],
      }),
    ).toBe("Texto Gemini");
  });
});
