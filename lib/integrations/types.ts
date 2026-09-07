export const INTEGRATION_STATUSES = ["DRAFT", "STAGED", "VALIDATED", "PREVIEW_READY", "CONFIRMED", "APPLIED", "ROLLED_BACK", "FAILED"] as const;
export type IntegrationSessionStatus = (typeof INTEGRATION_STATUSES)[number];

export type IntegrationAdapterCapabilities = {
  import: boolean;
  export: boolean;
  rollback: boolean;
  formats: readonly string[];
};

export type IntegrationConflict = { externalKey: string; kind: string; message: string; details?: Record<string, unknown> };
export type StagedIntegrationRow = { externalKey: string; internalCandidateId?: string; values: Record<string, string>; provenance: { source: string; row: number } };
export type StagedIntegrationData = { rows: StagedIntegrationRow[]; conflicts: IntegrationConflict[]; counts: { total: number; valid: number; conflicts: number }; payloadHash: string };

export interface IntegrationAdapter<TExternal, TStaged> {
  readonly id: string;
  readonly contractVersion: string;
  readonly capabilities: IntegrationAdapterCapabilities;
  stage(input: TExternal): Promise<TStaged>;
  validate(input: TStaged): Promise<StagedIntegrationData>;
  preview(input: TStaged): Promise<StagedIntegrationData>;
  apply(input: TStaged): Promise<{ appliedCount: number }>;
  rollback(input: TStaged): Promise<{ rolledBackCount: number }>;
}

export function isValidIntegrationTransition(from: IntegrationSessionStatus, to: IntegrationSessionStatus): boolean {
  const transitions: Record<IntegrationSessionStatus, readonly IntegrationSessionStatus[]> = {
    DRAFT: ["STAGED", "FAILED"], STAGED: ["VALIDATED", "FAILED"], VALIDATED: ["PREVIEW_READY", "FAILED"],
    PREVIEW_READY: ["CONFIRMED", "FAILED"], CONFIRMED: ["APPLIED", "FAILED"], APPLIED: ["ROLLED_BACK"],
    ROLLED_BACK: [], FAILED: [],
  };
  return transitions[from].includes(to);
}

export function assertValidIntegrationTransition(from: IntegrationSessionStatus, to: IntegrationSessionStatus): void {
  if (!isValidIntegrationTransition(from, to)) throw new Error(`Transición de integración inválida: ${from} → ${to}`);
}
