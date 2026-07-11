import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  storedProjectPackageFindMany: vi.fn(),
  storedPkgFindFirst: vi.fn(),
  catalogPartidaFindMany: vi.fn(),
  // For applicator
  transaction: vi.fn(),
  budgetFindFirst: vi.fn(),
  budgetCreate: vi.fn(),
  budgetFindMany: vi.fn(),
  budgetUpdate: vi.fn(),
  budgetLevelCreate: vi.fn(),
  budgetItemCreate: vi.fn(),
  apuCreate: vi.fn(),
  apuResourceCreate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    project: { findFirst: mocks.projectFindFirst },
    budget: {
      findFirst: mocks.budgetFindFirst,
      create: mocks.budgetCreate,
      findMany: mocks.budgetFindMany,
      update: mocks.budgetUpdate,
    },
    budgetLevel: { create: mocks.budgetLevelCreate },
    budgetItem: { create: mocks.budgetItemCreate },
    apu: { create: mocks.apuCreate },
    apuResource: { create: mocks.apuResourceCreate },
    storedProjectPackage: {
      findMany: mocks.storedProjectPackageFindMany,
      findFirst: mocks.storedPkgFindFirst,
    },
    catalogPartida: { findMany: mocks.catalogPartidaFindMany },
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import {
  searchMcpTemplatesTool,
  previewBudgetFromMcpTemplateTool,
  applyBudgetFromMcpTemplateTool,
} from "./mcp-budget";
import type { AgentToolContext } from "../types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    userId: "user-1",
    projectId: "proj-1",
    executionId: "exec-1",
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("searchMcpTemplatesTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storedProjectPackageFindMany.mockResolvedValue([]);
  });

  it("returns empty candidates when no packages found", async () => {
    const result = await searchMcpTemplatesTool.execute(
      { query: "casa de 2 pisos", limit: 5 },
      makeContext(),
    );

    expect(result.count).toBe(0);
    expect(result.candidates).toEqual([]);
  });

  it("returns candidates sorted by score", async () => {
    mocks.storedProjectPackageFindMany.mockResolvedValue([
      {
        id: "pkg-1",
        companyId: "comp-1",
        userId: "user-1",
        sourceProjectId: null,
        projectName: "Casa Modelo",
        projectType: "Vivienda",
        description: "Vivienda unifamiliar concreto armado",
        createdAt: new Date("2026-01-01"),
      },
    ]);

    const result = await searchMcpTemplatesTool.execute(
      { query: "casa de concreto armado", limit: 3, projectType: "vivienda" },
      makeContext(),
    );

    expect(result.count).toBeGreaterThan(0);
    expect(result.candidates[0].projectName).toBe("Casa Modelo");
  });

  it("respects the limit parameter", async () => {
    mocks.storedProjectPackageFindMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `pkg-${i}`,
        companyId: "comp-1",
        userId: "user-1",
        sourceProjectId: null,
        projectName: `Test ${i}`,
        projectType: "Vivienda",
        description: "test",
        createdAt: new Date("2026-01-01"),
      })),
    );

    const result = await searchMcpTemplatesTool.execute(
      { query: "test", limit: 3 },
      makeContext(),
    );

    expect(result.candidates.length).toBeLessThanOrEqual(3);
  });

  it("summarizes correctly", () => {
    const summary = searchMcpTemplatesTool.summarizeResult!({
      query: "casa",
      projectType: null,
      count: 2,
      candidates: [],
    });
    expect(summary).toContain("2 paquetes");
  });
});

describe("previewBudgetFromMcpTemplateTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.projectFindFirst.mockResolvedValue({ companyId: "comp-1" });
  });

  it("throws when project is not accessible", async () => {
    mocks.projectFindFirst.mockResolvedValue(null);

    await expect(
      previewBudgetFromMcpTemplateTool.execute(
        {
          projectId: "proj-invalid",
          packageId: "pkg-1",
          description: "vivienda de 120m2 en Lima",
        },
        makeContext(),
      ),
    ).rejects.toThrow(/acceso|no encontrado/);
  });

  it("throws when package is not found", async () => {
    mocks.storedPkgFindFirst.mockResolvedValue(null);

    await expect(
      previewBudgetFromMcpTemplateTool.execute(
        {
          projectId: "proj-1",
          packageId: "pkg-invalid",
          description: "vivienda de 120m2 en Lima",
        },
        makeContext(),
      ),
    ).rejects.toThrow();
  });

  it("has correct risk level", () => {
    expect(previewBudgetFromMcpTemplateTool.risk).toBe("read");
  });

  it("requires project ID", () => {
    expect(previewBudgetFromMcpTemplateTool.requiresProjectId).toBe(true);
  });
});

describe("applyBudgetFromMcpTemplateTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.projectFindFirst.mockResolvedValue({ companyId: "comp-1" });
  });

  it("has correct risk level", () => {
    expect(applyBudgetFromMcpTemplateTool.risk).toBe("financial");
  });

  it("requires project ID", () => {
    expect(applyBudgetFromMcpTemplateTool.requiresProjectId).toBe(true);
  });

  it("throws when project is not accessible", async () => {
    mocks.projectFindFirst.mockResolvedValue(null);

    await expect(
      applyBudgetFromMcpTemplateTool.execute(
        {
          projectId: "proj-invalid",
          packageId: "pkg-1",
          description: "vivienda de 120m2 en Lima",
          mode: "review_required",
        },
        makeContext(),
      ),
    ).rejects.toThrow(/acceso|no encontrado/);
  });

  it("defaults to review_required mode", async () => {
    // Verify the input schema defaults
    const schema = applyBudgetFromMcpTemplateTool.inputSchema;
    const parsed = schema.parse({
      projectId: "proj-1",
      packageId: "pkg-1",
      description: "vivienda de 120m2 en Lima",
    });
    expect(parsed.mode).toBe("review_required");
  });
});

describe("mcpBudgetTools", () => {
  it("exports all three tools", async () => {
    const { mcpBudgetTools } = await import("./mcp-budget");
    expect(mcpBudgetTools).toHaveLength(3);

    const names = mcpBudgetTools.map((t) => t.name);
    expect(names).toContain("searchMcpTemplates");
    expect(names).toContain("previewBudgetFromMcpTemplate");
    expect(names).toContain("applyBudgetFromMcpTemplate");
  });
});
