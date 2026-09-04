import { createS10SnapshotContract } from "@/lib/s10/snapshot-contract";
import { convertDbProjectToS10Snapshot } from "@/lib/db-import/snapshot-mapper";
import { listDbProjects, readDbProject, readDbSchema } from "@/lib/db-import/sqlite-reader";
import type { DbProjectSummary, DbReadResult, DbSnapshotResult } from "@/lib/db-import/types";

export function discoverDbProjects(filePath: string): DbProjectSummary[] {
  return listDbProjects(filePath);
}

export function createDbSnapshot(filePath: string, projectId: string, subBudgetId?: string): DbSnapshotResult {
  const result: DbReadResult = readDbProject(filePath, projectId, subBudgetId);
  const snapshot = convertDbProjectToS10Snapshot(result.project);
  const contract = createS10SnapshotContract(snapshot, {
    adapter: "db",
    databaseName: "SQLite .db",
    budgetCode: "DB",
  });

  return {
    snapshot: contract,
    inspection: result.inspection,
    project: result.project,
  };
}

export function inspectDb(filePath: string) {
  return readDbSchema(filePath);
}
