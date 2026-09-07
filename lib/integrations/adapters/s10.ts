import type { IntegrationAdapter, StagedIntegrationData } from "../types";
import { stageXlsxCsv } from "./xlsx-csv";
export type S10Input = { rows: readonly Record<string, unknown>[]; sourceName?: string };
export async function stageS10(input: S10Input): Promise<StagedIntegrationData> { return stageXlsxCsv({ rows: input.rows, sourceName: input.sourceName ?? "s10" }); }
export const s10Adapter: IntegrationAdapter<S10Input, StagedIntegrationData> = { id: "s10", contractVersion: "1", capabilities: { import: true, export: true, rollback: true, formats: ["s10", "s2k"] }, async stage(input) { return stageS10(input); }, async validate(input) { return input; } };
