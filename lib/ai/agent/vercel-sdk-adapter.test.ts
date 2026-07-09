import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { VercelSdkAdapter, createVercelSdkAdapter } from "./vercel-sdk-adapter";
import type {
  AgentSdkToolDefinition,
} from "./types";
import type { AgentVercelSdkLoopInput, AgentVercelSdkLoopOutput } from "./contracts";

// ─── Mock de generateText ────────────────────────────────────────────────────

vi.mock("ai", async () => {
  const actual = await vi.importActual("ai");
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

import { generateText } from "ai";
const mockGenerateText = vi.mocked(generateText);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSdkTool(
  name: string,
  description: string,
  schema: z.ZodType<Record<string, unknown>>
): AgentSdkToolDefinition {
  return { name, description, inputSchema: schema };
}

function makeLoopInput(
  overrides: Partial<AgentVercelSdkLoopInput> = {}
): AgentVercelSdkLoopInput {
  return {
    system: "Eres un asistente técnico de presupuestos.",
    messages: [
      { role: "user", content: "Busca partidas de concreto" },
    ],
    tools: [],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("VercelSdkAdapter", () => {
  describe("factory", () => {
    it("createVercelSdkAdapter devuelve una instancia", () => {
      const adapter = createVercelSdkAdapter();
      expect(adapter).toBeInstanceOf(VercelSdkAdapter);
    });
  });

  describe("runLoop", () => {
    it("retorna estructura de error cuando el modelo no es válido", async () => {
      const adapter = new VercelSdkAdapter();
      // resolvedModel no definido -> generateText recibirá undefined como model
      const input = makeLoopInput({ provider: "openrouter" });

      const output = await adapter.runLoop(input);

      expect(output.finishReason).toBe("error");
      expect(output.provider).toBe("openrouter");
      expect(output.warnings.length).toBeGreaterThan(0);
    });

    it("la estructura de output siempre tiene todos los campos requeridos", async () => {
      const adapter = new VercelSdkAdapter();
      const input = makeLoopInput();

      const output = await adapter.runLoop(input);

      expect(output).toHaveProperty("messages");
      expect(output).toHaveProperty("toolCalls");
      expect(output).toHaveProperty("finishReason");
      expect(output).toHaveProperty("provider");
      expect(output).toHaveProperty("model");
      expect(output).toHaveProperty("warnings");
      expect(Array.isArray(output.messages)).toBe(true);
      expect(Array.isArray(output.toolCalls)).toBe(true);
      expect(Array.isArray(output.warnings)).toBe(true);
    });

    it("preserva los mensajes originales en caso de error", async () => {
      const adapter = new VercelSdkAdapter();
      const originalMessages = [
        { role: "user" as const, content: "test message" },
      ];
      const input = makeLoopInput({ messages: originalMessages });

      const output = await adapter.runLoop(input);

      expect(output.messages).toEqual(originalMessages);
    });

    it("toolCalls es array vacío en error", async () => {
      const adapter = new VercelSdkAdapter();
      const input = makeLoopInput();
      const output = await adapter.runLoop(input);
      expect(output.toolCalls).toEqual([]);
    });
  });

  describe("stopWhen modes", () => {
    it("final_text es el default", async () => {
      const adapter = new VercelSdkAdapter();
      const input = makeLoopInput();
      const output = await adapter.runLoop(input);
      // En modo error, finishReason es "error"
      expect(output.finishReason).toBeDefined();
    });

    it("tool_limit es aceptado sin error de tipo", async () => {
      const adapter = new VercelSdkAdapter();
      const output = await adapter.runLoop(
        makeLoopInput({ stopWhen: "tool_limit" })
      );
      expect(output.finishReason).toBeDefined();
    });

    it("approval_boundary es aceptado sin error de tipo", async () => {
      const adapter = new VercelSdkAdapter();
      const output = await adapter.runLoop(
        makeLoopInput({ stopWhen: "approval_boundary" })
      );
      expect(output.finishReason).toBeDefined();
    });
  });

  describe("tool definitions", () => {
    it("procesa tool definitions sin errores de tipo", () => {
      const tools: AgentSdkToolDefinition[] = [
        makeSdkTool("calculateBudget", "Calcula totales", z.object({ budgetId: z.string() })),
        makeSdkTool("searchPartidas", "Busca partidas", z.object({ query: z.string() })),
        makeSdkTool("createChapter", "Crea capítulo", z.object({ name: z.string(), budgetId: z.string() })),
      ];

      const input = makeLoopInput({ tools });

      expect(input.tools).toHaveLength(3);
      expect(input.tools[0].name).toBe("calculateBudget");
      expect(input.tools[2].name).toBe("createChapter");
    });

    it("tools con schemas complejos de Zod funcionan", () => {
      const tool = makeSdkTool(
        "complexTool",
        "Tool con schema anidado",
        z.object({
          name: z.string().min(1),
          items: z.array(z.object({ id: z.string(), qty: z.number().positive() })),
        })
      );

      const input = makeLoopInput({ tools: [tool] });
      expect(input.tools[0].inputSchema).toBeDefined();
    });

    it("el adapter no ejecuta tools — solo las pasa al modelo", async () => {
      const adapter = new VercelSdkAdapter();
      const tools: AgentSdkToolDefinition[] = [
        makeSdkTool("unknownTool", "Herramienta desconocida", z.object({})),
      ];
      const output = await adapter.runLoop(makeLoopInput({ tools }));
      expect(output).toBeDefined();
    });
  });

  describe("tipos y contratos", () => {
    it("AgentSdkToolDefinition es compatible con Zod", () => {
      const tool: AgentSdkToolDefinition = {
        name: "test",
        description: "test tool",
        inputSchema: z.object({
          input: z.string(),
          count: z.number().optional(),
        }),
      };

      expect(tool.name).toBe("test");
      expect(tool.inputSchema).toBeDefined();
    });

    it("AgentVercelSdkLoopInput acepta resolvedModel como unknown", () => {
      const input: AgentVercelSdkLoopInput = {
        system: "test",
        messages: [],
        tools: [],
        resolvedModel: { someModel: true },
      };

      expect(input.resolvedModel).toEqual({ someModel: true });
    });

    it("AgentVercelSdkLoopOutput tiene todos los campos requeridos", () => {
      const output: AgentVercelSdkLoopOutput = {
        messages: [{ role: "assistant", content: "respuesta" }],
        toolCalls: [],
        finishReason: "stop",
        provider: "openrouter",
        model: "deepseek/deepseek-chat-v3-0324:free",
        warnings: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      };

      expect(output.finishReason).toBe("stop");
      expect(output.usage?.totalTokens).toBe(150);
    });
  });

  describe("compatibilidad con gateway existente", () => {
    it("el adapter es independiente del gateway", () => {
      const adapter = createVercelSdkAdapter();
      expect(adapter).toBeDefined();
    });

    it("resolvedModel se refleja en el output model", async () => {
      const adapter = new VercelSdkAdapter();
      const input = makeLoopInput({
        provider: "openrouter",
        resolvedModel: "openai/gpt-4o",
      });

      const output = await adapter.runLoop(input);
      expect(output.model).toBe("openai/gpt-4o");
    });

    it("provider se refleja en el output para auditoría", async () => {
      const adapter = new VercelSdkAdapter();
      const input = makeLoopInput({ provider: "gemini" });
      const output = await adapter.runLoop(input);
      expect(output.provider).toBe("gemini");
    });
  });

  describe("mensajes con roles extendidos", () => {
    it("soporta role 'tool' en mensajes", () => {
      const input = makeLoopInput({
        messages: [
          { role: "user", content: "crea presupuesto" },
          { role: "assistant", content: "Voy a crear el presupuesto" },
          { role: "tool", content: '{"budgetId": "budget_123"}' },
        ],
      });

      const roles = input.messages.map((m) => m.role);
      expect(roles).toContain("tool");
      expect(roles).toContain("user");
      expect(roles).toContain("assistant");
    });

    it("soporta mensaje con role 'system'", () => {
      const input = makeLoopInput({
        messages: [
          { role: "system", content: "contexto adicional" },
          { role: "user", content: "consulta" },
        ],
      });

      expect(input.messages[0].role).toBe("system");
      expect(input.messages[1].role).toBe("user");
    });
  });

  // ─── Tests con generateText mockeado (casos exitosos) ──────────────────

  describe("con generateText mockeado", () => {
    beforeEach(() => {
      mockGenerateText.mockReset();
    });

    describe("respuesta sin tool calls", () => {
      it("retorna finishReason 'stop' con respuesta del asistente", async () => {
        mockGenerateText.mockResolvedValueOnce({
          text: "He encontrado 5 partidas de concreto en tu presupuesto.",
          finishReason: "stop",
          usage: { promptTokens: 150, completionTokens: 80, totalTokens: 230 },
          toolCalls: [],
          toolResults: [],
          steps: [],
        } as unknown as ReturnType<typeof generateText>);

        const adapter = new VercelSdkAdapter();
        const input = makeLoopInput({
          provider: "openrouter",
          resolvedModel: "test-model",
        });

        const output = await adapter.runLoop(input);

        expect(output.finishReason).toBe("stop");
        expect(output.messages).toHaveLength(2); // original + assistant
        expect(output.messages[1]).toEqual({
          role: "assistant",
          content: "He encontrado 5 partidas de concreto en tu presupuesto.",
        });
        expect(output.toolCalls).toEqual([]);
        expect(output.warnings).toEqual([]);
      });

      it("forwardea usage del modelo correctamente", async () => {
        mockGenerateText.mockResolvedValueOnce({
          text: "Respuesta corta.",
          finishReason: "stop",
          usage: { promptTokens: 42, completionTokens: 7, totalTokens: 49 },
          toolCalls: [],
          toolResults: [],
          steps: [],
        } as unknown as ReturnType<typeof generateText>);

        const adapter = new VercelSdkAdapter();
        const output = await adapter.runLoop(
          makeLoopInput({ provider: "openrouter", resolvedModel: "model-x" })
        );

        expect(output.usage).toEqual({
          promptTokens: 42,
          completionTokens: 7,
          totalTokens: 49,
        });
      });

      it("preserva provider y model en el output", async () => {
        mockGenerateText.mockResolvedValueOnce({
          text: "Ok",
          finishReason: "stop",
          usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
          toolCalls: [],
          toolResults: [],
          steps: [],
        } as unknown as ReturnType<typeof generateText>);

        const adapter = new VercelSdkAdapter();
        const output = await adapter.runLoop(
          makeLoopInput({ provider: "gemini", resolvedModel: "gemini-2.0-flash" })
        );

        expect(output.provider).toBe("gemini");
        expect(output.model).toBe("gemini-2.0-flash");
      });
    });

    describe("extracción de tool calls", () => {
      it("extrae tool calls desde result.toolCalls", async () => {
        mockGenerateText.mockResolvedValueOnce({
          text: "Voy a buscar las partidas.",
          finishReason: "tool_calls",
          usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
          toolCalls: [
            {
              toolCallId: "call_abc123",
              toolName: "searchPartidas",
              args: { query: "concreto", limit: 10 },
            },
            {
              toolCallId: "call_def456",
              toolName: "calculateBudget",
              args: { budgetId: "budget_001" },
            },
          ],
          toolResults: [],
          steps: [],
        } as unknown as ReturnType<typeof generateText>);

        const adapter = new VercelSdkAdapter();
        const output = await adapter.runLoop(
          makeLoopInput({ provider: "openrouter", resolvedModel: "test" })
        );

        expect(output.toolCalls).toHaveLength(2);
        expect(output.toolCalls[0]).toEqual({
          id: "call_abc123",
          name: "searchPartidas",
          arguments: { query: "concreto", limit: 10 },
        });
        expect(output.toolCalls[1]).toEqual({
          id: "call_def456",
          name: "calculateBudget",
          arguments: { budgetId: "budget_001" },
        });
      });

      it("extrae tool calls desde result.steps cuando toolCalls está vacío", async () => {
        mockGenerateText.mockResolvedValueOnce({
          text: "",
          finishReason: "tool_calls",
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          toolCalls: [],
          toolResults: [],
          steps: [
            {
              text: "Buscando...",
              finishReason: "tool_calls",
              toolCalls: [],
              toolResults: [],
            },
            {
              text: "Encontré el insumo.",
              finishReason: "tool_calls",
              toolCalls: [
                {
                  toolCallId: "call_step_1",
                  toolName: "searchInsumos",
                  args: { query: "cemento" },
                },
              ],
              toolResults: [],
            },
          ],
        } as unknown as ReturnType<typeof generateText>);

        const adapter = new VercelSdkAdapter();
        const output = await adapter.runLoop(
          makeLoopInput({ provider: "openrouter", resolvedModel: "test" })
        );

        expect(output.toolCalls).toHaveLength(1);
        expect(output.toolCalls[0]).toEqual({
          id: "call_step_1",
          name: "searchInsumos",
          arguments: { query: "cemento" },
        });
      });

      it("deduplica tool calls entre toolCalls y steps", async () => {
        mockGenerateText.mockResolvedValueOnce({
          text: "",
          finishReason: "tool_calls",
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          toolCalls: [
            {
              toolCallId: "shared_call",
              toolName: "createChapter",
              args: { name: "Estructuras" },
            },
          ],
          toolResults: [],
          steps: [
            {
              text: "",
              finishReason: "tool_calls",
              toolCalls: [
                {
                  toolCallId: "shared_call",
                  toolName: "createChapter",
                  args: { name: "Estructuras" },
                },
                {
                  toolCallId: "unique_call",
                  toolName: "addPartida",
                  args: { description: "Concreto" },
                },
              ],
              toolResults: [],
            },
          ],
        } as unknown as ReturnType<typeof generateText>);

        const adapter = new VercelSdkAdapter();
        const output = await adapter.runLoop(
          makeLoopInput({ provider: "openrouter", resolvedModel: "test" })
        );

        // shared_call aparece en ambos, pero debe deduplicarse
        expect(output.toolCalls).toHaveLength(2);
        expect(output.toolCalls.map((tc) => tc.id).sort()).toEqual([
          "shared_call",
          "unique_call",
        ]);
      });
    });

    describe("determinación de finishReason", () => {
      it("retorna 'tool_limit' cuando stopWhen=tool_limit y hay >= maxToolCalls", async () => {
        // AGENT_LIMITS.maxToolCalls = 8
        const eightCalls = Array.from({ length: 8 }, (_, i) => ({
          toolCallId: `call_${i}`,
          toolName: `tool_${i}`,
          args: {},
        }));

        mockGenerateText.mockResolvedValueOnce({
          text: "",
          finishReason: "tool_calls",
          usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
          toolCalls: eightCalls,
          toolResults: [],
          steps: [],
        } as unknown as ReturnType<typeof generateText>);

        const adapter = new VercelSdkAdapter();
        const output = await adapter.runLoop(
          makeLoopInput({
            provider: "openrouter",
            resolvedModel: "test",
            stopWhen: "tool_limit",
          })
        );

        expect(output.finishReason).toBe("tool_limit");
        expect(output.toolCalls).toHaveLength(8);
      });

      it("NO retorna 'tool_limit' cuando hay < maxToolCalls aunque stopWhen=tool_limit", async () => {
        mockGenerateText.mockResolvedValueOnce({
          text: "",
          finishReason: "tool_calls",
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          toolCalls: [
            { toolCallId: "call_1", toolName: "searchPartidas", args: {} },
          ],
          toolResults: [],
          steps: [],
        } as unknown as ReturnType<typeof generateText>);

        const adapter = new VercelSdkAdapter();
        const output = await adapter.runLoop(
          makeLoopInput({
            provider: "openrouter",
            resolvedModel: "test",
            stopWhen: "tool_limit",
          })
        );

        expect(output.finishReason).toBe("tool_calls");
      });

      it("retorna 'approval_boundary' cuando stopWhen=approval_boundary y hay tool calls", async () => {
        mockGenerateText.mockResolvedValueOnce({
          text: "",
          finishReason: "tool_calls",
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          toolCalls: [
            { toolCallId: "call_1", toolName: "createBudget", args: { name: "Hospital" } },
          ],
          toolResults: [],
          steps: [],
        } as unknown as ReturnType<typeof generateText>);

        const adapter = new VercelSdkAdapter();
        const output = await adapter.runLoop(
          makeLoopInput({
            provider: "openrouter",
            resolvedModel: "test",
            stopWhen: "approval_boundary",
          })
        );

        expect(output.finishReason).toBe("approval_boundary");
      });

      it("NO retorna 'approval_boundary' cuando no hay tool calls", async () => {
        mockGenerateText.mockResolvedValueOnce({
          text: "No necesito herramientas para responder esto.",
          finishReason: "stop",
          usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
          toolCalls: [],
          toolResults: [],
          steps: [],
        } as unknown as ReturnType<typeof generateText>);

        const adapter = new VercelSdkAdapter();
        const output = await adapter.runLoop(
          makeLoopInput({
            provider: "openrouter",
            resolvedModel: "test",
            stopWhen: "approval_boundary",
          })
        );

        expect(output.finishReason).toBe("stop");
      });

      it("retorna 'stop' cuando finishReason está vacío", async () => {
        mockGenerateText.mockResolvedValueOnce({
          text: "Respuesta.",
          finishReason: "",
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          toolCalls: [],
          toolResults: [],
          steps: [],
        } as unknown as ReturnType<typeof generateText>);

        const adapter = new VercelSdkAdapter();
        const output = await adapter.runLoop(
          makeLoopInput({ provider: "openrouter", resolvedModel: "test" })
        );

        expect(output.finishReason).toBe("stop");
      });

      it("sdkFinishReason='error' prioriza sobre cualquier otro finishReason incluso con tool calls presentes", async () => {
        mockGenerateText.mockResolvedValueOnce({
          text: "",
          finishReason: "error",
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          toolCalls: [
            { toolCallId: "call_1", toolName: "searchPartidas", args: { query: "x" } },
            { toolCallId: "call_2", toolName: "createBudget", args: { name: "x" } },
            { toolCallId: "call_3", toolName: "calculateAPU", args: {} },
          ],
          toolResults: [],
          steps: [],
        } as unknown as ReturnType<typeof generateText>);

        const adapter = new VercelSdkAdapter();
        const output = await adapter.runLoop(
          makeLoopInput({
            provider: "openrouter",
            resolvedModel: "test",
            stopWhen: "approval_boundary",
          })
        );

        // Debe retornar "error", no "approval_boundary" ni "tool_limit"
        expect(output.finishReason).toBe("error");
        // Las tool calls se extraen igual para auditoría
        expect(output.toolCalls).toHaveLength(3);
      });
    });

    describe("manejo de errores en generateText", () => {
      it("captura errores del SDK y retorna finishReason 'error'", async () => {
        mockGenerateText.mockRejectedValueOnce(
          new Error("Timeout llamando al modelo")
        );

        const adapter = new VercelSdkAdapter();
        const input = makeLoopInput({
          provider: "openrouter",
          resolvedModel: "test",
          messages: [
            { role: "user", content: "mensaje original" },
          ],
        });

        const output = await adapter.runLoop(input);

        expect(output.finishReason).toBe("error");
        expect(output.warnings).toEqual(["Timeout llamando al modelo"]);
        expect(output.toolCalls).toEqual([]);
        // Los mensajes originales se preservan en error
        expect(output.messages).toEqual([
          { role: "user", content: "mensaje original" },
        ]);
      });

      it("captura errores no-Error y los convierte a string", async () => {
        mockGenerateText.mockRejectedValueOnce("fallo inesperado");

        const adapter = new VercelSdkAdapter();
        const output = await adapter.runLoop(
          makeLoopInput({ provider: "openrouter", resolvedModel: "test" })
        );

        expect(output.finishReason).toBe("error");
        expect(output.warnings[0]).toContain("Error desconocido");
      });
    });

    describe("integración con tools reales", () => {
      it("pasa tools al SDK con inputSchema correcto", async () => {
        const toolsArgCapture: unknown[] = [];
        mockGenerateText.mockImplementationOnce((async (opts: unknown) => {
          toolsArgCapture.push(opts);
          return {
            text: "Ok",
            finishReason: "stop",
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            toolCalls: [],
            toolResults: [],
            steps: [],
          };
        }) as unknown as typeof generateText);

        const adapter = new VercelSdkAdapter();
        const tools = [
          makeSdkTool("searchPartidas", "Busca partidas", z.object({ query: z.string() })),
          makeSdkTool("createBudget", "Crea presupuesto", z.object({ name: z.string(), projectId: z.string() })),
        ];

        await adapter.runLoop(
          makeLoopInput({
            provider: "openrouter",
            resolvedModel: "test",
            tools,
          })
        );

        expect(toolsArgCapture).toHaveLength(1);
        const opts = toolsArgCapture[0] as Record<string, unknown>;
        expect(opts.tools).toBeDefined();
        const passedTools = opts.tools as Record<string, { description: string; inputSchema: unknown }>;
        expect(passedTools.searchPartidas).toBeDefined();
        expect(passedTools.searchPartidas.description).toBe("Busca partidas");
        expect(passedTools.searchPartidas.inputSchema).toBeDefined();
        expect(passedTools.createBudget).toBeDefined();
      });
    });
  });
});
