import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { IntegrationSessionStatus } from "./types";
import { assertValidIntegrationTransition } from "./types";

export type IntegrationSessionView = { id: string; companyId: string; projectId: string; budgetId: string; adapter: string; status: IntegrationSessionStatus; payloadHash: string; requestId: string; confirmationToken: string | null; createdAt: string; updatedAt: string };

export function hashIntegrationPayload(payload: string | Uint8Array): string { return createHash("sha256").update(payload).digest("hex"); }

export async function createIntegrationSession(input: { companyId: string; projectId: string; budgetId: string; createdById: string; adapter: string; contractVersion: string; payload: string | Uint8Array; requestId?: string }): Promise<IntegrationSessionView> {
  const requestId = input.requestId ?? randomUUID();
  const session = await prisma.integrationSession.upsert({
    where: { companyId_requestId: { companyId: input.companyId, requestId } },
    create: { companyId: input.companyId, projectId: input.projectId, budgetId: input.budgetId, createdById: input.createdById, adapter: input.adapter, contractVersion: input.contractVersion, payloadHash: hashIntegrationPayload(input.payload), requestId, confirmationToken: randomUUID(), stagedPayload: typeof input.payload === "string" ? JSON.parse(input.payload) as object : undefined },
    update: {},
  });
  return serializeSession(session);
}

export async function transitionIntegrationSession(input: { sessionId: string; companyId: string; to: IntegrationSessionStatus }): Promise<IntegrationSessionView> {
  const current = await prisma.integrationSession.findFirst({ where: { id: input.sessionId, companyId: input.companyId } });
  if (!current) throw new Error("Sesión de integración no encontrada");
  assertValidIntegrationTransition(current.status as IntegrationSessionStatus, input.to);
  return serializeSession(await prisma.integrationSession.update({ where: { id: current.id }, data: { status: input.to } }));
}

function serializeSession(session: { id: string; companyId: string; projectId: string; budgetId: string; adapter: string; status: string; payloadHash: string; requestId: string; confirmationToken: string | null; createdAt: Date; updatedAt: Date }): IntegrationSessionView {
  return { ...session, status: session.status as IntegrationSessionStatus, createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString() };
}
