import { z } from "zod";

/**
 * Estados canónicos del ciclo de vida de una ejecución agentica.
 *
 * - READ: entender objetivo y contexto
 * - PLAN: construir secuencia de trabajo
 * - PROPOSE: presentar o fijar plan
 * - SIMULATE: evaluar tools y impactos antes de escribir
 * - PENDING_APPROVAL: esperar decisión humana
 * - EXECUTING: correr steps autorizados
 * - EXECUTED: finalizado
 * - FAILED: fallo terminal
 * - ROLLED_BACK: se revirtió una ejecución o parte crítica
 */
export type AgentExecutionState =
  | "READ"
  | "PLAN"
  | "PROPOSE"
  | "SIMULATE"
  | "PENDING_APPROVAL"
  | "EXECUTING"
  | "EXECUTED"
  | "FAILED"
  | "ROLLED_BACK";

/** Modo de ejecución del agente. */
export type AgentExecutionMode = "chat" | "goal" | "workflow";

/** Nivel de riesgo de una herramienta agentica. */
export type AgentToolRisk = "read" | "write" | "financial" | "export";

/** Requerimiento de aprobación para una herramienta. */
export type ApprovalRequirement = "none" | "pre_execute" | "per_step";

/** Decisión de aprobación (aprueba o rechaza). */
export type ApprovalDecision = "approve" | "reject";

/** Estado de un step individual dentro de una ejecución. */
export type AgentStepStatus = "pending" | "awaiting_approval" | "running" | "completed" | "failed" | "skipped";

export const AGENT_EXECUTION_STATE_VALUES: readonly AgentExecutionState[] = [
  "READ",
  "PLAN",
  "PROPOSE",
  "SIMULATE",
  "PENDING_APPROVAL",
  "EXECUTING",
  "EXECUTED",
  "FAILED",
  "ROLLED_BACK",
] as const;

export const AGENT_EXECUTION_MODE_VALUES: readonly AgentExecutionMode[] = [
  "chat",
  "goal",
  "workflow",
] as const;

export const AGENT_TOOL_RISK_VALUES: readonly AgentToolRisk[] = [
  "read",
  "write",
  "financial",
  "export",
] as const;

export const APPROVAL_REQUIREMENT_VALUES: readonly ApprovalRequirement[] = [
  "none",
  "pre_execute",
  "per_step",
] as const;

export const APPROVAL_DECISION_VALUES: readonly ApprovalDecision[] = [
  "approve",
  "reject",
] as const;

export const AGENT_STEP_STATUS_VALUES: readonly AgentStepStatus[] = [
  "pending",
  "awaiting_approval",
  "running",
  "completed",
  "failed",
  "skipped",
] as const;

// ─── Zod schemas ────────────────────────────────────────────────────────────

export const agentExecutionStateSchema = z.enum(AGENT_EXECUTION_STATE_VALUES);
export const agentExecutionModeSchema = z.enum(AGENT_EXECUTION_MODE_VALUES);
export const agentToolRiskSchema = z.enum(AGENT_TOOL_RISK_VALUES);
export const approvalRequirementSchema = z.enum(APPROVAL_REQUIREMENT_VALUES);
export const approvalDecisionSchema = z.enum(APPROVAL_DECISION_VALUES);
export const agentStepStatusSchema = z.enum(AGENT_STEP_STATUS_VALUES);

// ─── Runtime types ──────────────────────────────────────────────────────────

/** Contexto que recibe cada herramienta al ejecutarse. */
export type AgentToolContext = {
  userId: string;
  projectId?: string;
  workspaceId?: string;
  executionId: string;
  stepId?: string;
  /** Último mensaje del usuario en la conversación (para fallback cuando el modelo no pasa todos los args). */
  lastUserMessage?: string;
  /** Todos los mensajes de la conversación actual. Útil para herramientas que necesitan buscar contexto en mensajes anteriores. */
  messages?: Array<{ role: string; content: string }>;
};

/** Definición canónica de una herramienta agentica. */
export type AgentToolDefinition<TInput = unknown, TResult = unknown> = {
  name: string;
  description: string;
  risk: AgentToolRisk;
  requiresProjectId: boolean;
  inputSchema: z.ZodType<TInput>;
  supportsRollback?: boolean;
  execute: (input: TInput, context: AgentToolContext) => Promise<TResult>;
  summarizeResult?: (result: TResult) => string;
};

/** Paso planificado por el planner. */
export type PlannedStep = {
  id: string;
  title: string;
  toolName?: string;
  objective: string;
  expectedOutcome: string;
  dependsOn: string[];
  approvalBoundary: boolean;
};

/** Request de entrada al Agent Orchestrator. */
export type RunAgentRequest = {
  userId: string;
  projectId?: string;
  message: string;
  mode: AgentExecutionMode;
  workflowId?: string;
  executionId?: string;
};

/** Resultado del policy engine. */
export type PolicyDecision = {
  allowed: boolean;
  approvalRequirement: ApprovalRequirement;
  policyReason: string;
};

/** Definición de tool para el Vercel AI SDK. */
export type AgentSdkToolDefinition = {
  name: string;
  description: string;
  inputSchema: z.ZodType<Record<string, unknown>>;
};

/** Tool call solicitada por el modelo. */
export type AgentToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

/** Resultado resumido enviado de vuelta al modelo como tool message. */
export type AgentToolResult = {
  toolCallId: string;
  output: string;
};

/** Respuesta consolidada del orchestrator para la UI. */
export type AgentOrchestratorOutput = {
  executionId: string;
  state: AgentExecutionState;
  mode: AgentExecutionMode;
  summary: string;
  plan: PlannedStep[];
  completedSteps: PlannedStep[];
  failedSteps: PlannedStep[];
  pendingApproval?: {
    approvalId: string;
    /** Nombre de la herramienta que requiere aprobación. */
    toolName?: string;
    stepId?: string;
    reason: string;
    /** Resumen legible del impacto esperado: qué proyecto/presupuesto/entidad se vería afectada. */
    impactSummary?: string;
  };
  toolActivity: AgentToolActivitySummary[];
  warnings: string[];
};

/** Resumen de actividad de tool para UI. */
export type AgentToolActivitySummary = {
  toolName: string;
  success: boolean;
  latencyMs?: number;
  summary: string;
};

// ─── DB enums (matching Prisma) ─────────────────────────────────────────────

export type AgentExecutionStateDb = AgentExecutionState;
export type AgentExecutionModeDb = AgentExecutionMode;
export type AgentToolRiskDb = AgentToolRisk;
export type AgentStepStatusDb = AgentStepStatus;
export type ApprovalDecisionDb = ApprovalDecision;

// ─── Limits ─────────────────────────────────────────────────────────────────

export const AGENT_LIMITS = {
  /** Máximo de tool calls por ejecución. */
  maxToolCalls: 8,
  /** Máximo de repropuestas consecutivas del plan. */
  maxReplans: 3,
  /** Máximo de reintentos por tool. */
  maxRetriesPerTool: 2,
} as const;
