import { z } from "zod";

const agentStreamMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export const aiAgentRequestSchema = z.object({
  message: z.string().trim().min(1, "Ingresa un objetivo para el agente."),
  /** Historial completo de la conversación (mensajes anteriores + el nuevo). */
  messages: z.array(agentStreamMessageSchema).optional(),
  projectId: z.string().optional(),
  workspaceId: z.string().trim().min(1).optional(),
  teamId: z.string().trim().min(1).optional(),
  mode: z.enum(["chat", "goal", "workflow"]).optional().default("chat"),
  workflowId: z.string().optional(),
  executionId: z.string().optional(),
  requestId: z.string().trim().min(1).max(200).optional(),
});

export type AgentStreamMessage = z.infer<typeof agentStreamMessageSchema>;

export const aiApprovalRequestSchema = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
});

export type AiAgentRequest = z.infer<typeof aiAgentRequestSchema>;
export type AiApprovalRequest = z.infer<typeof aiApprovalRequestSchema>;
