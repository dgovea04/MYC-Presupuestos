import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

function readMetradoMigrationSql(): string {
  return readdirSync(migrationsDir)
    .filter((name) => name.includes("metrado"))
    .sort()
    .map((migrationDirName) => readFileSync(path.join(migrationsDir, migrationDirName, "migration.sql"), "utf8"))
    .join("\n");
}

describe("metrado Prisma migration", () => {
  test("creates the database objects used by ensureMetradoTemplates", () => {
    const sql = readMetradoMigrationSql();

    expect(sql).toContain('CREATE TYPE "MetradoTemplateType"');
    expect(sql).toContain('CREATE TYPE "MetradoSheetStatus"');
    expect(sql).toContain('CREATE TABLE "metrado_templates"');
    expect(sql).toContain('CREATE TABLE "metrado_formulas"');
    expect(sql).toContain('CREATE TABLE "metrado_sheets"');
    expect(sql).toContain('CREATE TABLE "metrado_rows"');
    expect(sql).toContain('CREATE TABLE "metrado_partida_links"');
    expect(sql).toContain('CREATE TABLE "custom_metrado_formulas"');
    expect(sql).toContain('CREATE UNIQUE INDEX "BudgetItem_id_budgetId_key"');
  });
});
