import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildStoredZip, getExportDefinition, normalizeExportRequest } from "@/lib/exports/centralized";

// ─── Hoisted mocks for createCentralizedExport (project_package) ─────────────

const exportMocks = vi.hoisted(() => ({
  buildProjectPackageSnapshot: vi.fn(),
  buildProjectPackageArchive: vi.fn(),
  projectFindFirst: vi.fn(),
  storeProjectPackage: vi.fn(),
}));

vi.mock("@/lib/mcp/export-snapshot", () => ({
  buildProjectPackageSnapshot: exportMocks.buildProjectPackageSnapshot,
  buildProjectPackageArchive: exportMocks.buildProjectPackageArchive,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: {
      findFirst: exportMocks.projectFindFirst,
    },
  },
}));

vi.mock("@/lib/data/stored-project-packages", () => ({
  storeProjectPackage: exportMocks.storeProjectPackage,
}));

// ─── Lazy import after mocks are installed ──────────────────────────────────

const { createCentralizedExport } = await import("@/lib/exports/centralized");

describe("centralized export registry", () => {
  it("normalizes valid export requests and applies default options", () => {
    const request = normalizeExportRequest({
      target: "budget",
      targetId: "budget-1",
      format: "xlsx",
      preset: "presupuesto_detallado",
      options: { includeSignature: false, currencyDecimals: 3 },
    });

    expect(request).toEqual({
      target: "budget",
      targetId: "budget-1",
      format: "xlsx",
      preset: "presupuesto_detallado",
      options: expect.objectContaining({
        includeSignature: false,
        includeSubtotals: true,
        includeTotals: true,
        currencyDecimals: 3,
      }),
    });
  });

  it("rejects unsupported target, format, and preset combinations", () => {
    expect(() =>
      normalizeExportRequest({
        target: "budget",
        targetId: "budget-1",
        format: "zip",
        preset: "presupuesto_detallado",
      }),
    ).toThrow("La combinacion de modulo, formato y preset no esta disponible");
  });

  it("exposes module definitions for the export panel", () => {
    const definition = getExportDefinition("work_schedule");

    expect(definition.label).toBe("Cronograma de obra");
    expect(definition.presets.map((preset) => preset.id)).toContain("cronograma_ejecutivo");
    expect(definition.presets.find((preset) => preset.id === "cronograma_ejecutivo")?.formats).toContain("zip");
  });

  it("exposes definitions for resources, expenses, footer, formula, and schedule PDF", () => {
    expect(getExportDefinition("resources").presets[0]?.id).toBe("catalogo_insumos");
    expect(getExportDefinition("budget_resources").presets[0]?.id).toBe("lista_insumos_derivada");
    expect(getExportDefinition("general_expenses").presets[0]?.id).toBe("gastos_generales_detallado");
    expect(getExportDefinition("budget_footer").presets[0]?.id).toBe("pie_presupuesto_detallado");
    expect(getExportDefinition("polynomial_formula").presets[0]?.id).toBe("formula_polinomica_detallada");
    expect(getExportDefinition("work_schedule").presets.every((preset) => preset.formats.includes("pdf"))).toBe(true);
  });

  it("exposes the configurable project document ZIP preset", () => {
    const preset = getExportDefinition("project_package").presets.find((item) => item.id === "proyecto_completo_zip");

    expect(preset?.formats).toEqual(["zip"]);
    expect(preset?.defaultOptions.packageFormats).toEqual(["xlsx", "pdf", "csv"]);
    expect(preset?.defaultOptions.packageSections).toContain("sub_budgets");
  });
});

describe("stored zip builder", () => {
  it("creates a zip payload with every requested file name", () => {
    const zip = buildStoredZip([
      { fileName: "resumen.csv", content: "Periodo,Total\n2026-05,100" },
      { fileName: "detalle.csv", content: "Codigo,Parcial\n01.01,80" },
    ]);
    const text = zip.toString("latin1");

    expect(zip.byteLength).toBeGreaterThan(100);
    expect(text).toContain("resumen.csv");
    expect(text).toContain("detalle.csv");
    expect(text).toContain("PK\u0005\u0006");
  });
});

// ─── MCP project package export with storage ────────────────────────────────

describe("createCentralizedExport (project_package)", () => {
  const mockArchive = {
    content: Buffer.from("mock-zip-content"),
    fileName: "mi-proyecto.mcp",
  };

  const mockProjectMeta = {
    companyId: "company-1",
    name: "Mi Proyecto",
    projectType: "Vivienda",
  };

  const validRequest = {
    target: "project_package" as const,
    targetId: "proj-1",
    format: "mcp" as const,
    preset: "proyecto_completo_mcp" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    exportMocks.buildProjectPackageSnapshot.mockResolvedValue({
      manifest: { project: { name: "Mi Proyecto", slug: "mi-proyecto", currency: "PEN" } },
      files: [],
    });
    exportMocks.buildProjectPackageArchive.mockReturnValue(mockArchive);
    exportMocks.projectFindFirst.mockResolvedValue(mockProjectMeta);
    exportMocks.storeProjectPackage.mockResolvedValue({
      id: "stored-1",
      projectName: "Mi Proyecto",
      projectType: "Vivienda",
      description: "Proyecto exportado: Mi Proyecto (Vivienda)",
      createdAt: "2026-01-01T00:00:00.000Z",
      companyId: "company-1",
      userId: "user-1",
      sourceProjectId: null,
    });
  });

  it("stores a copy in the .mcp repo when exporting a project package", async () => {
    const result = await createCentralizedExport(validRequest, "user-1");

    // Should call storeProjectPackage with correct arguments
    expect(exportMocks.storeProjectPackage).toHaveBeenCalledTimes(1);
    expect(exportMocks.storeProjectPackage).toHaveBeenCalledWith({
      projectName: "Mi Proyecto",
      projectType: "Vivienda",
      description: "Proyecto exportado: Mi Proyecto (Vivienda)",
      content: mockArchive.content,
      companyId: "company-1",
      userId: "user-1",
    });

    // Should still return the correct export result
    expect(result).toEqual({
      content: mockArchive.content,
      contentType: "application/octet-stream",
      fileName: "mi-proyecto.mcp",
    });
  });

  it("passes empty projectType when project has none", async () => {
    exportMocks.projectFindFirst.mockResolvedValue({
      ...mockProjectMeta,
      projectType: null,
    });

    await createCentralizedExport(validRequest, "user-1");

    expect(exportMocks.storeProjectPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        projectType: "",
        description: "Proyecto exportado: Mi Proyecto (Sin tipo)",
      }),
    );
  });

  it("still returns the export result when storage fails", async () => {
    exportMocks.storeProjectPackage.mockRejectedValue(
      new Error("DB connection lost"),
    );

    const result = await createCentralizedExport(validRequest, "user-1");

    // Export should still succeed
    expect(result).toEqual({
      content: mockArchive.content,
      contentType: "application/octet-stream",
      fileName: "mi-proyecto.mcp",
    });
  });

  it("still returns the export result when project metadata lookup fails", async () => {
    exportMocks.projectFindFirst.mockRejectedValue(
      new Error("DB timeout"),
    );

    const result = await createCentralizedExport(validRequest, "user-1");

    // Export should still succeed
    expect(result).toEqual({
      content: mockArchive.content,
      contentType: "application/octet-stream",
      fileName: "mi-proyecto.mcp",
    });

    // storeProjectPackage should NOT be called since projectMeta was null
    expect(exportMocks.storeProjectPackage).not.toHaveBeenCalled();
  });

  it("skips storage when project is not found (null metadata)", async () => {
    exportMocks.projectFindFirst.mockResolvedValue(null);

    const result = await createCentralizedExport(validRequest, "user-1");

    // Export should still succeed
    expect(result).toEqual({
      content: mockArchive.content,
      contentType: "application/octet-stream",
      fileName: "mi-proyecto.mcp",
    });

    // storeProjectPackage should NOT be called
    expect(exportMocks.storeProjectPackage).not.toHaveBeenCalled();
  });

  it("returns the MCP content type and archive file name", async () => {
    const result = await createCentralizedExport(validRequest, "user-1");

    expect(result.contentType).toBe("application/octet-stream");
    expect(result.fileName).toBe("mi-proyecto.mcp");
    expect(Buffer.isBuffer(result.content)).toBe(true);
  });

  it("preserves the binary content of the MCP archive", async () => {
    const customContent = Buffer.from("custom-binary-mcp-data");
    exportMocks.buildProjectPackageArchive.mockReturnValue({
      content: customContent,
      fileName: "output.mcp",
    });

    const result = await createCentralizedExport(validRequest, "user-1");

    expect(result.content).toBe(customContent);
    expect(exportMocks.storeProjectPackage).toHaveBeenCalledWith(
      expect.objectContaining({ content: customContent }),
    );
  });
});
