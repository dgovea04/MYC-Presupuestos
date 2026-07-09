import { prisma } from "@/lib/db/prisma";

export type AgentWorkflowRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  initialGoalTemplate: string;
  allowedToolsJson: string[] | null;
  defaultMode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Lista todos los workflows activos (plantillas de flujo de trabajo agéntico).
 */
export async function listActiveWorkflows(): Promise<AgentWorkflowRecord[]> {
  return prisma.agentWorkflow.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  }) as Promise<AgentWorkflowRecord[]>;
}

/**
 * Obtiene un workflow por su slug único.
 */
export async function getWorkflowBySlug(
  slug: string,
): Promise<AgentWorkflowRecord | null> {
  return prisma.agentWorkflow.findUnique({
    where: { slug },
  }) as Promise<AgentWorkflowRecord | null>;
}

/**
 * Obtiene un workflow por ID.
 */
export async function getWorkflowById(
  id: string,
): Promise<AgentWorkflowRecord | null> {
  return prisma.agentWorkflow.findUnique({
    where: { id },
  }) as Promise<AgentWorkflowRecord | null>;
}
