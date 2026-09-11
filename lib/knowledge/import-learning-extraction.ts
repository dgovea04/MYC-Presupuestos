import { createHash } from "node:crypto";
import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";
import type { McpManifest } from "@/lib/mcp/types";
import type { PdfAiImportDraft } from "@/lib/pdf-import/types";
import { confidenceFromScore, type ImportLearningBatch, type ImportLearningEvidence, type ImportLearningObservation, type ImportLearningSourceType } from "./import-learning-types";

export function buildS10ImportLearningBatch(input: { snapshot: S10ExportSnapshot; sourceType: ImportLearningSourceType; sourceLabel: string; companyId: string; projectId: string; createdById: string; importId?: string }): ImportLearningBatch {
  const snapshot = input.snapshot;
  if (!snapshot || !Array.isArray(snapshot.presupuestos) || !Array.isArray(snapshot.partidas) || !Array.isArray(snapshot.apuDetalles)) {
    throw new Error("IMPORT_LEARNING_SNAPSHOT_UNAVAILABLE");
  }
  const sourceBudgetCode = snapshot.presupuestos[0]?.CodPresupuesto ?? "unknown";
  const importId = input.importId ?? createImportFingerprint(input.sourceType, snapshot);
  const observations: ImportLearningObservation[] = [];
  for (const item of snapshot.partidas) {
    const recordId = [item.CodPresupuesto, item.CodSubpresupuesto, item.CodPartida].join(":");
    observations.push({ domain: "ITEM", originalRecordId: recordId, name: item.Descripcion, unit: item.CodUnidad ?? undefined, value: { code: item.CodPartida, description: item.Descripcion, unit: item.CodUnidad ?? null }, confidence: confidenceFromScore(item.Descripcion.trim() && item.CodPartida.trim() ? 0.95 : 0.3), evidence: s10Evidence(input.sourceLabel, recordId, { sourceBudgetCode, table: "partidas" }), entity: { domain: "ITEM", name: item.Descripcion, unit: item.CodUnidad ?? undefined } });
  }
  for (const resource of uniqueResources(snapshot)) {
    const recordId = [resource.CodPresupuesto, resource.CodSubpresupuesto, resource.CodPartida, resource.CodInsumo].join(":");
    observations.push({ domain: "RESOURCE", originalRecordId: recordId, name: resource.Descripcion, unit: resource.CodUnidad ?? undefined, value: { code: resource.CodInsumo, description: resource.Descripcion, unit: resource.CodUnidad ?? null, type: resource.Tipo ?? null }, confidence: confidenceFromScore(resource.Descripcion.trim() && resource.CodInsumo.trim() ? 0.9 : 0.3), evidence: s10Evidence(input.sourceLabel, recordId, { sourceBudgetCode, table: "apuDetalles" }), entity: { domain: "RESOURCE", name: resource.Descripcion, unit: resource.CodUnidad ?? undefined } });
    if (resource.Precio1 !== null && resource.Precio1 !== undefined && resource.CodUnidad?.trim()) observations.push({ domain: "PRICE", originalRecordId: `${recordId}:price`, name: resource.Descripcion, unit: resource.CodUnidad, currency: "PEN", value: { value: String(resource.Precio1), code: resource.CodInsumo }, confidence: confidenceFromScore(0.75), evidence: s10Evidence(input.sourceLabel, `${recordId}:price`, { sourceBudgetCode, table: "apuDetalles", field: "Precio1" }), entity: { domain: "RESOURCE", name: resource.Descripcion, unit: resource.CodUnidad } });
  }
  for (const item of snapshot.partidas) {
    if (item.RendimientoMO === null || item.RendimientoMO === undefined || !item.CodUnidad?.trim()) continue;
    const recordId = [item.CodPresupuesto, item.CodSubpresupuesto, item.CodPartida, "yield"].join(":");
    observations.push({ domain: "YIELD", originalRecordId: recordId, name: item.Descripcion, unit: item.CodUnidad, value: { value: String(item.RendimientoMO), code: item.CodPartida, productionUnit: item.CodUnidad }, confidence: confidenceFromScore(0.7), evidence: s10Evidence(input.sourceLabel, recordId, { sourceBudgetCode, table: "partidas", field: "RendimientoMO" }), entity: { domain: "ITEM", name: item.Descripcion, unit: item.CodUnidad } });
  }
  const apuGroups = new Map<string, typeof snapshot.apuDetalles>();
  for (const row of snapshot.apuDetalles) { const key = [row.CodPresupuesto, row.CodSubpresupuesto, row.CodPartida].join(":"); apuGroups.set(key, [...(apuGroups.get(key) ?? []), row]); }
  for (const [recordId, rows] of apuGroups) {
    const item = snapshot.partidas.find((candidate) => [candidate.CodPresupuesto, candidate.CodSubpresupuesto, candidate.CodPartida].join(":") === recordId);
    if (!item || rows.length === 0) continue;
    observations.push({ domain: "APU", originalRecordId: `${recordId}:apu`, name: item.Descripcion, unit: item.CodUnidad ?? undefined, value: { itemCode: item.CodPartida, performance: item.RendimientoMO ?? null, resources: rows.map((row) => ({ code: row.CodInsumo, description: row.Descripcion, unit: row.CodUnidad ?? null, quantity: row.Cantidad, unitPrice: row.Precio1, partial: row.Parcial1 })) }, confidence: confidenceFromScore(0.65), evidence: s10Evidence(input.sourceLabel, `${recordId}:apu`, { sourceBudgetCode, table: "apuDetalles", rowCount: rows.length }), entity: { domain: "ITEM", name: item.Descripcion, unit: item.CodUnidad ?? undefined } });
  }
  return { importId, sourceType: input.sourceType, sourceLabel: input.sourceLabel, companyId: input.companyId, projectId: input.projectId, createdById: input.createdById, observations };
}

function uniqueResources(snapshot: S10ExportSnapshot) {
  const seen = new Set<string>();
  return snapshot.apuDetalles.filter((row) => { const key = [row.CodPresupuesto, row.CodSubpresupuesto, row.CodPartida, row.CodInsumo].join(":"); if (seen.has(key)) return false; seen.add(key); return true; });
}

function s10Evidence(fileName: string, originalRecordId: string, metadata: Record<string, string | number>): ImportLearningEvidence { return { originalRecordId, fileName, quote: `S10 ${originalRecordId}`, metadata }; }
function createImportFingerprint(sourceType: ImportLearningSourceType, snapshot: S10ExportSnapshot) { return `${sourceType}:${createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")}`; }

export function buildPdfImportLearningBatch(input: { draft: PdfAiImportDraft; sourceLabel: string; companyId: string; projectId: string; createdById: string; importId?: string }): ImportLearningBatch {
  const observations: ImportLearningObservation[] = [];
  const importId = input.importId ?? buildImportIdFromText("PDF_IMPORT", JSON.stringify(input.draft));
  for (const item of input.draft.budgets.flatMap((budget) => budget.items)) observations.push({ domain: "ITEM", originalRecordId: item.id, name: item.description, unit: item.unit, value: { code: item.code, description: item.description, unit: item.unit }, confidence: confidenceFromScore(item.evidence.confidence), evidence: pdfEvidence(item.evidence.sourceFileName, item.evidence.sourcePage, item.id, item.evidence.rawText), entity: { domain: "ITEM", name: item.description, unit: item.unit } });
  for (const resource of input.draft.resources) {
    observations.push({ domain: "RESOURCE", originalRecordId: resource.id, name: resource.description, unit: resource.unit, value: { code: resource.code, description: resource.description, category: resource.category, unit: resource.unit }, confidence: confidenceFromScore(resource.evidence.confidence), evidence: pdfEvidence(resource.evidence.sourceFileName, resource.evidence.sourcePage, resource.id, resource.evidence.rawText), entity: { domain: "RESOURCE", name: resource.description, unit: resource.unit } });
    observations.push({ domain: "PRICE", originalRecordId: `${resource.id}:price`, name: resource.description, unit: resource.unit, currency: resource.currency, value: { value: resource.unitPrice, currency: resource.currency }, confidence: confidenceFromScore(resource.evidence.confidence), evidence: pdfEvidence(resource.evidence.sourceFileName, resource.evidence.sourcePage, `${resource.id}:price`, resource.evidence.rawText), entity: { domain: "RESOURCE", name: resource.description, unit: resource.unit } });
  }
  return { importId, sourceType: "PDF_IMPORT", sourceLabel: input.sourceLabel, companyId: input.companyId, projectId: input.projectId, createdById: input.createdById, observations };
}

export function buildMcpImportLearningBatch(input: { manifest: McpManifest; readModule: (path: string) => unknown; sourceLabel: string; companyId: string; projectId: string; createdById: string; importId?: string }): ImportLearningBatch {
  const observations: ImportLearningObservation[] = [];
  const importId = input.importId ?? `${input.manifest.project.slug}:${input.projectId}`;
  const itemModule = readOptionalModule(input.readModule, "budgets/budget-items.json") as { budgets?: Array<{ items?: Array<{ id: string; code: string; description: string; unit: string; quantity: string }> }> };
  for (const item of itemModule.budgets?.flatMap((budget) => budget.items ?? []) ?? []) observations.push({ domain: "ITEM", originalRecordId: item.id, name: item.description, unit: item.unit, value: { code: item.code, description: item.description, unit: item.unit, quantity: item.quantity }, confidence: confidenceFromScore(0.9), evidence: { originalRecordId: item.id, fileName: input.sourceLabel, sheet: "budgets/budget-items.json", quote: item.description }, entity: { domain: "ITEM", name: item.description, unit: item.unit } });
  const resourceModule = readOptionalModule(input.readModule, "budgets/project-resources.json") as { resources?: Array<{ id: string; code: string; description: string; category: string; unit: string; currency: string; unitPrice: string }> };
  for (const resource of resourceModule.resources ?? []) {
    observations.push({ domain: "RESOURCE", originalRecordId: resource.id, name: resource.description, unit: resource.unit, value: { code: resource.code, description: resource.description, category: resource.category, unit: resource.unit }, confidence: confidenceFromScore(0.9), evidence: { originalRecordId: resource.id, fileName: input.sourceLabel, sheet: "budgets/project-resources.json", quote: resource.description }, entity: { domain: "RESOURCE", name: resource.description, unit: resource.unit } });
    observations.push({ domain: "PRICE", originalRecordId: `${resource.id}:price`, name: resource.description, unit: resource.unit, currency: resource.currency, value: { value: resource.unitPrice, currency: resource.currency }, confidence: confidenceFromScore(0.85), evidence: { originalRecordId: `${resource.id}:price`, fileName: input.sourceLabel, sheet: "budgets/project-resources.json", quote: resource.description }, entity: { domain: "RESOURCE", name: resource.description, unit: resource.unit } });
  }
  return { importId, sourceType: "MCP_IMPORT", sourceLabel: input.sourceLabel, companyId: input.companyId, projectId: input.projectId, createdById: input.createdById, observations };
}

function pdfEvidence(fileName: string, page: number, originalRecordId: string, quote: string): ImportLearningEvidence { return { originalRecordId, fileName, page: String(page), quote }; }
function readOptionalModule(readModule: (path: string) => unknown, path: string): unknown { try { return readModule(path); } catch { return {}; } }
export function buildImportIdFromText(sourceType: ImportLearningSourceType, content: string) { return `${sourceType}:${createHash("sha256").update(content).digest("hex")}`; }
