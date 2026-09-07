import { createHash } from "node:crypto";
import { analyzeProjectPackageBuffer } from "@/lib/mcp/import-preview";
import type { IntegrationAdapter, StagedIntegrationData } from "../types";

export type McpIntegrationInput = { buffer: Buffer | Uint8Array; sourceName?: string };

export async function stageMcp(input: McpIntegrationInput): Promise<StagedIntegrationData> {
  const analysis = analyzeProjectPackageBuffer(input.buffer);
  const rows: StagedIntegrationData["rows"] = [];
  const itemModule = analysis.fileContents.get("budgets/budget-items.json");
  if (itemModule) {
    const parsed = JSON.parse(itemModule) as { budgets?: Array<{ budgetId: string; items?: Array<{ id: string; code: string; description: string; unit: string; quantity: string; unitPrice: string }> }> };
    for (const budget of parsed.budgets ?? []) for (const item of budget.items ?? []) rows.push({ externalKey: item.code || item.id, internalCandidateId: item.id, values: { budgetId: budget.budgetId, code: item.code, description: item.description, unit: item.unit, quantity: item.quantity, unitPrice: item.unitPrice }, provenance: { source: input.sourceName ?? "package.mcp", row: rows.length + 1 } });
  }
  const conflicts = [...analysis.preview.errors.map((message) => ({ externalKey: "MCP", kind: "PARSER_ERROR", message })), ...analysis.preview.warnings.map((message) => ({ externalKey: "MCP", kind: "PARSER_WARNING", message }))];
  return { rows, conflicts, counts: { total: rows.length, valid: Math.max(0, rows.length - conflicts.length), conflicts: conflicts.length }, payloadHash: createHash("sha256").update(input.buffer).digest("hex") };
}

export const mcpAdapter: IntegrationAdapter<McpIntegrationInput, StagedIntegrationData> = { id: "mcp", contractVersion: "1", capabilities: { import: true, export: true, rollback: true, formats: ["mcp"] }, stage: stageMcp, async validate(input) { return input; }, async preview(input) { return input; }, async apply(input) { return { appliedCount: input.rows.length }; }, async rollback(input) { return { rolledBackCount: input.rows.length }; } };
