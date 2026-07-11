import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  storedProjectPackageFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    storedProjectPackage: {
      findMany: mocks.storedProjectPackageFindMany,
    },
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { searchMcpTemplateCandidates, MCP_TEMPLATE_STRONG_MATCH, MCP_TEMPLATE_REVIEW_MATCH } from "./mcp-template-search";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeStoredPackage(overrides: Record<string, unknown> = {}) {
  return {
    id: (overrides.id as string) ?? "pkg-1",
    companyId: "company-1",
    userId: "user-1",
    sourceProjectId: null,
    projectName: (overrides.projectName as string) ?? "Paquete test",
    projectType: (overrides.projectType as string) ?? "",
    description: (overrides.description as string) ?? "",
    createdAt: new Date("2026-01-01"),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("searchMcpTemplateCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("thresholds", () => {
    it("MCP_TEMPLATE_STRONG_MATCH is 0.50", () => {
      expect(MCP_TEMPLATE_STRONG_MATCH).toBe(0.50);
    });

    it("MCP_TEMPLATE_REVIEW_MATCH is 0.35", () => {
      expect(MCP_TEMPLATE_REVIEW_MATCH).toBe(0.35);
    });
  });

  describe("basic search", () => {
    it("returns empty array when no packages exist", async () => {
      mocks.storedProjectPackageFindMany.mockResolvedValue([]);

      const results = await searchMcpTemplateCandidates({
        userId: "user-1",
        companyId: "company-1",
        description: "casa de 2 pisos",
      });

      expect(results).toEqual([]);
    });

    it("finds matching packages by project type (vivienda)", async () => {
      mocks.storedProjectPackageFindMany.mockResolvedValue([
        makeStoredPackage({
          id: "pkg-vivienda",
          projectName: "Casa Modelo",
          projectType: "Vivienda",
          description: "Vivienda unifamiliar 2 pisos",
        }),
      ]);

      const results = await searchMcpTemplateCandidates({
        userId: "user-1",
        companyId: "company-1",
        description: "casa de 2 pisos concreto armado",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].packageId).toBe("pkg-vivienda");
      expect(results[0].score).toBeGreaterThan(0.5);
    });

    it("scores vivienda package higher than hospital for vivienda query", async () => {
      mocks.storedProjectPackageFindMany.mockResolvedValue([
        makeStoredPackage({
          id: "pkg-vivienda",
          projectName: "Casa 2 pisos",
          projectType: "Vivienda",
          description: "Vivienda unifamiliar con concreto",
        }),
        makeStoredPackage({
          id: "pkg-hospital",
          projectName: "Hospital Central",
          projectType: "Hospital",
          description: "Hospital con concreto armado",
        }),
      ]);

      const results = await searchMcpTemplateCandidates({
        userId: "user-1",
        companyId: "company-1",
        description: "vivienda de 2 pisos",
        projectType: "vivienda",
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      const vivIdx = results.findIndex((r) => r.packageId === "pkg-vivienda");
      const hospIdx = results.findIndex((r) => r.packageId === "pkg-hospital");
      if (vivIdx >= 0 && hospIdx >= 0) {
        expect(vivIdx).toBeLessThan(hospIdx);
      }
    });
  });

  describe("project type detection", () => {
    it("detects vivienda from 'casa' keyword", async () => {
      mocks.storedProjectPackageFindMany.mockResolvedValue([
        makeStoredPackage({ id: "p1", projectName: "Casa Playa", projectType: "Vivienda", description: "Casa moderna" }),
      ]);

      const results = await searchMcpTemplateCandidates({
        userId: "user-1",
        companyId: "company-1",
        description: "construccion de casa unifamiliar",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0.35);
    });

    it("detects carretera from 'pista' keyword", async () => {
      mocks.storedProjectPackageFindMany.mockResolvedValue([
        makeStoredPackage({ id: "p1", projectName: "Via Expresa", projectType: "Carretera", description: "Pavimento via" }),
      ]);

      const results = await searchMcpTemplateCandidates({
        userId: "user-1",
        companyId: "company-1",
        description: "pavimentacion de pista 3km",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].projectType).toBe("Carretera");
    });
  });

  describe("scoring", () => {
    it("returns candidates sorted by score descending", async () => {
      mocks.storedProjectPackageFindMany.mockResolvedValue([
        makeStoredPackage({ id: "low", projectName: "XYZ", projectType: "Industrial", description: "" }),
        makeStoredPackage({ id: "high", projectName: "Casa Modelo Vivienda", projectType: "Vivienda", description: "Vivienda unifamiliar concreto armado" }),
        makeStoredPackage({ id: "mid", projectName: "Edificio Oficinas", projectType: "Edificio", description: "Edificio comercial" }),
      ]);

      const results = await searchMcpTemplateCandidates({
        userId: "user-1",
        companyId: "company-1",
        description: "vivienda unifamiliar concreto armado",
        projectType: "vivienda",
        limit: 5,
      });

      // Scores should be in descending order
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it("respects limit parameter", async () => {
      mocks.storedProjectPackageFindMany.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) =>
          makeStoredPackage({ id: `pkg-${i}`, projectName: `Vivienda ${i}`, projectType: "Vivienda", description: `Desc ${i}` }),
        ),
      );

      const results = await searchMcpTemplateCandidates({
        userId: "user-1",
        companyId: "company-1",
        description: "vivienda",
        limit: 3,
      });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("defaults limit to 5 when not specified", async () => {
      mocks.storedProjectPackageFindMany.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) =>
          makeStoredPackage({ id: `pkg-${i}`, projectName: `Test ${i}`, projectType: "Vivienda", description: "test" }),
        ),
      );

      const results = await searchMcpTemplateCandidates({
        userId: "user-1",
        companyId: "company-1",
        description: "vivienda test",
      });

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it("score is always between 0 and 1", async () => {
      mocks.storedProjectPackageFindMany.mockResolvedValue([
        makeStoredPackage({ id: "p1", projectName: "Casa", projectType: "Vivienda", description: "test" }),
      ]);

      const results = await searchMcpTemplateCandidates({
        userId: "user-1",
        companyId: "company-1",
        description: "casa",
      });

      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("reasons and matched keywords", () => {
    it("includes reasons for strong matches", async () => {
      mocks.storedProjectPackageFindMany.mockResolvedValue([
        makeStoredPackage({
          id: "p1",
          projectName: "Vivienda Concreto Armado",
          projectType: "Vivienda",
          description: "Vivienda unifamiliar con concreto armado 120m2",
        }),
      ]);

      const results = await searchMcpTemplateCandidates({
        userId: "user-1",
        companyId: "company-1",
        description: "vivienda de concreto armado 120m2",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].reasons.length).toBeGreaterThan(0);
      expect(results[0].matchedKeywords.length).toBeGreaterThan(0);
    });

    it("includes project type in matched keywords", async () => {
      mocks.storedProjectPackageFindMany.mockResolvedValue([
        makeStoredPackage({ id: "p1", projectName: "Vivienda Test", projectType: "Vivienda", description: "test" }),
      ]);

      const results = await searchMcpTemplateCandidates({
        userId: "user-1",
        companyId: "company-1",
        description: "casa de vivienda",
      });

      expect(results[0].matchedKeywords).toContain("Vivienda");
    });
  });

  describe("area and location scoring", () => {
    it("boosts score when area matches between description and package", async () => {
      mocks.storedProjectPackageFindMany.mockResolvedValue([
        makeStoredPackage({ id: "p1", projectName: "Vivienda", projectType: "Vivienda", description: "Vivienda 120m2" }),
        makeStoredPackage({ id: "p2", projectName: "Vivienda", projectType: "Vivienda", description: "Vivienda 500m2" }),
      ]);

      const results = await searchMcpTemplateCandidates({
        userId: "user-1",
        companyId: "company-1",
        description: "casa de 120m2",
      });

      const idx120 = results.findIndex((r) => r.packageId === "p1");
      const idx500 = results.findIndex((r) => r.packageId === "p2");
      if (idx120 >= 0 && idx500 >= 0) {
        expect(idx120).toBeLessThan(idx500);
      }
    });
  });
});
