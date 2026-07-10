import { describe, it, expect } from "vitest";
import { analyzeProjectPackageBuffer } from "./import-preview";
import { buildMinimalProjectPackageBuffer } from "./fixtures/minimal-project-package";
import { buildFullProjectPackageBuffer } from "./fixtures/full-project-package";
import { buildStoredZip } from "./archive";
import { createSha256Checksums } from "./checksums";
import type { McpManifest } from "./types";

describe("MCP import preview", () => {
  it("returns a compatible preview (supported or supported_with_warnings) for a valid minimal .mcp package", () => {
    const buffer = buildMinimalProjectPackageBuffer();
    const result = analyzeProjectPackageBuffer(buffer);

    // Optional modules like project_resources may be missing from the fixture,
    // causing supported_with_warnings. Either compatibility is valid.
    expect(["supported", "supported_with_warnings"]).toContain(result.preview.compatibility);
    expect(result.preview.projectName).toBe("Proyecto de prueba");
    expect(result.preview.formatVersion).toBe("1.0.0");
    expect(result.preview.sourceApp).toBe("MC Presupuestos");
    expect(result.preview.errors).toHaveLength(0);
  });

  it("returns a compatible preview for a full .mcp package", () => {
    const buffer = buildFullProjectPackageBuffer();
    const result = analyzeProjectPackageBuffer(buffer);

    expect(["supported", "supported_with_warnings"]).toContain(result.preview.compatibility);
    expect(result.preview.projectName).toBe("Hospital Norte");
  });

  it("detects all required modules as present", () => {
    const buffer = buildMinimalProjectPackageBuffer();
    const result = analyzeProjectPackageBuffer(buffer);

    const requiredModules = result.preview.modules.filter((module) => module.required);
    for (const module of requiredModules) {
      expect(module.present).toBe(true);
    }
  });

  it("rejects corrupted checksum", () => {
    const buffer = buildMinimalProjectPackageBuffer();

    // Replace bytes in the ZIP content to corrupt data after the manifest
    const corrupted = Buffer.from(buffer);
    if (corrupted.length > 200) {
      // Corrupt the project.json content by modifying bytes in the content area
      // The manifest.json starts early in the ZIP, so corrupt later bytes
      corrupted[corrupted.length - 200] = corrupted[corrupted.length - 200] === 65 ? 66 : 65;
    }

    expect(() => analyzeProjectPackageBuffer(corrupted)).toThrow();
  });

  it("rejects an archive whose checksum does not match a module's content", () => {
    // Build a structurally valid ZIP with a manifest that has a wrong checksum for project.json
    const projectContent = JSON.stringify({ name: "Tampered", currency: "PEN" });
    const manifest: McpManifest = {
      format: "MC_PROJECT_PACKAGE",
      formatVersion: "1.0.0",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: { app: "MC Presupuestos", appVersion: "0.1.0", environment: "test" },
      package: { fileExtension: ".mcp", compression: "zip-store", checksumAlgorithm: "sha256" },
      project: { slug: "tampered", name: "Tampered", currency: "PEN" },
      modules: [
        { id: "project", path: "project.json", required: true },
        { id: "budgets", path: "budgets/budget-tree.json", required: true },
        { id: "budget_items", path: "budgets/budget-items.json", required: true },
        { id: "apus", path: "budgets/apus.json", required: true },
      ],
      capabilities: { restoreAsNewProject: true, preview: true, merge: false },
      namespaces: ["core", "mc"],
      extensions: [],
      // Deliberately wrong checksum: all zeros vs actual content
      checksums: {
        "project.json": "0000000000000000000000000000000000000000000000000000000000000000",
      },
    };

    const budgetTreeJson = JSON.stringify({ budgets: [] });
    const budgetItemsJson = JSON.stringify({ budgets: [] });
    const apusJson = JSON.stringify({ apus: [] });

    // Build correct checksums for non-tampered files so those pass
    const correctChecksums = createSha256Checksums([
      { path: "budgets/budget-tree.json", content: budgetTreeJson },
      { path: "budgets/budget-items.json", content: budgetItemsJson },
      { path: "budgets/apus.json", content: apusJson },
    ]);
    manifest.checksums = { ...manifest.checksums, ...correctChecksums };

    const tamperedBuffer = buildStoredZip([
      { fileName: "manifest.json", content: JSON.stringify(manifest) },
      { fileName: "project.json", content: projectContent },
      { fileName: "budgets/budget-tree.json", content: budgetTreeJson },
      { fileName: "budgets/budget-items.json", content: budgetItemsJson },
      { fileName: "budgets/apus.json", content: apusJson },
    ]);

    expect(() => analyzeProjectPackageBuffer(tamperedBuffer)).toThrow("checksum");
  });

  it("rejects empty buffer", () => {
    expect(() => analyzeProjectPackageBuffer(Buffer.alloc(0))).toThrow();
  });

  it("rejects oversized buffer", () => {
    const bigBuffer = Buffer.alloc(41 * 1024 * 1024 + 1);
    expect(() => analyzeProjectPackageBuffer(bigBuffer)).toThrow("40 MB");
  });

  it("manifest contains checksums matching extracted files", () => {
    const buffer = buildMinimalProjectPackageBuffer();
    const result = analyzeProjectPackageBuffer(buffer);

    for (const [path] of result.fileContents) {
      if (path === "checksums/sha256.json" || path === "manifest.json") {
        continue;
      }
      expect(result.manifest.checksums[path]).toBeTruthy();
    }
  });

  it("parses valid .mcp ZIP with manifest", () => {
    const manifest: McpManifest = {
      format: "MC_PROJECT_PACKAGE",
      formatVersion: "1.0.0",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: { app: "MC Presupuestos", appVersion: "0.1.0", environment: "test" },
      package: { fileExtension: ".mcp", compression: "zip-store", checksumAlgorithm: "sha256" },
      project: { slug: "test", name: "Test", currency: "PEN" },
      modules: [
        { id: "project", path: "project.json", required: true },
        { id: "budgets", path: "budgets/budget-tree.json", required: true },
        { id: "budget_items", path: "budgets/budget-items.json", required: true },
        { id: "apus", path: "budgets/apus.json", required: true },
      ],
      capabilities: { restoreAsNewProject: true, preview: true, merge: false },
      namespaces: ["core", "mc"],
      extensions: [],
      checksums: {},
    };

    const projectJson = JSON.stringify({ name: "Test", currency: "PEN" });
    const budgetTreeJson = JSON.stringify({ budgets: [] });
    const budgetItemsJson = JSON.stringify({ budgets: [] });
    const apusJson = JSON.stringify({ apus: [] });

    // Build checksums
    const rawFiles = [
      { path: "project.json", content: projectJson },
      { path: "budgets/budget-tree.json", content: budgetTreeJson },
      { path: "budgets/budget-items.json", content: budgetItemsJson },
      { path: "budgets/apus.json", content: apusJson },
    ];
    const checksums = createSha256Checksums(rawFiles);
    manifest.checksums = checksums;

    // Build valid ZIP
    const validBuffer = buildStoredZip([
      { fileName: "manifest.json", content: JSON.stringify(manifest) },
      { fileName: "project.json", content: projectJson },
      { fileName: "budgets/budget-tree.json", content: budgetTreeJson },
      { fileName: "budgets/budget-items.json", content: budgetItemsJson },
      { fileName: "budgets/apus.json", content: apusJson },
    ]);

    const result = analyzeProjectPackageBuffer(validBuffer);
    expect(result.preview.projectName).toBe("Test");
    expect(result.preview.compatibility).toBe("supported");
  });
});
