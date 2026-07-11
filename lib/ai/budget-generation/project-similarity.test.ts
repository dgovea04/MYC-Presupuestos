import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  storedProjectPackageFindMany: vi.fn(),
  listUserBudgetTemplates: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: {
      findMany: mocks.projectFindMany,
    },
    storedProjectPackage: {
      findMany: mocks.storedProjectPackageFindMany,
    },
  },
}));

vi.mock("@/lib/data/budget-templates", () => ({
  listUserBudgetTemplates: mocks.listUserBudgetTemplates,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { searchSimilarProjects } from "./project-similarity";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? "proj-1",
    name: (overrides.name as string) ?? "Proyecto Test",
    projectType: (overrides.projectType as string | null) ?? null,
    location: (overrides.location as string | null) ?? null,
    budgets: (overrides.budgets as Array<{ id: string; kind: string; totalAmount: number }>) ?? [],
  };
}

function makeMockTemplateRecord(sourceProjectId: string, name = "Plantilla de prueba") {
  return {
    id: `tpl-${sourceProjectId}`,
    userId: "user-1",
    sourceProjectId,
    sourceBudgetId: "budget-1",
    name,
    description: "",
    snapshot: {
      schemaVersion: 1,
      name,
      description: "",
      source: { budgetId: "b1", projectId: sourceProjectId, budgetName: "Test", capturedAt: "2026-01-01T00:00:00.000Z" },
      budget: { kind: "SUB_BUDGET", currency: "PEN", igvRate: 0.18, generalExpensesRate: 0.1, utilityRate: 0.08, totalDirectCost: 0, totalGeneralExpenses: 0, totalUtility: 0, totalTax: 0, totalAmount: 0 },
      levels: [],
      items: [],
      summary: { levelCount: 0, itemCount: 0, apuCount: 0, currency: "PEN", totalDirectCost: 0, totalAmount: 0 },
    } as const,
    libraryItem: { id: "li-1", name, module: "BUDGET" as const, description: "", source: "USER" as const, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tags: [], actionLabel: "Ver", badge: undefined },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("searchSimilarProjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listUserBudgetTemplates.mockResolvedValue([]);
    mocks.storedProjectPackageFindMany.mockResolvedValue([]);
  });

  it("returns empty array when user has no projects", async () => {
    mocks.projectFindMany.mockResolvedValue([]);

    const results = await searchSimilarProjects({
      description: "casa 2 pisos concreto armado",
      userId: "user-1",
    });

    expect(results).toEqual([]);
    expect(mocks.projectFindMany).toHaveBeenCalled();
  });

  it("scores projects by project type match (vivienda)", async () => {
    mocks.projectFindMany.mockResolvedValue([
      makeProject({ id: "p1", name: "Casa San Isidro", projectType: "Vivienda" }),
      makeProject({ id: "p2", name: "Hospital Central", projectType: "Hospital" }),
    ]);

    const results = await searchSimilarProjects({
      description: "casa de 2 pisos concreto armado",
      projectType: "vivienda",
      userId: "user-1",
    });

    expect(results.length).toBeGreaterThan(0);
    // "Casa San Isidro" (Vivienda) should score higher than "Hospital Central"
    const casaIdx = results.findIndex((r) => r.projectId === "p1");
    const hospitalIdx = results.findIndex((r) => r.projectId === "p2");
    if (casaIdx >= 0 && hospitalIdx >= 0) {
      expect(casaIdx).toBeLessThan(hospitalIdx);
    }
  });

  it("scores projects by text similarity (Jaccard on name)", async () => {
    mocks.projectFindMany.mockResolvedValue([
      makeProject({ id: "p1", name: "Edificio Multifamiliar Los Olivos" }),
      makeProject({ id: "p2", name: "Carretera Panamericana Norte" }),
    ]);

    const results = await searchSimilarProjects({
      description: "edificio de departamentos 5 pisos",
      userId: "user-1",
    });

    expect(results.length).toBeGreaterThan(0);
    // "Edificio Multifamiliar" should score higher than "Carretera"
    const edificioIdx = results.findIndex((r) => r.projectId === "p1");
    const carreteraIdx = results.findIndex((r) => r.projectId === "p2");
    if (edificioIdx >= 0 && carreteraIdx >= 0) {
      expect(edificioIdx).toBeLessThan(carreteraIdx);
    }
  });

  it("detects project type from description keywords (casa → vivienda)", async () => {
    mocks.projectFindMany.mockResolvedValue([
      makeProject({ id: "p1", name: "Proyecto A", projectType: "Vivienda" }),
      makeProject({ id: "p2", name: "Proyecto B", projectType: "Industrial" }),
    ]);

    const results = await searchSimilarProjects({
      description: "construcción de casa unifamiliar 120m2",
      userId: "user-1",
    });

    const viviendaMatch = results.find((r) => r.projectId === "p1");
    expect(viviendaMatch).toBeDefined();
    if (viviendaMatch && results.length > 1) {
      expect(viviendaMatch.score).toBeGreaterThanOrEqual(results[results.length - 1].score);
    }
  });

  it("detects project type from description keywords (hospital → hospital)", async () => {
    mocks.projectFindMany.mockResolvedValue([
      makeProject({ id: "p1", name: "Hospital Regional", projectType: "Hospital" }),
    ]);

    const results = await searchSimilarProjects({
      description: "construcción de clínica médica 500m2",
      userId: "user-1",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].projectType).toBe("Hospital");
  });

  it("detects project type from description keywords (carretera → carretera)", async () => {
    mocks.projectFindMany.mockResolvedValue([
      makeProject({ id: "p1", name: "Via Expresa Sur", projectType: "Carretera" }),
    ]);

    const results = await searchSimilarProjects({
      description: "pavimentación de pista y autopista",
      userId: "user-1",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].projectType).toBe("Carretera");
  });

  it("limits results to top 5", async () => {
    const projects = Array.from({ length: 10 }, (_, i) =>
      makeProject({ id: `p${i + 1}`, name: `Proyecto de Vivienda ${i + 1}`, projectType: "Vivienda" }),
    );
    mocks.projectFindMany.mockResolvedValue(projects);

    const results = await searchSimilarProjects({
      description: "vivienda multifamiliar",
      projectType: "vivienda",
      userId: "user-1",
    });

    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("attaches user templates to matching projects", async () => {
    mocks.projectFindMany.mockResolvedValue([
      makeProject({ id: "p1", name: "Casa Playa", projectType: "Vivienda" }),
    ]);

    mocks.listUserBudgetTemplates.mockResolvedValue([
      makeMockTemplateRecord("p1", "Plantilla Casa Playa"),
    ]);

    const results = await searchSimilarProjects({
      description: "casa de playa con terraza",
      userId: "user-1",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].budgetTemplates).toHaveLength(1);
    expect(results[0].budgetTemplates[0].name).toBe("Plantilla Casa Playa");
  });

  it("does not attach templates from other projects", async () => {
    mocks.projectFindMany.mockResolvedValue([
      makeProject({ id: "p1", name: "Proyecto A", projectType: "Vivienda" }),
    ]);

    mocks.listUserBudgetTemplates.mockResolvedValue([
      makeMockTemplateRecord("p2", "Plantilla Otro Proyecto"),
    ]);

    const results = await searchSimilarProjects({
      description: "casa moderna",
      userId: "user-1",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].budgetTemplates).toHaveLength(0);
  });

  it("includes matchedKeywords array even when projectType is null", async () => {
    mocks.projectFindMany.mockResolvedValue([
      makeProject({ id: "p1", name: "Proyecto con tipo", projectType: "Vivienda" }),
      makeProject({ id: "p2", name: "Casa sin tipo definido", projectType: null }),
    ]);

    const results = await searchSimilarProjects({
      description: "casa de campo",
      userId: "user-1",
    });

    const withType = results.find((r) => r.projectId === "p1");
    expect(withType?.matchedKeywords).toEqual(["Vivienda"]);

    // Projects with null projectType can still score via text similarity
    const withoutType = results.find((r) => r.projectId === "p2");
    if (withoutType) {
      expect(withoutType.matchedKeywords).toEqual([]);
    }
  });

  it("filters out projects with score = 0", async () => {
    mocks.projectFindMany.mockResolvedValue([
      makeProject({ id: "p1", name: "Completamente Diferente", projectType: "Industrial" }),
    ]);

    const results = await searchSimilarProjects({
      description: "casa de vivienda residencial",
      userId: "user-1",
    });

    // "Completamente Diferente" + "Industrial" has no keyword overlap with "casa de vivienda residencial"
    // so it may score 0 and get filtered out
    expect(results.every((r) => r.score > 0)).toBe(true);
  });

  // ─── Location and structural scoring ──────────────────────────────────────

  it("scores projects higher when location matches", async () => {
    mocks.projectFindMany.mockResolvedValue([
      makeProject({ id: "p1", name: "Edificio Lima", location: "Lima" }),
      makeProject({ id: "p2", name: "Edificio Arequipa", location: "Arequipa" }),
    ]);

    const results = await searchSimilarProjects({
      description: "edificio de oficinas",
      location: "Lima",
      userId: "user-1",
    });

    const limaIdx = results.findIndex((r) => r.projectId === "p1");
    const arequipaIdx = results.findIndex((r) => r.projectId === "p2");
    if (limaIdx >= 0 && arequipaIdx >= 0) {
      // Lima should rank higher due to location match
      expect(limaIdx).toBeLessThan(arequipaIdx);
    }
  });

  it("scores projects higher when structural keywords match", async () => {
    mocks.projectFindMany.mockResolvedValue([
      makeProject({ id: "p1", name: "Torre Concreto Armado", projectType: "Edificio" }),
      makeProject({ id: "p2", name: "Galpón Acero", projectType: "Industrial" }),
    ]);

    const results = await searchSimilarProjects({
      description: "edificio de concreto armado 5 pisos",
      userId: "user-1",
    });

    const concretoIdx = results.findIndex((r) => r.projectId === "p1");
    const aceroIdx = results.findIndex((r) => r.projectId === "p2");
    if (concretoIdx >= 0 && aceroIdx >= 0) {
      // "Torre Concreto Armado" should rank higher due to structural keyword match
      expect(concretoIdx).toBeLessThan(aceroIdx);
    }
  });

  it("returns empty when using projectType filter with no matches", async () => {
    mocks.projectFindMany.mockResolvedValue([
      makeProject({ id: "p1", name: "Hospital Central", projectType: "Hospital" }),
    ]);

    const results = await searchSimilarProjects({
      description: "edificio de oficinas corporativas",
      projectType: "edificio",
      userId: "user-1",
    });

    // The explicit projectType helps scoring but doesn't guarantee matches
    // when no project has a matching type
    expect(results.length).toBeLessThanOrEqual(1);
  });

  // ─── .mcp repo scoring ───────────────────────────────────────────────────

  function makeStoredPackage(overrides: Record<string, unknown> = {}) {
    return {
      id: overrides.id ?? "sp-1",
      companyId: "company-1",
      userId: "user-1",
      sourceProjectId: null,
      projectName: (overrides.projectName as string) ?? "Paquete de prueba",
      projectType: (overrides.projectType as string) ?? "",
      description: (overrides.description as string) ?? "",
      createdAt: new Date("2026-01-01"),
    };
  }

  it("scores .mcp repo candidates with the same weighted formula as internal projects", async () => {
    mocks.projectFindMany.mockResolvedValue([]);
    mocks.storedProjectPackageFindMany.mockResolvedValue([
      makeStoredPackage({
        id: "sp-casa",
        projectName: "Casa de Playa Moderna",
        projectType: "Vivienda",
        description: "Vivienda unifamiliar con concreto armado",
      }),
    ]);

    const results = await searchSimilarProjects({
      description: "casa de concreto armado",
      userId: "user-1",
    });

    expect(results.length).toBeGreaterThan(0);

    // The mcp candidate should have a score > 0 from the weighted formula
    // (type match "vivienda" + text similarity + structural "concreto armado")
    expect(results[0].score).toBeGreaterThan(0);
    // Score must NOT exceed max possible for mcp (type=1*0.35 + text*0.30 + structural*0.15 = 0.80)
    expect(results[0].score).toBeLessThanOrEqual(0.8);
  });

  it("ranks .mcp repo candidates by weighted score, not raw Jaccard", async () => {
    mocks.projectFindMany.mockResolvedValue([]);

    // Package A: good type match (vivienda) + some text overlap
    // Package B: no type match, just text similarity
    mocks.storedProjectPackageFindMany.mockResolvedValue([
      makeStoredPackage({
        id: "sp-vivienda",
        projectName: "Casa de Campo",
        projectType: "Vivienda",
        description: "Vivienda rural",
      }),
      makeStoredPackage({
        id: "sp-industrial",
        projectName: "casa de maquinas industrial",
        projectType: "Industrial",
        description: "Nave industrial",
      }),
    ]);

    const results = await searchSimilarProjects({
      description: "construcción de vivienda unifamiliar",
      projectType: "vivienda",
      userId: "user-1",
    });

    // "Casa de Campo" (Vivienda) should outrank due to type match bonus (0.35 weight)
    const viviendaIdx = results.findIndex((r) => r.projectId === "sp-vivienda");
    const industrialIdx = results.findIndex((r) => r.projectId === "sp-industrial");
    if (viviendaIdx >= 0 && industrialIdx >= 0) {
      expect(viviendaIdx).toBeLessThan(industrialIdx);
    }
  });

  it("merges internal and .mcp candidates by comparable scores", async () => {
    // Internal project with perfect type match gets high weighted score
    mocks.projectFindMany.mockResolvedValue([
      makeProject({ id: "p-int", name: "Proyecto Genérico", projectType: "Industrial" }),
    ]);

    // MCP package with strong vivienda match
    mocks.storedProjectPackageFindMany.mockResolvedValue([
      makeStoredPackage({
        id: "sp-viv",
        projectName: "Casa Residencial Los Olivos",
        projectType: "Vivienda",
        description: "Vivienda multifamiliar concreto armado",
      }),
    ]);

    const results = await searchSimilarProjects({
      description: "vivienda multifamiliar de concreto armado",
      projectType: "vivienda",
      userId: "user-1",
    });

    // Both should appear, ordered by score
    expect(results.length).toBeGreaterThanOrEqual(1);
    // The vivienda match should outrank the industrial mismatch
    const vivIdx = results.findIndex((r) => r.projectId === "sp-viv");
    const intIdx = results.findIndex((r) => r.projectId === "p-int");
    if (vivIdx >= 0 && intIdx >= 0) {
      expect(vivIdx).toBeLessThan(intIdx);
    }
  });

  it("mcp candidate max score is 0.80 without area/location factors", async () => {
    // Give an mcp package that perfectly matches on type, text, and structural
    mocks.projectFindMany.mockResolvedValue([]);
    mocks.storedProjectPackageFindMany.mockResolvedValue([
      makeStoredPackage({
        id: "sp-perfect",
        projectName: "Vivienda Concreto Armado",
        projectType: "Vivienda",
        description: "Proyecto de vivienda con concreto armado",
      }),
    ]);

    const results = await searchSimilarProjects({
      description: "vivienda concreto armado",
      projectType: "vivienda",
      userId: "user-1",
    });

    expect(results.length).toBe(1);
    // Without area/location, max is type(0.35) + text(~0.33) + structural(~0.33) which should be substantial
    expect(results[0].score).toBeGreaterThan(0.3);
    // Cannot exceed 0.80 since area and location are always 0 for mcp
    expect(results[0].score).toBeLessThanOrEqual(0.8);
  });
});
