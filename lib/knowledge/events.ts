import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { validateKnowledgeScope } from "./validation";
import type { KnowledgeScopeContext } from "./types";

export interface KnowledgeEventInput extends KnowledgeScopeContext {
  eventType: string;
  entityType: string;
  entityId: string;
  sourceType: string;
  sourceId?: string;
  evidenceId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
}

function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
}

export function knowledgeEventPayloadHash(input: KnowledgeEventInput): string {
  const payload = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "idempotencyKey"));
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

export async function recordKnowledgeEvent(input: KnowledgeEventInput): Promise<{ event: Awaited<ReturnType<typeof prisma.knowledgeEvent.create>>; created: boolean }> {
  validateKnowledgeScope(input);
  const payloadHash = knowledgeEventPayloadHash(input);
  const existing = await prisma.knowledgeEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new Error("Idempotency key payload conflict");
    return { event: existing, created: false };
  }
  const event = await prisma.knowledgeEvent.create({
    data: {
      eventType: input.eventType,
      scope: input.scope,
      companyId: input.companyId,
      projectId: input.projectId,
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      evidenceId: input.evidenceId,
      previousValue: input.previousValue === undefined ? undefined : JSON.parse(stableJson(input.previousValue)),
      newValue: input.newValue === undefined ? undefined : JSON.parse(stableJson(input.newValue)),
      metadata: input.metadata === undefined ? undefined : JSON.parse(stableJson(input.metadata)),
      idempotencyKey: input.idempotencyKey,
      payloadHash,
    },
  });
  return { event, created: true };
}
