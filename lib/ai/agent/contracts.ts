import type {
  AgentExecutionMode,
  AgentExecutionState,
  AgentOrchestratorOutput,
  AgentSdkToolDefinition,
  AgentToolCall,
  AgentToolDefinition,
  AgentToolResult,
  AgentToolRisk,
  PlannedStep,
  RunAgentRequest,
} from "./types";

/** Re-export canonico del output del orchestrator. */
export type { AgentOrchestratorOutput };

/** Contrato del Agent Orchestrator. */
export interface AgentOrchestrator {
  /** Inicia o continúa una ejecución agentica. */
  run(request: RunAgentRequest): Promise<AgentOrchestratorOutput>;
}

/** Contrato del Planner. */
export interface AgentPlanner {
  /** Convierte un objetivo conversacional en un plan operacional. */
  plan(params: PlannerInput): Promise<PlannedStep[]>;
}

export type PlannerInput = {
  goal: string;
  projectId?: string;
  userId: string;
  mode: AgentExecutionMode;
  workflowId?: string;
  availableTools: string[];
};

/** Contrato del Policy Engine. */
export interface AgentPolicyEngine {
  /** Decide si una tool puede ejecutarse y qué nivel de aprobación requiere. */
  evaluate(params: PolicyInput): PolicyOutput;
}

export type PolicyInput = {
  toolName: string;
  toolRisk: AgentToolRisk;
  executionMode: AgentExecutionMode;
  projectId?: string;
  userId: string;
  stepId?: string;
};

export type PolicyOutput = {
  allowed: boolean;
  approvalRequirement: "none" | "pre_execute" | "per_step";
  policyReason: string;
};

/** Contrato del Tool Registry. */
export interface AgentToolRegistry {
  /** Registra una herramienta. */
  register<TInput, TResult>(tool: AgentToolDefinition<TInput, TResult>): void;
  /** Obtiene una herramienta por nombre. */
  get(name: string): AgentToolDefinition | undefined;
  /** Lista todas las herramientas registradas. */
  list(): AgentToolDefinition[];
  /** Lista nombres de herramientas registradas. */
  getToolNames(): string[];
  /** Lista nombres configurados para un bundle especialista. */
  getBundleToolNames(bundleSlug: string): string[];
  /** Convierte al formato esperado por Vercel AI SDK. */
  toSdkDefinitions(): AgentSdkToolDefinition[];
}

/** Contrato del Tool Executor. */
export interface AgentToolExecutor {
  /** Ejecuta una tool call validando contra registry, Zod y policy. */
  execute(params: ToolExecutorInput): Promise<ToolExecutorOutput>;
}

export type ToolExecutorInput = {
  toolCall: AgentToolCall;
  userId: string;
  projectId?: string;
  workspaceId?: string;
  executionId: string;
  stepId?: string;
  mode: AgentExecutionMode;
  /** Último mensaje del usuario en la conversación. */
  lastUserMessage?: string;
  /** Todos los mensajes de la conversación actual. */
  messages?: Array<{ role: string; content: string }>;
};

export type ToolExecutorOutput = {
  toolResult: AgentToolResult;
  success: boolean;
  approvalRequired?: {
    approvalId: string;
    toolName: string;
    reason: string;
  };
  latencyMs: number;
  summary: string;
};

/** Contrato del Approval Service. */
export interface AgentApprovalService {
  /** Aprueba una ejecución pendiente. */
  approve(params: ApprovalActionParams): Promise<ApprovalActionResult>;
  /** Rechaza una ejecución pendiente con motivo. */
  reject(params: ApprovalActionParams): Promise<ApprovalActionResult>;
  /** Obtiene el estado de una aprobación. */
  getStatus(approvalId: string): Promise<ApprovalStatusResult>;
}

export type ApprovalActionParams = {
  approvalId: string;
  userId: string;
  reason?: string;
};

export type ApprovalActionResult = {
  approved: boolean;
  executionId: string;
  newState: AgentExecutionState;
};

export type ApprovalStatusResult = {
  approvalId: string;
  executionId: string;
  decision: "pending" | "approve" | "reject";
  reason?: string;
  decidedByUserId?: string;
  decidedAt?: Date;
  requestedAt: Date;
};

/** Contrato del Rollback Service. */
export interface AgentRollbackService {
  /** Revierte una ejecución o step. */
  rollback(params: RollbackParams): Promise<RollbackResult>;
  /** Verifica si una tool soporta rollback. */
  supportsRollback(toolName: string): boolean;
}

export type RollbackParams = {
  executionId: string;
  stepId?: string;
  userId: string;
  reason: string;
};

export type RollbackResult = {
  success: boolean;
  rollbackId: string;
  errorMessage?: string;
};

/** Contrato del Vercel AI SDK Adapter. */
export interface AgentVercelSdkAdapter {
  /** Ejecuta un loop modelo -> tool calls usando Vercel AI SDK. */
  runLoop(params: AgentVercelSdkLoopInput): Promise<AgentVercelSdkLoopOutput>;
}

/** Mensaje en el loop agentico (roles extendidos incluyendo tool). */
export type AgentLoopMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type AgentVercelSdkLoopInput = {
  system: string;
  messages: AgentLoopMessage[];
  tools: AgentSdkToolDefinition[];
  stopWhen?: "final_text" | "tool_limit" | "approval_boundary";
  /** Provider usado (para auditoría) */
  provider?: string;
  /** Modelo resuelto por el gateway — se pasa directamente a generateText */
  resolvedModel?: unknown;
};

export type AgentVercelSdkLoopOutput = {
  messages: AgentLoopMessage[];
  toolCalls: AgentToolCall[];
  finishReason: string;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  warnings: string[];
};

/** Contrato del Response Builder. */
export interface AgentResponseBuilder {
  /** Convierte el ledger interno en respuesta legible para UI. */
  build(params: AgentOrchestratorOutput): AgentOrchestratorOutput;
}
