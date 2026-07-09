import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolRegistry, createToolRegistry } from "./tool-registry";
import type { AgentToolDefinition } from "./types";

function makeTool(overrides: Partial<AgentToolDefinition> = {}): AgentToolDefinition {
  return {
    name: "testTool",
    description: "A test tool",
    risk: "read",
    requiresProjectId: false,
    inputSchema: z.object({ query: z.string() }),
    execute: async () => ({ result: "ok" }),
    ...overrides,
  };
}

describe("ToolRegistry", () => {
  describe("factory", () => {
    it("createToolRegistry devuelve una instancia", () => {
      const registry = createToolRegistry();
      expect(registry).toBeInstanceOf(ToolRegistry);
    });
  });

  describe("register", () => {
    it("registra una herramienta y la recupera por nombre", () => {
      const registry = new ToolRegistry();
      const tool = makeTool({ name: "searchPartidas" });
      registry.register(tool);
      expect(registry.get("searchPartidas")).toBe(tool);
    });

    it("lanza error al registrar tool con nombre duplicado", () => {
      const registry = new ToolRegistry();
      registry.register(makeTool({ name: "unique" }));
      expect(() => registry.register(makeTool({ name: "unique" }))).toThrow(
        "ya está registrada"
      );
    });

    it("permite registrar múltiples tools con distintos nombres", () => {
      const registry = new ToolRegistry();
      registry.register(makeTool({ name: "toolA", risk: "read" }));
      registry.register(makeTool({ name: "toolB", risk: "write" }));
      registry.register(makeTool({ name: "toolC", risk: "financial" }));
      expect(registry.list()).toHaveLength(3);
    });
  });

  describe("get", () => {
    it("retorna undefined para tool no registrada", () => {
      const registry = new ToolRegistry();
      expect(registry.get("nonexistent")).toBeUndefined();
    });

    it("retorna la tool correcta entre varias registradas", () => {
      const registry = new ToolRegistry();
      const toolA = makeTool({ name: "alpha" });
      const toolB = makeTool({ name: "beta" });
      registry.register(toolA);
      registry.register(toolB);
      expect(registry.get("alpha")).toBe(toolA);
      expect(registry.get("beta")).toBe(toolB);
    });
  });

  describe("list", () => {
    it("retorna array vacío cuando no hay tools", () => {
      const registry = new ToolRegistry();
      expect(registry.list()).toEqual([]);
    });

    it("retorna todas las tools registradas", () => {
      const registry = new ToolRegistry();
      registry.register(makeTool({ name: "a" }));
      registry.register(makeTool({ name: "b" }));
      registry.register(makeTool({ name: "c" }));
      expect(registry.list()).toHaveLength(3);
    });
  });

  describe("toSdkDefinitions", () => {
    it("convierte tools a formato Vercel AI SDK", () => {
      const registry = new ToolRegistry();
      registry.register(
        makeTool({
          name: "searchPartidas",
          description: "Busca partidas del catálogo",
          inputSchema: z.object({ query: z.string() }),
        })
      );

      const sdkDefs = registry.toSdkDefinitions();
      expect(sdkDefs).toHaveLength(1);
      expect(sdkDefs[0].name).toBe("searchPartidas");
      expect(sdkDefs[0].description).toBe("Busca partidas del catálogo");
      expect(sdkDefs[0].inputSchema).toBeDefined();
    });

    it("retorna array vacío cuando no hay tools", () => {
      const registry = new ToolRegistry();
      expect(registry.toSdkDefinitions()).toEqual([]);
    });
  });

  describe("listByRisk", () => {
    it("filtra tools por nivel de riesgo", () => {
      const registry = new ToolRegistry();
      registry.register(makeTool({ name: "read1", risk: "read" }));
      registry.register(makeTool({ name: "read2", risk: "read" }));
      registry.register(makeTool({ name: "write1", risk: "write" }));
      registry.register(makeTool({ name: "financial1", risk: "financial" }));

      expect(registry.listByRisk("read")).toHaveLength(2);
      expect(registry.listByRisk("write")).toHaveLength(1);
      expect(registry.listByRisk("financial")).toHaveLength(1);
      expect(registry.listByRisk("export")).toHaveLength(0);
    });
  });

  describe("listRequiringProject", () => {
    it("filtra tools que requieren projectId", () => {
      const registry = new ToolRegistry();
      registry.register(makeTool({ name: "noProject", requiresProjectId: false }));
      registry.register(makeTool({ name: "needsProject", requiresProjectId: true }));

      expect(registry.listRequiringProject()).toHaveLength(1);
      expect(registry.listRequiringProject()[0].name).toBe("needsProject");
    });
  });

  describe("getToolNames", () => {
    it("retorna nombres de todas las tools registradas", () => {
      const registry = new ToolRegistry();
      registry.register(makeTool({ name: "alpha" }));
      registry.register(makeTool({ name: "beta" }));
      expect(registry.getToolNames()).toEqual(["alpha", "beta"]);
    });
  });

  describe("has", () => {
    it("retorna true para tool registrada", () => {
      const registry = new ToolRegistry();
      registry.register(makeTool({ name: "exists" }));
      expect(registry.has("exists")).toBe(true);
    });

    it("retorna false para tool no registrada", () => {
      const registry = new ToolRegistry();
      expect(registry.has("ghost")).toBe(false);
    });
  });

  describe("integración con herramientas reales", () => {
    it("registra y recupera con tipos genéricos", () => {
      const registry = new ToolRegistry();
      const inputSchema = z.object({ budgetId: z.string(), name: z.string() });
      type Input = z.infer<typeof inputSchema>;

      const tool: AgentToolDefinition<Input, { created: boolean }> = {
        name: "createBudget",
        description: "Crea un presupuesto",
        risk: "write",
        requiresProjectId: true,
        inputSchema,
        execute: async (inp) => ({ created: true, name: inp.name }),
      };

      registry.register(tool);
      const retrieved = registry.get("createBudget");
      expect(retrieved).toBeDefined();
      expect(retrieved!.risk).toBe("write");
      expect(retrieved!.requiresProjectId).toBe(true);
    });
  });
});
