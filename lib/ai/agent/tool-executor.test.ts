import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "./tool-registry";
import { PolicyEngine } from "./policy-engine";
import { ToolExecutor, createToolExecutor } from "./tool-executor";
import type { AgentToolDefinition, AgentToolCall } from "./types";
import type { ToolExecutorInput } from "./contracts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToolCall(overrides: Partial<AgentToolCall> = {}): AgentToolCall {
  return {
    id: "call_1",
    name: "searchPartidas",
    arguments: { query: "concreto" },
    ...overrides,
  };
}

function makeExecutorInput(
  overrides: Partial<ToolExecutorInput> = {}
): ToolExecutorInput {
  return {
    toolCall: makeToolCall(),
    userId: "user_1",
    executionId: "exec_1",
    mode: "chat",
    ...overrides,
  };
}

function setupExecutor() {
  const registry = new ToolRegistry();
  const policy = new PolicyEngine();
  const executor = new ToolExecutor(registry, policy);
  return { registry, policy, executor };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ToolExecutor", () => {
  describe("factory", () => {
    it("createToolExecutor devuelve una instancia", () => {
      const registry = new ToolRegistry();
      const policy = new PolicyEngine();
      const executor = createToolExecutor(registry, policy);
      expect(executor).toBeInstanceOf(ToolExecutor);
    });
  });

  describe("herramienta no registrada", () => {
    it("retorna error cuando la tool no existe en el registry", async () => {
      const { executor } = setupExecutor();
      const input = makeExecutorInput({
        toolCall: makeToolCall({ name: "nonExistent" }),
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(false);
      expect(output.toolResult.output).toContain("no encontrada");
      expect(output.summary).toContain("no registrada");
    });
  });

  describe("validación Zod", () => {
    it("retorna error cuando el input no cumple el schema", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "searchPartidas",
        description: "test",
        risk: "read",
        requiresProjectId: false,
        inputSchema: z.object({ query: z.string().min(1) }),
        execute: async () => ({ ok: true }),
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({
          name: "searchPartidas",
          arguments: { query: "" }, // vacío → no pasa .min(1)
        }),
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(false);
      expect(output.toolResult.output).toContain("Error de validación");
    });

    it("retorna error cuando falta un campo requerido", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "calculate",
        description: "test",
        risk: "read",
        requiresProjectId: false,
        inputSchema: z.object({ budgetId: z.string(), amount: z.number() }),
        execute: async () => ({ ok: true }),
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({
          name: "calculate",
          arguments: { budgetId: "b1" }, // falta amount
        }),
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(false);
      expect(output.toolResult.output).toContain("Error de validación");
    });

    it("incluye el nombre del campo inválido en el summary", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "createProject",
        description: "Crea proyecto",
        risk: "write",
        requiresProjectId: false,
        inputSchema: z.object({
          name: z.string().min(3),
          companyId: z.string().min(1),
        }),
        execute: async () => ({ id: "p1" }),
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({
          name: "createProject",
          arguments: {}, // vacío: faltan name y companyId
        }),
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(false);
      // El summary debe incluir el nombre de la tool y los campos que fallaron
      expect(output.summary).toContain("createProject");
      expect(output.summary).toContain("recibió input inválido");
      expect(output.summary).toContain("name");
      expect(output.summary).toContain("companyId");
    });

    it("incluye el nombre del campo con tipo incorrecto en el summary", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "validateType",
        description: "test",
        risk: "read",
        requiresProjectId: false,
        inputSchema: z.object({ value: z.number() }),
        execute: async () => ({ ok: true }),
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({
          name: "validateType",
          arguments: { value: "no-es-numero" },
        }),
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(false);
      // El campo 'value' debe aparecer en el summary con su mensaje de error
      expect(output.summary).toContain("validateType");
      expect(output.summary).toContain("recibió input inválido");
      expect(output.summary).toContain("value");
      expect(output.summary).toContain("expected number");
    });

    it("muestra '(raíz)' cuando el input no es un objeto (path vacío)", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "expectsObject",
        description: "test",
        risk: "read",
        requiresProjectId: false,
        inputSchema: z.object({ name: z.string() }),
        execute: async () => ({ ok: true }),
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({
          name: "expectsObject",
          // Forzamos un tipo incorrecto en la raíz para probar el path (raíz)
          arguments: "no-soy-un-objeto" as unknown as Record<string, unknown>,
        }),
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(false);
      // Cuando el path está vacío, se muestra "(raíz)"
      expect(output.summary).toContain("(raíz)");
      expect(output.summary).toContain("recibió input inválido");
      expect(output.summary).toContain("expected object");
    });

    it("incluye detalles de validación tanto en output como en summary", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "createBudget",
        description: "Crea presupuesto",
        risk: "write",
        requiresProjectId: false,
        inputSchema: z.object({
          name: z.string().min(3),
          projectId: z.string().min(1),
          currency: z.enum(["PEN", "USD"]),
        }),
        execute: async () => ({ budgetId: "b1" }),
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({
          name: "createBudget",
          arguments: { name: "ab", currency: "EUR" },
          // falta projectId, name muy corto, currency inválida
        }),
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(false);
      // output debe tener los detalles
      expect(output.toolResult.output).toContain("Error de validación");
      expect(output.toolResult.output).toContain("projectId");
      expect(output.toolResult.output).toContain("name");
      expect(output.toolResult.output).toContain("currency");
      // summary también debe tener los detalles
      expect(output.summary).toContain("createBudget");
      expect(output.summary).toContain("recibió input inválido");
      expect(output.summary).toContain("projectId");
      expect(output.summary).toContain("name");
      expect(output.summary).toContain("currency");
    });
  });

  describe("projectId requerido", () => {
    it("retorna error cuando la tool requiere projectId y no se proporciona", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "createChapter",
        description: "test",
        risk: "write",
        requiresProjectId: true,
        inputSchema: z.object({ name: z.string() }),
        execute: async () => ({ created: true }),
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({
          name: "createChapter",
          arguments: { name: "Estructuras" },
        }),
        // projectId no definido
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(false);
      expect(output.toolResult.output).toContain("requiere un projectId");
    });

    it("procede cuando projectId está presente", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "createChapter",
        description: "test",
        risk: "write",
        requiresProjectId: true,
        inputSchema: z.object({ name: z.string() }),
        execute: async () => ({ created: true }),
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({
          name: "createChapter",
          arguments: { name: "Estructuras" },
        }),
        projectId: "project_1",
      });

      const output = await executor.execute(input);
      // write risk → requiere aprobación → success=false con approvalRequired
      expect(output.success).toBe(false);
      expect(output.approvalRequired).toBeDefined();
      expect(output.approvalRequired!.toolName).toBe("createChapter");
    });
  });

  describe("policy engine - aprobación requerida", () => {
    it("señaliza approvalRequired para tools de escritura", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "createBudget",
        description: "Crea presupuesto",
        risk: "write",
        requiresProjectId: false,
        inputSchema: z.object({ name: z.string() }),
        execute: async () => ({ budgetId: "new_1" }),
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({
          name: "createBudget",
          arguments: { name: "Hospital" },
        }),
        mode: "goal",
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(false);
      expect(output.approvalRequired).toBeDefined();
      expect(output.approvalRequired!.toolName).toBe("createBudget");
      expect(output.approvalRequired!.reason).toContain("aprobación");
    });

    it("señaliza approvalRequired para tools financieras", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "archiveBudget",
        description: "Archiva presupuesto",
        risk: "financial",
        requiresProjectId: false,
        inputSchema: z.object({ budgetId: z.string() }),
        execute: async () => ({ archived: true }),
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({
          name: "archiveBudget",
          arguments: { budgetId: "b1" },
        }),
        mode: "chat",
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(false);
      expect(output.approvalRequired).toBeDefined();
    });
  });

  describe("ejecución exitosa sin aprobación", () => {
    it("ejecuta tool de lectura y retorna resultado", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "searchPartidas",
        description: "Busca partidas",
        risk: "read",
        requiresProjectId: false,
        inputSchema: z.object({ query: z.string() }),
        execute: async (input) => ({
          query: input.query,
          results: [{ id: "p1", description: "Concreto f'c=210 kg/cm2" }],
          matchCount: 1,
        }),
        summarizeResult: (r) => `${r.matchCount} resultados para "${r.query}"`,
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({
          name: "searchPartidas",
          arguments: { query: "concreto" },
        }),
        mode: "chat",
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(true);
      expect(output.toolResult.output).toContain("p1");
      expect(output.summary).toContain("1 resultados");
      expect(output.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("usa summarizeResult cuando está definido", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "calculateBudget",
        description: "Calcula",
        risk: "read",
        requiresProjectId: false,
        inputSchema: z.object({ budgetId: z.string() }),
        execute: async () => ({ totalAmount: 50000, name: "Test" }),
        summarizeResult: (r) => `Total: ${r.totalAmount}`,
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({
          name: "calculateBudget",
          arguments: { budgetId: "b1" },
        }),
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(true);
      expect(output.summary).toBe("Total: 50000");
    });

    it("usa summary por defecto cuando no hay summarizeResult", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "searchInsumos",
        description: "Busca insumos",
        risk: "read",
        requiresProjectId: false,
        inputSchema: z.object({ query: z.string() }),
        execute: async () => ({ matchCount: 5 }),
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({
          name: "searchInsumos",
          arguments: { query: "cemento" },
        }),
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(true);
      expect(output.summary).toContain("ejecutada exitosamente");
    });

    it("mide latencia de ejecución", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "quickTask",
        description: "Tarea rápida",
        risk: "read",
        requiresProjectId: false,
        inputSchema: z.object({}),
        execute: async () => ({ done: true }),
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({ name: "quickTask", arguments: {} }),
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(true);
      expect(output.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("errores en la ejecución de la tool", () => {
    it("captura errores lanzados por tool.execute", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "riskyOperation",
        description: "Puede fallar",
        risk: "read",
        requiresProjectId: false,
        inputSchema: z.object({}),
        execute: async () => {
          throw new Error("Conexión a la base de datos fallida");
        },
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({ name: "riskyOperation", arguments: {} }),
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(false);
      expect(output.toolResult.output).toContain("Conexión a la base de datos fallida");
      expect(output.summary).toContain("Conexión a la base de datos fallida");
    });

    it("captura throw de valores no-Error", async () => {
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "weirdError",
        description: "Lanza string",
        risk: "read",
        requiresProjectId: false,
        inputSchema: z.object({}),
        execute: async () => {
          // eslint-disable-next-line no-throw-literal
          throw "fallo crudo";
        },
      });

      const input = makeExecutorInput({
        toolCall: makeToolCall({ name: "weirdError", arguments: {} }),
      });

      const output = await executor.execute(input);
      expect(output.success).toBe(false);
      expect(output.toolResult.output).toContain("Error desconocido");
    });
  });

  describe("policy engine - denegación", () => {
    it("el policy engine nunca deniega con los riesgos válidos", async () => {
      // El PolicyEngine nunca retorna allowed=false para los 4 riesgos válidos.
      // Esto se verifica con los tests del policy-engine.test.ts.
      const { registry, executor } = setupExecutor();
      registry.register({
        name: "testTool",
        description: "test",
        risk: "read",
        requiresProjectId: false,
        inputSchema: z.object({}),
        execute: async () => ({ ok: true }),
      });

      const output = await executor.execute(
        makeExecutorInput({
          toolCall: makeToolCall({ name: "testTool", arguments: {} }),
        })
      );
      expect(output.success).toBe(true);
    });
  });
});
