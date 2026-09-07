import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { IntegrationSessionStatus } from "./types";
import { assertValidIntegrationTransition } from "./types";
import { getIntegrationAdapter } from "./registry";
import { validateStagedData } from "./staging";
import type { StagedIntegrationData } from "./types";
import "./adapters";

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
  if (current?.status === input.to) return serializeSession(current);
  if (!current) throw new Error("Sesión de integración no encontrada");
  assertValidIntegrationTransition(current.status as IntegrationSessionStatus, input.to);
  return serializeSession(await prisma.integrationSession.update({ where: { id: current.id }, data: { status: input.to } }));
}

export async function stageIntegrationSession(input: { sessionId: string; companyId: string }): Promise<StagedIntegrationData> {
  const session = await prisma.integrationSession.findFirst({ where: { id: input.sessionId, companyId: input.companyId } });
  if (!session) throw new Error("Sesión de integración no encontrada");
  const payload = (session.stagedPayload ?? {}) as Record<string, unknown>;
  const adapter = getIntegrationAdapter(session.adapter);
  const external = session.adapter === "mcp" && typeof payload.bufferBase64 === "string"
    ? { buffer: Buffer.from(payload.bufferBase64, "base64"), sourceName: typeof payload.sourceName === "string" ? payload.sourceName : "package.mcp" }
    : session.adapter === "s10" && typeof payload.snapshotJson === "string"
      ? { snapshotJson: payload.snapshotJson, sourceName: typeof payload.sourceName === "string" ? payload.sourceName : "s10" }
      : payload;
  const staged = await adapter.stage(external);
  const validated = await validateStagedData(staged as StagedIntegrationData);
  const preview = { rows: validated.rows.map((row) => ({ externalKey: row.externalKey, action: row.internalCandidateId ? "UPDATE" : "CREATE", description: row.values.description, provenance: row.provenance, conflict: validated.conflicts.find((conflict) => conflict.externalKey === row.externalKey)?.message })) };
  await prisma.$transaction(async (tx) => {
    await tx.integrationConflict.deleteMany({ where: { sessionId: session.id } });
    await tx.integrationMapping.deleteMany({ where: { sessionId: session.id } });
    if (validated.conflicts.length) await tx.integrationConflict.createMany({ data: validated.conflicts.map((conflict) => ({ sessionId: session.id, externalKey: conflict.externalKey, kind: conflict.kind, message: conflict.message, details: conflict.details })) });
    if (validated.rows.length) await tx.integrationMapping.createMany({ data: validated.rows.map((row) => ({ sessionId: session.id, externalKey: row.externalKey, internalId: row.internalCandidateId, mappingType: row.internalCandidateId ? "CANDIDATE" : "UNRESOLVED", metadata: row.provenance })) });
    await tx.integrationSession.update({ where: { id: session.id }, data: { stagedPayload: { ...payload, staged: validated } as object, counts: validated.counts, preview } });
  });
  return validated;
}

function serializeSession(session: { id: string; companyId: string; projectId: string; budgetId: string; adapter: string; status: string; payloadHash: string; requestId: string; confirmationToken: string | null; createdAt: Date; updatedAt: Date }): IntegrationSessionView {
  return { ...session, status: session.status as IntegrationSessionStatus, createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString() };
}
