import type { AgentExecutionState } from "./types";

/**
 * Mapa de transiciones válidas entre estados de ejecución agentica.
 *
 * Cada estado origen mapea a los estados destino permitidos.
 * Cualquier transición no listada aquí se considera inválida.
 */
const VALID_TRANSITIONS: ReadonlyMap<AgentExecutionState, ReadonlySet<AgentExecutionState>> = new Map([
  ["READ", new Set<AgentExecutionState>(["PLAN", "FAILED"])],
  ["PLAN", new Set<AgentExecutionState>(["PROPOSE", "FAILED"])],
  ["PROPOSE", new Set<AgentExecutionState>(["SIMULATE", "FAILED"])],
  ["SIMULATE", new Set<AgentExecutionState>(["PENDING_APPROVAL", "EXECUTING", "FAILED"])],
  ["PENDING_APPROVAL", new Set<AgentExecutionState>(["EXECUTING", "FAILED"])],
  ["EXECUTING", new Set<AgentExecutionState>(["EXECUTED", "FAILED", "ROLLED_BACK", "PENDING_APPROVAL"])],
  ["EXECUTED", new Set<AgentExecutionState>(["ROLLED_BACK"])],
  ["FAILED", new Set<AgentExecutionState>([])],
  ["ROLLED_BACK", new Set<AgentExecutionState>([])],
]);

/**
 * Verifica si una transición entre dos estados es válida.
 */
export function canTransition(from: AgentExecutionState, to: AgentExecutionState): boolean {
  const targets = VALID_TRANSITIONS.get(from);
  return targets !== undefined && targets.has(to);
}

/**
 * Aplica una transición de estado. Lanza si la transición es inválida.
 */
export function transition(from: AgentExecutionState, to: AgentExecutionState): AgentExecutionState {
  if (!canTransition(from, to)) {
    throw new AgentStateTransitionError(from, to);
  }
  return to;
}

/**
 * Obtiene los estados destino permitidos desde un estado origen.
 */
export function allowedTransitions(from: AgentExecutionState): readonly AgentExecutionState[] {
  const targets = VALID_TRANSITIONS.get(from);
  return targets ? Array.from(targets) : [];
}

/**
 * Verifica si un estado es terminal (no permite más transiciones).
 */
export function isTerminal(state: AgentExecutionState): boolean {
  const targets = VALID_TRANSITIONS.get(state);
  return targets !== undefined && targets.size === 0;
}

/**
 * Verifica si un estado permite continuar la ejecución.
 */
export function isActive(state: AgentExecutionState): boolean {
  return !isTerminal(state) && state !== "PENDING_APPROVAL";
}

/**
 * Verifica si un estado requiere intervención humana.
 */
export function requiresHumanAction(state: AgentExecutionState): boolean {
  return state === "PENDING_APPROVAL";
}

export class AgentStateTransitionError extends Error {
  constructor(from: AgentExecutionState, to: AgentExecutionState) {
    super(`Transición inválida: ${from} -> ${to}`);
    this.name = "AgentStateTransitionError";
  }
}
