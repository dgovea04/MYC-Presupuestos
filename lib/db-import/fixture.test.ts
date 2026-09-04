import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDbSnapshot } from "@/lib/db-import/service";
import { listDbProjects, readDbProject } from "@/lib/db-import/sqlite-reader";

const fixturePath = path.resolve(process.cwd(), "presupuesto-ejemplo", "db", "PAVIMENTADO RIGIDO DE LA CALLE _28 DE JULIO_.db");

describe("db-import repository fixture", () => {
  it("reads the real SQLite fixture without modifying it", () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const before = fs.statSync(fixturePath);
    const projects = listDbProjects(fixturePath);

    expect(projects.length).toBeGreaterThan(0);
    expect(projects[0]?.name.length).toBeGreaterThan(0);
    expect(projects[0]?.itemCount).toBeGreaterThan(0);

    const project = readDbProject(fixturePath, projects[0]?.id ?? "");
    const items = project.project.subBudgets.flatMap((subBudget) => subBudget.items);
    const titles = items.filter((item) => item.isTitle);
    const budgetItems = items.filter((item) => !item.isTitle);

    expect(titles.length + budgetItems.length).toBeGreaterThan(0);
    expect(budgetItems.length).toBeGreaterThan(0);
    expect(project.project.resources.length).toBeGreaterThan(0);

    const snapshotResult = createDbSnapshot(fixturePath, projects[0]?.id ?? "");
    expect(snapshotResult.snapshot.schema).toBe("mc.s10.snapshot");
    expect(snapshotResult.snapshot.payload.partidas.length).toBe(budgetItems.length);
    expect(snapshotResult.snapshot.payload.apuDetalles.length).toBeGreaterThan(0);

    const after = fs.statSync(fixturePath);
    expect(after.size).toBe(before.size);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });
});
