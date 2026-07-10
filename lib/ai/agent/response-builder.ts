import type { AgentOrchestratorOutput, PlannedStep } from "./types";
import type { AgentResponseBuilder } from "./contracts";

/**
 * Response Builder — convierte el ledger interno en una respuesta legible para UI.
 *
 * Responsabilidades:
 * - Validar que la estructura de salida sea consistente
 * - Enriquecer el summary con descripciones legibles por estado
 * - Agregar resumen ejecutivo basado en el estado actual
 * - Enriquecer pasos completados/fallidos con descripciones de estado
 * - Agregar impacto esperado en aprobaciones pendientes cuando falte
 */
export class ResponseBuilder implements AgentResponseBuilder {
  /**
   * Construye una respuesta enriquecida a partir del output interno del orchestrator.
   * El output raw (plan, completedSteps, failedSteps, toolActivity, warnings) se preserva
   * y se enriquece con metadatos legibles para la UI.
   */
  build(params: AgentOrchestratorOutput): AgentOrchestratorOutput {
    const enrichedSummary = this.buildSummary(params);
    const enrichedPendingApproval = this.enrichPendingApproval(params);
    const enrichedWarnings = this.enrichWarnings(params);

    return {
      ...params,
      summary: enrichedSummary,
      pendingApproval: enrichedPendingApproval,
      warnings: enrichedWarnings,
    };
  }

  /**
   * Genera un resumen ejecutivo legible basado en el estado actual,
   * número de pasos completados/fallidos y contexto de aprobación.
   */
  private buildSummary(params: AgentOrchestratorOutput): string {
    const { state, summary, plan, completedSteps, failedSteps, pendingApproval, toolActivity } = params;

    // Si ya hay un summary personalizado y no es genérico, preservarlo
    if (summary && !summary.startsWith("Plan ") && !summary.startsWith("Herramienta ") && !summary.startsWith("Todos los ")) {
      return summary;
    }

    const totalSteps = plan.length;
    const completed = completedSteps.length;
    const failed = failedSteps.length;

    switch (state) {
      case "READ":
        return "Analizando objetivo y contexto del proyecto...";
      case "PLAN":
        return `Plan generado con ${totalSteps} paso${totalSteps !== 1 ? "s" : ""}.`;
      case "PROPOSE":
        return `Plan propuesto: ${totalSteps} paso${totalSteps !== 1 ? "s" : ""}. Revisando viabilidad.`;
      case "SIMULATE":
        return `Simulando ejecución de ${totalSteps} paso${totalSteps !== 1 ? "s" : ""}.`;
      case "PENDING_APPROVAL":
        if (pendingApproval) {
          const toolsInPlan = plan.filter((s) => s.toolName).length;
          return `⏸️ Ejecución pausada — requiere aprobación para "${pendingApproval.toolName ?? "acción"}" (${toolsInPlan} herramienta${toolsInPlan !== 1 ? "s" : ""} en el plan).`;
        }
        return "⏸️ Ejecución pausada — esperando decisión del usuario.";
      case "EXECUTING": {
        const inProgress = toolActivity.filter((a) => a.latencyMs === undefined).length;
        if (inProgress > 0) {
          return `▶️ Ejecutando ${inProgress} herramienta${inProgress !== 1 ? "s" : ""}...`;
        }
        return "▶️ Ejecutando pasos del plan...";
      }
      case "EXECUTED": {
        const parts: string[] = [];
        if (completed > 0) parts.push(`${completed} paso${completed !== 1 ? "s" : ""} completado${completed !== 1 ? "s" : ""}`);
        if (failed > 0) parts.push(`${failed} paso${failed !== 1 ? "s" : ""} fallido${failed !== 1 ? "s" : ""}`);
        if (parts.length === 0) parts.push("sin pasos ejecutados");
        return `✅ Ejecución completada: ${parts.join(", ")}.`;
      }
      case "FAILED": {
        const errorSteps = failed > 0 ? `${failed} paso${failed !== 1 ? "s" : ""} fallido${failed !== 1 ? "s" : ""}` : "error en el plan";
        return `❌ Ejecución fallida — ${errorSteps}.${summary ? ` ${summary}` : ""}`;
      }
      case "ROLLED_BACK": {
        const rolledBackSteps = failed > 0 ? ` (${failed} paso${failed !== 1 ? "s" : ""} revertido${failed !== 1 ? "s" : ""})` : "";
        return `↩️ Ejecución revertida${rolledBackSteps}.`;
      }
      default:
        return summary || "Ejecución en progreso.";
    }
  }

  /**
   * Enriquece la aprobación pendiente con un resumen de impacto legible
   * (qué entidad/proyecto/presupuesto se vería afectado).
   */
  private enrichPendingApproval(
    params: AgentOrchestratorOutput,
  ): AgentOrchestratorOutput["pendingApproval"] {
    const { pendingApproval, plan } = params;

    if (!pendingApproval) return undefined;

    // Si ya tiene impactSummary, preservarlo
    if (pendingApproval.impactSummary) return pendingApproval;

    // Buscar el step asociado para generar impacto
    if (pendingApproval.stepId) {
      const step = plan.find((s) => s.id === pendingApproval.stepId);
      if (step) {
        return {
          ...pendingApproval,
          impactSummary: this.buildImpactSummary(step, pendingApproval),
        };
      }
    }

    // Si no hay stepId, buscar por toolName en el plan
    if (pendingApproval.toolName) {
      const toolStep = plan.find((s) => s.toolName === pendingApproval.toolName);
      if (toolStep) {
        return {
          ...pendingApproval,
          impactSummary: this.buildImpactSummary(toolStep, pendingApproval),
        };
      }
    }

    return pendingApproval;
  }

  /**
   * Construye un texto legible del impacto esperado de la aprobación.
   */
  private buildImpactSummary(
    step: PlannedStep,
    _pendingApproval: NonNullable<AgentOrchestratorOutput["pendingApproval"]>,
  ): string {
    const lines: string[] = [];

    lines.push(`Paso: "${step.title}"`);
    if (step.objective) {
      lines.push(`Objetivo: ${step.objective}`);
    }
    if (step.expectedOutcome) {
      lines.push(`Resultado esperado: ${step.expectedOutcome}`);
    }
    if (step.dependsOn.length > 0) {
      lines.push(`Depende de ${step.dependsOn.length} paso${step.dependsOn.length !== 1 ? "s" : ""} previo${step.dependsOn.length !== 1 ? "s" : ""}.`);
    }

    return lines.join("\n");
  }

  /**
   * Enriquece los warnings con contexto adicional cuando sea posible.
   * Preserva los warnings originales y agrega contexto según el estado.
   */
  private enrichWarnings(params: AgentOrchestratorOutput): string[] {
    const { warnings, state, failedSteps, plan } = params;
    const enriched = [...warnings];

    // Agregar warning si hay steps con dependencias no resueltas
    if (state === "EXECUTED" || state === "FAILED") {
      const skippedWithDeps = plan.filter(
        (s) => s.dependsOn.length > 0 && !failedSteps.some((f) => f.id === s.id),
      );
      if (skippedWithDeps.length > 0 && !warnings.some((w) => w.includes("dependencias no satisfechas"))) {
        enriched.push(
          `${skippedWithDeps.length} paso${skippedWithDeps.length !== 1 ? "s" : ""} con dependencias en el plan.`,
        );
      }
    }

    // Si el estado terminal y no hay warnings, agregar nota informativa
    if ((state === "EXECUTED" || state === "FAILED") && enriched.length === 0) {
      if (failedSteps.length > 0) {
        enriched.push(
          `${failedSteps.length} paso${failedSteps.length !== 1 ? "s" : ""} fallido${failedSteps.length !== 1 ? "s" : ""} durante la ejecución.`,
        );
      }
    }

    return enriched;
  }
}

/**
 * Factory function para crear una instancia de ResponseBuilder.
 */
export function createResponseBuilder(): AgentResponseBuilder {
  return new ResponseBuilder();
}
