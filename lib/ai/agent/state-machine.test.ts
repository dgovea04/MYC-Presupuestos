import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  canTransition,
  isActive,
  isTerminal,
  requiresHumanAction,
  transition,
  AgentStateTransitionError,
} from "./state-machine";
import type { AgentExecutionState } from "./types";

const ALL_STATES: AgentExecutionState[] = [
  "READ",
  "PLAN",
  "PROPOSE",
  "SIMULATE",
  "PENDING_APPROVAL",
  "EXECUTING",
  "EXECUTED",
  "FAILED",
  "ROLLED_BACK",
];

describe("Agent State Machine", () => {
  describe("canTransition", () => {
    it("READ -> PLAN es válida", () => {
      expect(canTransition("READ", "PLAN")).toBe(true);
    });

    it("READ -> FAILED es válida", () => {
      expect(canTransition("READ", "FAILED")).toBe(true);
    });

    it("READ -> EXECUTING no es válida", () => {
      expect(canTransition("READ", "EXECUTING")).toBe(false);
    });

    it("PLAN -> PROPOSE es válida", () => {
      expect(canTransition("PLAN", "PROPOSE")).toBe(true);
    });

    it("PLAN -> EXECUTING no es válida", () => {
      expect(canTransition("PLAN", "EXECUTING")).toBe(false);
    });

    it("PROPOSE -> SIMULATE es válida", () => {
      expect(canTransition("PROPOSE", "SIMULATE")).toBe(true);
    });

    it("PROPOSE -> PENDING_APPROVAL no es válida (pasa por SIMULATE)", () => {
      expect(canTransition("PROPOSE", "PENDING_APPROVAL")).toBe(false);
    });

    it("SIMULATE -> PENDING_APPROVAL es válida", () => {
      expect(canTransition("SIMULATE", "PENDING_APPROVAL")).toBe(true);
    });

    it("SIMULATE -> EXECUTING es válida", () => {
      expect(canTransition("SIMULATE", "EXECUTING")).toBe(true);
    });

    it("PENDING_APPROVAL -> EXECUTING es válida", () => {
      expect(canTransition("PENDING_APPROVAL", "EXECUTING")).toBe(true);
    });

    it("PENDING_APPROVAL -> EXECUTED no es válida (pasa por EXECUTING)", () => {
      expect(canTransition("PENDING_APPROVAL", "EXECUTED")).toBe(false);
    });

    it("EXECUTING -> EXECUTED es válida", () => {
      expect(canTransition("EXECUTING", "EXECUTED")).toBe(true);
    });

    it("EXECUTING -> FAILED es válida", () => {
      expect(canTransition("EXECUTING", "FAILED")).toBe(true);
    });

    it("EXECUTING -> ROLLED_BACK es válida", () => {
      expect(canTransition("EXECUTING", "ROLLED_BACK")).toBe(true);
    });

    it("EXECUTED -> ROLLED_BACK es válida", () => {
      expect(canTransition("EXECUTED", "ROLLED_BACK")).toBe(true);
    });
  });

  describe("transition", () => {
    it("aplica transición válida y devuelve nuevo estado", () => {
      expect(transition("READ", "PLAN")).toBe("PLAN");
    });

    it("lanza AgentStateTransitionError en transición inválida", () => {
      expect(() => transition("READ", "EXECUTING")).toThrow(AgentStateTransitionError);
      expect(() => transition("FAILED", "READ")).toThrow(AgentStateTransitionError);
      expect(() => transition("ROLLED_BACK", "READ")).toThrow(AgentStateTransitionError);
    });

    it("el mensaje de error incluye los estados", () => {
      try {
        transition("EXECUTED", "EXECUTING");
        expect.fail("Debería haber lanzado");
      } catch (error) {
        expect(error).toBeInstanceOf(AgentStateTransitionError);
        expect((error as Error).message).toContain("EXECUTED");
        expect((error as Error).message).toContain("EXECUTING");
      }
    });
  });

  describe("terminal states", () => {
    it("FAILED es terminal", () => {
      expect(isTerminal("FAILED")).toBe(true);
    });

    it("ROLLED_BACK es terminal", () => {
      expect(isTerminal("ROLLED_BACK")).toBe(true);
    });

    it("READ no es terminal", () => {
      expect(isTerminal("READ")).toBe(false);
    });

    it("EXECUTED no es terminal (puede hacer ROLLED_BACK)", () => {
      expect(isTerminal("EXECUTED")).toBe(false);
    });
  });

  describe("isActive", () => {
    it("estados activos permiten continuar", () => {
      expect(isActive("READ")).toBe(true);
      expect(isActive("PLAN")).toBe(true);
      expect(isActive("PROPOSE")).toBe(true);
      expect(isActive("SIMULATE")).toBe(true);
      expect(isActive("EXECUTING")).toBe(true);
    });

    it("estados terminales no son activos", () => {
      expect(isActive("FAILED")).toBe(false);
      expect(isActive("ROLLED_BACK")).toBe(false);
    });

    it("EXECUTED es activo (permite rollback)", () => {
      expect(isActive("EXECUTED")).toBe(true);
    });

    it("PENDING_APPROVAL no es activo (espera intervención)", () => {
      expect(isActive("PENDING_APPROVAL")).toBe(false);
    });
  });

  describe("requiresHumanAction", () => {
    it("PENDING_APPROVAL requiere acción humana", () => {
      expect(requiresHumanAction("PENDING_APPROVAL")).toBe(true);
    });

    it("otros estados no requieren acción humana", () => {
      const otherStates = ALL_STATES.filter((s) => s !== "PENDING_APPROVAL");
      for (const state of otherStates) {
        expect(requiresHumanAction(state)).toBe(false);
      }
    });
  });

  describe("allowedTransitions", () => {
    it("READ permite ir a PLAN y FAILED", () => {
      expect(allowedTransitions("READ")).toEqual(["PLAN", "FAILED"]);
    });

    it("EXECUTING permite ir a EXECUTED, FAILED, ROLLED_BACK, PENDING_APPROVAL", () => {
      const allowed = allowedTransitions("EXECUTING");
      expect(allowed).toContain("EXECUTED");
      expect(allowed).toContain("FAILED");
      expect(allowed).toContain("ROLLED_BACK");
      expect(allowed).toContain("PENDING_APPROVAL");
    });

    it("FAILED no permite ninguna transición", () => {
      expect(allowedTransitions("FAILED")).toHaveLength(0);
    });
  });

  describe("Cobertura completa del roadmap de estados", () => {
    // Validar que TODAS las transiciones del PRD están cubiertas
    const expectedTransitions: [AgentExecutionState, AgentExecutionState[]][] = [
      ["READ", ["PLAN", "FAILED"]],
      ["PLAN", ["PROPOSE", "FAILED"]],
      ["PROPOSE", ["SIMULATE", "FAILED"]],
      ["SIMULATE", ["PENDING_APPROVAL", "EXECUTING", "FAILED"]],
      ["PENDING_APPROVAL", ["EXECUTING", "FAILED"]],
      ["EXECUTING", ["EXECUTED", "FAILED", "ROLLED_BACK", "PENDING_APPROVAL"]],
      ["EXECUTED", ["ROLLED_BACK"]],
      ["FAILED", []],
      ["ROLLED_BACK", []],
    ];

    for (const [from, expected] of expectedTransitions) {
      it(`${from} -> [${expected.join(", ") || "(ninguna)"}]`, () => {
        const actual = allowedTransitions(from);
        expect(actual.sort()).toEqual([...expected].sort());
      });
    }
  });
});
