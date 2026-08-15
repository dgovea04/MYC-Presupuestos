import type { AgentPolicyEngine, PolicyInput, PolicyOutput } from "./contracts";

/**
 * Policy Engine — decisiones de seguridad y gobernanza.
 *
 * Reglas mínimas:
 * - Lectura simple (risk=read): ejecución directa, sin aprobación
 * - Escritura draft (risk=write): requiere aprobación pre_execute en modo goal/workflow
 * - Cambios financieros (risk=financial): siempre requiere aprobación pre_execute
 * - Exportaciones (risk=export): permitidas con auditoría, sin aprobación en modo chat,
 *   con aprobación pre_execute en modo goal/workflow
 */
export class PolicyEngine implements AgentPolicyEngine {
  evaluate(params: PolicyInput): PolicyOutput {
    const { toolName, toolRisk, executionMode } = params;
    const isChatMode = executionMode === "chat";

    switch (toolRisk) {
      case "read":
        return this.allow(toolName, "Lectura de datos — no requiere aprobación.");

      case "write":
        if (isChatMode) {
          return this.allow(
            toolName,
            "Escritura en modo chat — el usuario está conversando activamente, no requiere aprobación adicional."
          );
        }
        // isGoalOrWorkflow cubre todos los modos restantes
        return this.requireApproval(
          toolName,
          "Escritura de datos — requiere aprobación antes de ejecutar."
        );

      case "financial":
        return this.requireApproval(
          toolName,
          "Operación financiera — siempre requiere aprobación explícita."
        );

      case "export":
        if (isChatMode) {
          return this.allow(toolName, "Exportación en modo chat — permitida con auditoría.");
        }
        // isGoalOrWorkflow cubre todos los modos restantes
        return this.requireApproval(
          toolName,
          "Exportación en modo goal/workflow — requiere aprobación antes de ejecutar."
        );

      default:
        return this.deny(toolName, `Riesgo "${toolRisk}" no reconocido.`);
    }
  }

  private allow(toolName: string, reason: string): PolicyOutput {
    return {
      allowed: true,
      approvalRequirement: "none",
      policyReason: `[${toolName}] ${reason}`,
    };
  }

  private requireApproval(toolName: string, reason: string): PolicyOutput {
    return {
      allowed: true,
      approvalRequirement: "pre_execute",
      policyReason: `[${toolName}] ${reason}`,
    };
  }

  private deny(toolName: string, reason: string): PolicyOutput {
    return {
      allowed: false,
      approvalRequirement: "none",
      policyReason: `[${toolName}] ${reason}`,
    };
  }
}

/**
 * Factory function.
 */
export function createPolicyEngine(): PolicyEngine {
  return new PolicyEngine();
}
