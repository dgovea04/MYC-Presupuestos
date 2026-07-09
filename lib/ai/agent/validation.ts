import { z } from "zod";

export const aiAgentRequestSchema = z.object({
  message: z.string().trim().min(1, "Ingresa un objetivo para el agente."),
  projectId: z.string().optional(),
  mode: z.enum(["chat", "goal", "workflow"]).optional().default("chat"),
  workflowId: z.string().optional(),
  executionId: z.string().optional(),
});

export const aiApprovalRequestSchema = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
});

export type AiAgentRequest = z.infer<typeof aiAgentRequestSchema>;
export type AiApprovalRequest = z.infer<typeof aiApprovalRequestSchema>;
