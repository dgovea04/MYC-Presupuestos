import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";

export const S10_SNAPSHOT_SCHEMA = "mc.s10.snapshot" as const;
export const S10_SNAPSHOT_CONTRACT_VERSION = "1.0.0" as const;
const supportedContractMajor = 1;

export type S10SnapshotAdapter = "sqlserver" | "desktop" | "legacy";

export type S10SnapshotContract = {
  schema: typeof S10_SNAPSHOT_SCHEMA;
  contractVersion: string;
  exportedAt: string;
  source: {
    system: "S10";
    adapter: S10SnapshotAdapter;
    databaseName?: string;
    budgetCode?: string;
  };
  payload: S10ExportSnapshot;
};

export type S10SnapshotContractOptions = {
  exportedAt?: string;
  adapter?: S10SnapshotAdapter;
  databaseName?: string;
  budgetCode?: string;
};

export type ParsedS10Snapshot = {
  contract: S10SnapshotContract;
  snapshot: S10ExportSnapshot;
  wasLegacy: boolean;
};

export function createS10SnapshotContract(
  snapshot: S10ExportSnapshot,
  options: S10SnapshotContractOptions = {},
): S10SnapshotContract {
  const contract: S10SnapshotContract = {
    schema: S10_SNAPSHOT_SCHEMA,
    contractVersion: S10_SNAPSHOT_CONTRACT_VERSION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    source: {
      system: "S10",
      adapter: options.adapter ?? "sqlserver",
      ...(options.databaseName ? { databaseName: options.databaseName } : {}),
      ...(options.budgetCode ? { budgetCode: options.budgetCode } : {}),
    },
    payload: snapshot,
  };

  validateS10SnapshotContract(contract);
  return contract;
}

export function parseS10SnapshotJson(json: string): ParsedS10Snapshot {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripBom(json));
  } catch {
    throw new Error("El archivo no contiene JSON valido.");
  }

  if (isRecord(parsed) && parsed.schema === S10_SNAPSHOT_SCHEMA) {
    const contract = parseVersionedContract(parsed);
    return { contract, snapshot: contract.payload, wasLegacy: false };
  }

  const snapshot = parseLegacySnapshot(parsed);
  return {
    contract: createS10SnapshotContract(snapshot, { adapter: "legacy" }),
    snapshot,
    wasLegacy: true,
  };
}

export function parseS10SnapshotValue(value: unknown): ParsedS10Snapshot {
  if (isRecord(value) && value.schema === S10_SNAPSHOT_SCHEMA) {
    const contract = parseVersionedContract(value);
    return { contract, snapshot: contract.payload, wasLegacy: false };
  }

  const snapshot = parseLegacySnapshot(value);
  return {
    contract: createS10SnapshotContract(snapshot, { adapter: "legacy" }),
    snapshot,
    wasLegacy: true,
  };
}

export function serializeS10SnapshotContract(contract: S10SnapshotContract) {
  validateS10SnapshotContract(contract);
  return `${JSON.stringify(contract, null, 2)}\n`;
}

export function validateS10SnapshotContract(value: unknown): asserts value is S10SnapshotContract {
  if (!isRecord(value) || value.schema !== S10_SNAPSHOT_SCHEMA) {
    throw new Error(`El snapshot no usa el esquema ${S10_SNAPSHOT_SCHEMA}.`);
  }

  if (typeof value.contractVersion !== "string") {
    throw new Error("El snapshot versionado no declara contractVersion.");
  }

  assertSupportedContractVersion(value.contractVersion);

  if (typeof value.exportedAt !== "string" || !isIsoDate(value.exportedAt)) {
    throw new Error("El snapshot versionado no declara un exportedAt ISO valido.");
  }

  if (!isRecord(value.source) || value.source.system !== "S10" || !isSnapshotAdapter(value.source.adapter)) {
    throw new Error("El snapshot versionado no declara un origen S10 valido.");
  }

  if (!areOptionalMetadataValuesValid(value.source)) {
    throw new Error("Los metadatos source del snapshot S10 no son validos.");
  }

  if (!isS10SnapshotPayload(value.payload)) {
    throw new Error("El payload del snapshot S10 no tiene la estructura esperada.");
  }
}

function parseVersionedContract(value: Record<string, unknown>): S10SnapshotContract {
  validateS10SnapshotContract(value);

  return value;
}

function parseLegacySnapshot(value: unknown): S10ExportSnapshot {
  if (!isS10SnapshotPayload(value)) {
    throw new Error("El JSON no tiene la estructura esperada de un snapshot S10.");
  }

  return value;
}

function assertSupportedContractVersion(version: string) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
  const major = match ? Number.parseInt(match[1] ?? "", 10) : Number.NaN;
  if (!match || !Number.isInteger(major) || major !== supportedContractMajor) {
    throw new Error(
      `La version ${version} del contrato S10 no es compatible. Solo se soporta la version ${supportedContractMajor}.x.`,
    );
  }
}

function isS10SnapshotPayload(value: unknown): value is S10ExportSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.presupuestos) && value.presupuestos.every(isPresupuestoRow) &&
    Array.isArray(value.subpresupuestos) && value.subpresupuestos.every(isSubpresupuestoRow) &&
    Array.isArray(value.partidas) && value.partidas.every(isPartidaRow) &&
    Array.isArray(value.apuDetalles) && value.apuDetalles.every(isApuDetalleRow) &&
    areOptionalRows(value.budgetLevels, (row) => isNonEmptyString(row.CodPresupuesto) && isNonEmptyString(row.CodSubpresupuesto) && isNonEmptyString(row.Codigo)) &&
    areOptionalRows(value.subpresupuestoDetalles, (row) => isNonEmptyString(row.CodPresupuesto) && isNonEmptyString(row.CodSubpresupuesto) && isNullableText(row.Descripcion)) &&
    areOptionalRows(value.pieSubpresupuestos, (row) => isNonEmptyString(row.CodPresupuesto) && isNonEmptyString(row.CodSubpresupuesto) && isNonEmptyString(row.Linea)) &&
    areOptionalRows(value.resultadoPieSubpresupuestos, (row) => isNonEmptyString(row.CodPresupuesto) && isNonEmptyString(row.CodSubpresupuesto) && isNonEmptyString(row.Linea))
  );
}

function isPresupuestoRow(value: unknown): boolean {
  return isRecord(value) && isNonEmptyString(value.CodPresupuesto) && isNonEmptyString(value.Descripcion);
}

function isSubpresupuestoRow(value: unknown): boolean {
  return isRecord(value) && isNonEmptyString(value.CodPresupuesto) && isNonEmptyString(value.CodSubpresupuesto) && isNonEmptyString(value.Descripcion);
}

function isPartidaRow(value: unknown): boolean {
  return isRecord(value) && isNonEmptyString(value.CodPresupuesto) && isNonEmptyString(value.CodSubpresupuesto) && isNonEmptyString(value.CodPartida) && isNonEmptyString(value.Descripcion);
}

function isApuDetalleRow(value: unknown): boolean {
  return isRecord(value) && isNonEmptyString(value.CodPresupuesto) && isNonEmptyString(value.CodSubpresupuesto) && isNonEmptyString(value.CodPartida) && isNonEmptyString(value.CodInsumo) && isNullableText(value.Descripcion);
}

function areOptionalRows(value: unknown, rowValidator: (row: Record<string, unknown>) => boolean = () => true): boolean {
  return value === undefined || (Array.isArray(value) && value.every((row) => isRecord(row) && rowValidator(row)));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableText(value: unknown) {
  return value === null || value === undefined || typeof value === "string";
}

function isSnapshotAdapter(value: unknown): value is S10SnapshotAdapter {
  return value === "sqlserver" || value === "desktop" || value === "legacy";
}

function isIsoDate(value: string) {
  return value.includes("T") && !Number.isNaN(Date.parse(value));
}

function areOptionalMetadataValuesValid(source: Record<string, unknown>) {
  return (source.databaseName === undefined || isNonEmptyString(source.databaseName)) &&
    (source.budgetCode === undefined || isNonEmptyString(source.budgetCode));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
