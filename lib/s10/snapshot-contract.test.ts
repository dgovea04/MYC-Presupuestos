import { describe, expect, it } from "vitest";

import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";
import {
  createS10SnapshotContract,
  parseS10SnapshotJson,
  serializeS10SnapshotContract,
  S10_SNAPSHOT_CONTRACT_VERSION,
  S10_SNAPSHOT_SCHEMA,
} from "@/lib/s10/snapshot-contract";

const snapshot: S10ExportSnapshot = {
  presupuestos: [{ CodPresupuesto: "0302044", Descripcion: "OBRA S10" }],
  subpresupuestos: [{ CodPresupuesto: "0302044", CodSubpresupuesto: "001", Descripcion: "ESTRUCTURAS" }],
  partidas: [],
  apuDetalles: [],
};

describe("S10 snapshot contract", () => {
  it("creates and serializes a versioned envelope", () => {
    const contract = createS10SnapshotContract(snapshot, {
      adapter: "sqlserver",
      databaseName: "S10_OBRA_MYC",
      budgetCode: "0302044",
      exportedAt: "2026-08-10T12:00:00.000Z",
    });

    expect(contract).toMatchObject({
      schema: S10_SNAPSHOT_SCHEMA,
      contractVersion: S10_SNAPSHOT_CONTRACT_VERSION,
      exportedAt: "2026-08-10T12:00:00.000Z",
      source: { system: "S10", adapter: "sqlserver", databaseName: "S10_OBRA_MYC", budgetCode: "0302044" },
      payload: snapshot,
    });
    expect(parseS10SnapshotJson(serializeS10SnapshotContract(contract))).toMatchObject({
      wasLegacy: false,
      snapshot,
    });
  });

  it("accepts legacy snapshots and marks them for upgrade", () => {
    const parsed = parseS10SnapshotJson(`\uFEFF${JSON.stringify(snapshot)}`);

    expect(parsed.wasLegacy).toBe(true);
    expect(parsed.snapshot).toEqual(snapshot);
    expect(parsed.contract.source.adapter).toBe("legacy");
    expect(parsed.contract.contractVersion).toBe(S10_SNAPSHOT_CONTRACT_VERSION);
  });

  it("rejects unsupported major versions", () => {
    expect(() =>
      parseS10SnapshotJson(
        JSON.stringify({
          schema: S10_SNAPSHOT_SCHEMA,
          contractVersion: "2.0.0",
          exportedAt: "2026-08-10T12:00:00.000Z",
          source: { system: "S10", adapter: "desktop" },
          payload: snapshot,
        }),
      ),
    ).toThrow("no es compatible");
  });

  it("rejects malformed semver and invalid source metadata", () => {
    expect(() =>
      parseS10SnapshotJson(
        JSON.stringify({
          schema: S10_SNAPSHOT_SCHEMA,
          contractVersion: "1",
          exportedAt: "2026-08-10T12:00:00.000Z",
          source: { system: "S10", adapter: "desktop" },
          payload: snapshot,
        }),
      ),
    ).toThrow("no es compatible");

    expect(() =>
      parseS10SnapshotJson(
        JSON.stringify({
          schema: S10_SNAPSHOT_SCHEMA,
          contractVersion: S10_SNAPSHOT_CONTRACT_VERSION,
          exportedAt: "not-a-date",
          source: { system: "S10", adapter: "desktop" },
          payload: snapshot,
        }),
      ),
    ).toThrow("exportedAt");
  });

  it("rejects versioned envelopes without the required payload arrays", () => {
    expect(() =>
      parseS10SnapshotJson(
        JSON.stringify({
          schema: S10_SNAPSHOT_SCHEMA,
          contractVersion: S10_SNAPSHOT_CONTRACT_VERSION,
          exportedAt: "2026-08-10T12:00:00.000Z",
          source: { system: "S10", adapter: "desktop" },
          payload: { presupuestos: [] },
        }),
      ),
    ).toThrow("payload");
  });
});
