import { describe, expect, it } from "vitest";
import { PolicyEngine, createPolicyEngine } from "./policy-engine";
import type { AgentExecutionMode, AgentToolRisk } from "./types";
import type { PolicyInput } from "./contracts";

function makePolicyInput(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    toolName: "testTool",
    toolRisk: "read",
    executionMode: "chat",
    userId: "user_1",
    ...overrides,
  };
}

describe("PolicyEngine", () => {
  describe("factory", () => {
    it("createPolicyEngine devuelve una instancia", () => {
      const engine = createPolicyEngine();
      expect(engine).toBeInstanceOf(PolicyEngine);
    });
  });

  describe("risk: read", () => {
    const modes: AgentExecutionMode[] = ["chat", "goal", "workflow"];

    for (const mode of modes) {
      it(`permitido sin aprobación en modo ${mode}`, () => {
        const engine = new PolicyEngine();
        const result = engine.evaluate(
          makePolicyInput({ toolRisk: "read", executionMode: mode })
        );
        expect(result.allowed).toBe(true);
        expect(result.approvalRequirement).toBe("none");
      });
    }
  });

  describe("risk: write", () => {
    it("requiere aprobación en modo chat", () => {
      const engine = new PolicyEngine();
      const result = engine.evaluate(
        makePolicyInput({ toolRisk: "write", executionMode: "chat" })
      );
      expect(result.allowed).toBe(true);
      expect(result.approvalRequirement).toBe("pre_execute");
      expect(result.policyReason).toContain("chat");
    });

    it("requiere aprobación en modo goal", () => {
      const engine = new PolicyEngine();
      const result = engine.evaluate(
        makePolicyInput({ toolRisk: "write", executionMode: "goal" })
      );
      expect(result.allowed).toBe(true);
      expect(result.approvalRequirement).toBe("pre_execute");
    });

    it("requiere aprobación en modo workflow", () => {
      const engine = new PolicyEngine();
      const result = engine.evaluate(
        makePolicyInput({ toolRisk: "write", executionMode: "workflow" })
      );
      expect(result.allowed).toBe(true);
      expect(result.approvalRequirement).toBe("pre_execute");
    });
  });

  describe("risk: financial", () => {
    it("siempre requiere aprobación independientemente del modo", () => {
      const engine = new PolicyEngine();
      const modes: AgentExecutionMode[] = ["chat", "goal", "workflow"];

      for (const mode of modes) {
        const result = engine.evaluate(
          makePolicyInput({ toolRisk: "financial", executionMode: mode })
        );
        expect(result.allowed).toBe(true);
        expect(result.approvalRequirement).toBe("pre_execute");
        expect(result.policyReason).toContain("financiera");
      }
    });
  });

  describe("risk: export", () => {
    it("permitido sin aprobación en modo chat (con auditoría)", () => {
      const engine = new PolicyEngine();
      const result = engine.evaluate(
        makePolicyInput({ toolRisk: "export", executionMode: "chat" })
      );
      expect(result.allowed).toBe(true);
      expect(result.approvalRequirement).toBe("none");
      expect(result.policyReason).toContain("auditoría");
    });

    it("requiere aprobación en modo goal", () => {
      const engine = new PolicyEngine();
      const result = engine.evaluate(
        makePolicyInput({ toolRisk: "export", executionMode: "goal" })
      );
      expect(result.allowed).toBe(true);
      expect(result.approvalRequirement).toBe("pre_execute");
    });

    it("requiere aprobación en modo workflow", () => {
      const engine = new PolicyEngine();
      const result = engine.evaluate(
        makePolicyInput({ toolRisk: "export", executionMode: "workflow" })
      );
      expect(result.allowed).toBe(true);
      expect(result.approvalRequirement).toBe("pre_execute");
    });
  });

  describe("búsqueda de herramientas (caso real)", () => {
    it("searchPartidas (read) no requiere aprobación", () => {
      const engine = new PolicyEngine();
      const result = engine.evaluate(
        makePolicyInput({
          toolName: "searchPartidas",
          toolRisk: "read",
          executionMode: "goal",
        })
      );
      expect(result.allowed).toBe(true);
      expect(result.approvalRequirement).toBe("none");
    });

    it("createBudget (write) requiere aprobación", () => {
      const engine = new PolicyEngine();
      const result = engine.evaluate(
        makePolicyInput({
          toolName: "createBudget",
          toolRisk: "write",
          executionMode: "goal",
        })
      );
      expect(result.allowed).toBe(true);
      expect(result.approvalRequirement).toBe("pre_execute");
    });

    it("archiveBudget (financial) siempre requiere aprobación", () => {
      const engine = new PolicyEngine();
      const result = engine.evaluate(
        makePolicyInput({
          toolName: "archiveBudget",
          toolRisk: "financial",
          executionMode: "chat",
        })
      );
      expect(result.allowed).toBe(true);
      expect(result.approvalRequirement).toBe("pre_execute");
    });

    it("exportPDF (export) requiere aprobación en modo goal", () => {
      const engine = new PolicyEngine();
      const result = engine.evaluate(
        makePolicyInput({
          toolName: "exportPDF",
          toolRisk: "export",
          executionMode: "goal",
        })
      );
      expect(result.allowed).toBe(true);
      expect(result.approvalRequirement).toBe("pre_execute");
    });
  });

  describe("herramienta fuera de registry", () => {
    it("el policy engine evalúa cualquier tool por nombre, sin consultar registry", () => {
      const engine = new PolicyEngine();
      const result = engine.evaluate(
        makePolicyInput({
          toolName: "nonExistentTool",
          toolRisk: "read",
          executionMode: "chat",
        })
      );
      // El policy engine evalúa por riesgo, no por existencia en registry
      expect(result.allowed).toBe(true);
      expect(result.approvalRequirement).toBe("none");
    });
  });

  describe("policyReason es descriptivo", () => {
    it("incluye el nombre de la tool en el reason", () => {
      const engine = new PolicyEngine();
      const result = engine.evaluate(
        makePolicyInput({
          toolName: "calculateBudget",
          toolRisk: "read",
          executionMode: "chat",
        })
      );
      expect(result.policyReason).toContain("calculateBudget");
    });

    it("policyReason no está vacío para ningún caso", () => {
      const engine = new PolicyEngine();
      const risks: AgentToolRisk[] = ["read", "write", "financial", "export"];
      const modes: AgentExecutionMode[] = ["chat", "goal", "workflow"];

      for (const risk of risks) {
        for (const mode of modes) {
          const result = engine.evaluate(
            makePolicyInput({ toolRisk: risk, executionMode: mode })
          );
          expect(result.policyReason.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
