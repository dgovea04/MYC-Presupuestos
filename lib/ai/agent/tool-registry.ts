import type { z } from "zod";
import type {
  AgentSdkToolDefinition,
  AgentToolDefinition,
} from "./types";
import type { AgentToolRegistry } from "./contracts";

/**
 * Tool Registry — fuente de verdad de herramientas disponibles.
 *
 * Responsabilidades:
 * - Registrar herramientas con nombre, Zod schema, riesgo y execute
 * - Buscar herramientas por nombre
 * - Listar todas las herramientas registradas
 * - Convertir a formato Vercel AI SDK (AgentSdkToolDefinition)
 */
export class ToolRegistry implements AgentToolRegistry {
  private readonly tools: Map<string, AgentToolDefinition> = new Map();

  register<TInput, TResult>(tool: AgentToolDefinition<TInput, TResult>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" ya está registrada. Cada tool debe tener un nombre único.`);
    }
    this.tools.set(tool.name, tool as AgentToolDefinition);
  }

  get(name: string): AgentToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): AgentToolDefinition[] {
    return Array.from(this.tools.values());
  }

  toSdkDefinitions(): AgentSdkToolDefinition[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as z.ZodType<Record<string, unknown>>,
    }));
  }

  /**
   * Filtra herramientas por nivel de riesgo.
   */
  listByRisk(risk: AgentToolDefinition["risk"]): AgentToolDefinition[] {
    return this.list().filter((tool) => tool.risk === risk);
  }

  /**
   * Filtra herramientas que requieren projectId.
   */
  listRequiringProject(): AgentToolDefinition[] {
    return this.list().filter((tool) => tool.requiresProjectId);
  }

  /**
   * Retorna los nombres de todas las herramientas registradas.
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Verifica si una herramienta está registrada.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }
}

/**
 * Factory function.
 */
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}
