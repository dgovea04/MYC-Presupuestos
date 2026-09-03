import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { z } from "zod";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import { getReviewProgress, type ReviewJobClient, type ReviewProgress } from "@/lib/review-intelligence/jobs";
import {
  findingResolutions,
  findingStatuses,
  reviewFindingTypes,
  type FindingStatus,
  type ReviewFindingType,
} from "@/lib/review-intelligence/types";
import {
  getFinding,
  getReviewEvidence as getPersistedReviewEvidence,
  listFindings,
  recordFindingDecision,
  type FindingDecisionRecord,
  type PaginatedFindings,
} from "@/lib/review-intelligence/findings";
import { prisma } from "@/lib/db/prisma";
import type { AgentToolContext, AgentToolDefinition } from "@/lib/ai/agent/types";

export type ReviewToolSession = {
  userId: string;
  companyId: string;
};

export type ReviewSummary = ReviewProgress;

export type EvidenceView = {
  evidenceId: string;
  projectId: string;
  documentVersionId: string;
  evidenceType: string;
  originalText: string | null;
  normalizedText: string | null;
  location: Record<string, unknown>;
  unit: string | null;
  extractionMethod: string;
  confidence: string;
  sourceHash: string;
  sourceName: string | null;
  sourceVersion: number | null;
};

export type ImpactResult = {
  findingId: string;
  findingType: string;
  difference: string | null;
  percentage: string | null;
  potentialImpact: string | null;
  source: "persisted-comparison" | "persisted-potential-impact" | "unavailable";
  explanation: string;
};

const sessionSchema = z.object({
  userId: z.string().trim().min(1),
  companyId: z.string().trim().min(1),
}).strict();

const summaryInputSchema = z.object({
  reviewRunId: z.string().trim().min(1),
}).strict();

const listInputSchema = z.object({
  reviewRunId: z.string().trim().min(1),
  projectId: z.string().trim().min(1).optional(),
  budgetId: z.string().trim().min(1).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.enum(findingStatuses).optional(),
  findingType: z.enum(reviewFindingTypes).optional(),
  severity: z.string().trim().min(1).optional(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  priority: z.number().finite().min(0).max(1).optional(),
  discipline: z.string().trim().min(1).optional(),
  subbudget: z.string().trim().min(1).optional(),
  document: z.string().trim().min(1).optional(),
}).strict();

const idInputSchema = z.object({
  id: z.string().trim().min(1),
}).strict();

const decisionInputSchema = z.object({
  findingId: z.string().trim().min(1),
  resolution: z.enum(findingResolutions),
  note: z.string().trim().max(5000).optional(),
  expectedUpdatedAt: z.coerce.date(),
  reconfirmStale: z.boolean().default(false),
  correctionVersionId: z.string().trim().min(1).max(200).optional(),
}).strict().superRefine((value, context) => {
  if (value.resolution === "CORRECTED" && !value.correctionVersionId) {
    context.addIssue({
      code: "custom",
      path: ["correctionVersionId"],
      message: "CORRECTED requiere referencia de versión posterior",
    });
  }
});

type ReviewListInput = z.infer<typeof listInputSchema>;
type ReviewDecisionInput = z.infer<typeof decisionInputSchema>;

async function authorize(session: ReviewToolSession, minimumRole: "VIEWER" | "EDITOR"): Promise<ReviewToolSession & { role: string }> {
  const parsed = sessionSchema.parse(session);
  const membership = await assertWorkspaceMembership({
    userId: parsed.userId,
    companyId: parsed.companyId,
    minimumRole,
  });
  if (membership.companyId !== parsed.companyId) {
    throw new Error("La sesión no pertenece al workspace solicitado.");
  }
  return { ...parsed, role: membership.role };
}

function sessionFromContext(context: AgentToolContext): ReviewToolSession {
  if (!context.workspaceId) {
    throw new Error("La herramienta requiere un workspaceId autenticado.");
  }
  return { userId: context.userId, companyId: context.workspaceId };
}

export async function getReviewSummary(reviewRunId: string, session: ReviewToolSession): Promise<ReviewSummary> {
  const parsedId = summaryInputSchema.parse({ reviewRunId }).reviewRunId;
  const authorized = await authorize(session, "VIEWER");
  return getReviewProgress(parsedId, authorized.companyId, prisma as unknown as ReviewJobClient);
}

export async function listReviewFindings(input: ReviewListInput, session: ReviewToolSession): Promise<PaginatedFindings> {
  const parsed = listInputSchema.parse(input);
  const authorized = await authorize(session, "VIEWER");
  return listFindings({ ...parsed, companyId: authorized.companyId } as {
    companyId: string;
    projectId?: string;
    budgetId?: string;
    reviewRunId: string;
    page: number;
    pageSize: number;
    status?: FindingStatus;
    findingType?: ReviewFindingType;
    severity?: string;
    confidence?: "LOW" | "MEDIUM" | "HIGH";
    priority?: number;
    discipline?: string;
    subbudget?: string;
    document?: string;
  });
}

export async function getReviewFinding(findingId: string, session: ReviewToolSession): Promise<Record<string, unknown>> {
  const parsedId = idInputSchema.parse({ id: findingId }).id;
  const authorized = await authorize(session, "VIEWER");
  return getFinding(parsedId, authorized.companyId);
}

export async function getReviewEvidence(evidenceId: string, session: ReviewToolSession): Promise<EvidenceView> {
  const parsedId = idInputSchema.parse({ id: evidenceId }).id;
  const authorized = await authorize(session, "VIEWER");
  return getPersistedReviewEvidence(parsedId, authorized.companyId);
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asDecimal(value: unknown): Decimal | null {
  if (typeof value === "string" || typeof value === "number") {
    try {
      return new Decimal(value);
    } catch {
      return null;
    }
  }
  return null;
}

function decimalString(value: Decimal | null): string | null {
  return value?.toString() ?? null;
}

export async function calculateReviewFindingImpact(findingId: string, session: ReviewToolSession): Promise<ImpactResult> {
  const finding = await getReviewFinding(findingId, session);
  const comparison = asObject(finding.comparison);
  const documentValue = asDecimal(comparison.documentValue);
  const budgetValue = asDecimal(comparison.budgetValue);
  const persistedImpact = asDecimal(comparison.potentialImpact ?? finding.potentialImpact);
  const difference = documentValue && budgetValue ? documentValue.minus(budgetValue) : null;
  const percentage = documentValue && budgetValue && !budgetValue.isZero()
    ? difference?.abs().dividedBy(budgetValue.abs()).times(100) ?? null
    : null;
  const source = difference && persistedImpact
    ? "persisted-comparison"
    : persistedImpact
      ? "persisted-potential-impact"
      : "unavailable";

  return {
    findingId: typeof finding.id === "string" ? finding.id : findingId,
    findingType: typeof finding.findingType === "string" ? finding.findingType : "UNKNOWN",
    difference: decimalString(difference),
    percentage: decimalString(percentage),
    potentialImpact: decimalString(persistedImpact),
    source,
    explanation: source === "unavailable"
      ? "El hallazgo no tiene un impacto numérico persistido."
      : "Impacto derivado exclusivamente de la comparación persistida por la revisión determinística.",
  };
}

export async function recordReviewFindingDecision(input: ReviewDecisionInput, session: ReviewToolSession): Promise<FindingDecisionRecord> {
  const parsed = decisionInputSchema.parse(input);
  const authorized = await authorize(session, "EDITOR");
  return recordFindingDecision({
    ...parsed,
    companyId: authorized.companyId,
    userId: authorized.userId,
    role: authorized.role,
    correlationId: randomUUID(),
  });
}

const getReviewSummaryInput = summaryInputSchema;
const listReviewFindingsInput = listInputSchema;
const getReviewFindingInput = idInputSchema;
const getReviewEvidenceInput = idInputSchema;
const calculateReviewFindingImpactInput = idInputSchema;

export const getReviewSummaryTool: AgentToolDefinition<z.infer<typeof getReviewSummaryInput>, ReviewSummary> = {
  name: "getReviewSummary",
  description: "Resume una ejecución de Revisión Inteligente usando métricas y advertencias persistidas. No consulta ni requiere un proveedor IA.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: getReviewSummaryInput,
  execute: (input, context) => getReviewSummary(input.reviewRunId, sessionFromContext(context)),
  summarizeResult: (result) => `Revisión ${result.status}: ${result.progress.percent}% completada.`,
};

export const listReviewFindingsTool: AgentToolDefinition<z.infer<typeof listReviewFindingsInput>, PaginatedFindings> = {
  name: "listReviewFindings",
  description: "Filtra y pagina hallazgos persistidos por estado, tipo, severidad, confianza, prioridad, disciplina, subpresupuesto o documento.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: listReviewFindingsInput,
  execute: (input, context) => listReviewFindings(input, sessionFromContext(context)),
  summarizeResult: (result) => `${result.findings.length} hallazgos cargados${result.hasNextPage ? "; hay más resultados" : "."}`,
};

export const getReviewFindingTool: AgentToolDefinition<z.infer<typeof getReviewFindingInput>, Record<string, unknown>> = {
  name: "getReviewFinding",
  description: "Obtiene el detalle persistido de un hallazgo y su historial de decisiones, sin cerrarlo ni modificarlo.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: getReviewFindingInput,
  execute: (input, context) => getReviewFinding(input.id, sessionFromContext(context)),
};

export const getReviewEvidenceTool: AgentToolDefinition<z.infer<typeof getReviewEvidenceInput>, EvidenceView> = {
  name: "getReviewEvidence",
  description: "Consulta la evidencia persistida, su provenance y método de extracción dentro del tenant autenticado.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: getReviewEvidenceInput,
  execute: (input, context) => getReviewEvidence(input.id, sessionFromContext(context)),
};

export const calculateReviewFindingImpactTool: AgentToolDefinition<z.infer<typeof calculateReviewFindingImpactInput>, ImpactResult> = {
  name: "calculateReviewFindingImpact",
  description: "Explica el impacto numérico ya persistido de un hallazgo usando Decimal; no inventa ni cambia valores del presupuesto.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: calculateReviewFindingImpactInput,
  execute: (input, context) => calculateReviewFindingImpact(input.id, sessionFromContext(context)),
};

export const recordReviewFindingDecisionTool: AgentToolDefinition<z.infer<typeof decisionInputSchema>, FindingDecisionRecord> = {
  name: "recordReviewFindingDecision",
  description: "Registra una decisión humana explícita sobre un hallazgo. Requiere rol EDITOR, control optimista y reconfirmación si la ejecución está STALE; nunca se ejecuta automáticamente.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: decisionInputSchema,
  execute: (input, context) => recordReviewFindingDecision(input, sessionFromContext(context)),
};

export const reviewIntelligenceTools = [
  getReviewSummaryTool,
  listReviewFindingsTool,
  getReviewFindingTool,
  getReviewEvidenceTool,
  calculateReviewFindingImpactTool,
  recordReviewFindingDecisionTool,
] as unknown as AgentToolDefinition[];
