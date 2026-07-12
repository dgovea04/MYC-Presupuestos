import { describe, expect, it, vi, beforeEach } from "vitest";
import { selectBudgetGenerationSource } from "./source-selector";

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("./mcp-template-search", () => ({
  searchMcpTemplateCandidates: vi.fn(),
  MCP_TEMPLATE_STRONG_MATCH: 0.50,
}));

vi.mock("./project-similarity", () => ({
  searchSimilarProjects: vi.fn(),
}));

import { searchMcpTemplateCandidates } from "./mcp-template-search";
import { searchSimilarProjects } from "./project-similarity";

const mockedSearchMcp = vi.mocked(searchMcpTemplateCandidates);
const mockedSearchProjects = vi.mocked(searchSimilarProjects);

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<Parameters<typeof selectBudgetGenerationSource>[0]> = {}) {
  return {
    userId: "user-1",
    companyId: "company-1",
    description: "vivienda de 120m2 en Lima",
    templateSource: "auto" as const,
    ...overrides,
  };
}

function makeMcpCandidate(score: number, packageId = "pkg-1", projectName = "Vivienda Template") {
  return [{
    packageId,
    projectName,
    projectType: "vivienda",
    description: "Vivienda de 2 pisos",
    score,
    matchedKeywords: ["vivienda"],
    reasons: ["Tipo de obra compatible"],
  }];
}

function makeProjectMatch(score: number, budgetTemplates: unknown[] = [{ id: "tpl-1" }]) {
  return [{
    projectId: "proj-1",
    projectName: "Mi Vivienda",
    projectType: "vivienda",
    location: "Lima",
    score,
    matchedKeywords: ["vivienda"],
    budgetCount: 1,
    totalAmount: 50000,
    budgetTemplates,
  }];
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("selectBudgetGenerationSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("catalog (explicit)", () => {
    it("returns catalog when templateSource is catalog", async () => {
      const result = await selectBudgetGenerationSource(makeInput({ templateSource: "catalog" }));
      expect(result.kind).toBe("catalog");
      expect(result.recommendedAction).toBe("use_catalog");
      expect(mockedSearchMcp).not.toHaveBeenCalled();
      expect(mockedSearchProjects).not.toHaveBeenCalled();
    });
  });

  describe("MCP strong match (score >= 0.50)", () => {
    it("returns mcp_strong with apply_mcp_after_confirmation", async () => {
      mockedSearchMcp.mockResolvedValue(makeMcpCandidate(0.75));

      const result = await selectBudgetGenerationSource(makeInput());

      expect(result.kind).toBe("mcp_strong");
      expect(result.confidence).toBe("high");
      expect(result.recommendedAction).toBe("apply_mcp_after_confirmation");
      expect(result.selectedMcpPackage).toBeDefined();
      expect(result.selectedMcpPackage!.score).toBe(0.75);
    });
  });

  describe("MCP review match (score 0.35 - 0.49), auto source", () => {
    it("returns mcp_review requiring confirmation", async () => {
      mockedSearchMcp.mockResolvedValue(makeMcpCandidate(0.42));

      const result = await selectBudgetGenerationSource(makeInput());

      expect(result.kind).toBe("mcp_review");
      expect(result.confidence).toBe("medium");
      expect(result.recommendedAction).toBe("preview_mcp");
      expect(result.selectedMcpPackage).toBeDefined();
    });
  });

  describe("MCP review match, explicit mcp source", () => {
    it("returns mcp_review with warning", async () => {
      mockedSearchMcp.mockResolvedValue(makeMcpCandidate(0.38));

      const result = await selectBudgetGenerationSource(makeInput({ templateSource: "mcp" }));

      expect(result.kind).toBe("mcp_review");
      expect(result.recommendedAction).toBe("preview_mcp");
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("MCP explicit but no matches", () => {
    it("returns insufficient_data when MCP source has no candidates", async () => {
      mockedSearchMcp.mockResolvedValue([]);

      const result = await selectBudgetGenerationSource(makeInput({ templateSource: "mcp" }));

      expect(result.kind).toBe("insufficient_data");
      expect(result.recommendedAction).toBe("ask_user");
    });
  });

  describe("Project template match (no MCP)", () => {
    it("returns project_template when similar project has templates", async () => {
      mockedSearchMcp.mockResolvedValue([]);
      mockedSearchProjects.mockResolvedValue(makeProjectMatch(0.65));

      const result = await selectBudgetGenerationSource(makeInput());

      expect(result.kind).toBe("project_template");
      expect(result.confidence).toBe("high");
      expect(result.recommendedAction).toBe("preview_project_template");
    });
  });

  describe("Fallback to catalog", () => {
    it("returns catalog when no MCP and no similar projects", async () => {
      mockedSearchMcp.mockResolvedValue([]);
      mockedSearchProjects.mockResolvedValue([]);

      const result = await selectBudgetGenerationSource(makeInput());

      expect(result.kind).toBe("catalog");
      expect(result.recommendedAction).toBe("use_catalog");
    });

    it("returns catalog when similar projects lack templates", async () => {
      mockedSearchMcp.mockResolvedValue([]);
      mockedSearchProjects.mockResolvedValue(makeProjectMatch(0.65, []));

      // With score < 0.50 for templates, but project has 0 templates, it falls through
      const result = await selectBudgetGenerationSource(makeInput());

      // The project has score >= 0.50 but 0 budgetTemplates, so it falls to catalog
      expect(result.kind).toBe("catalog");
    });
  });

  describe("Project source explicit", () => {
    it("searches only projects when templateSource is project", async () => {
      mockedSearchMcp.mockResolvedValue([]);
      mockedSearchProjects.mockResolvedValue(makeProjectMatch(0.55));

      const result = await selectBudgetGenerationSource(makeInput({ templateSource: "project" }));

      expect(result.kind).toBe("project_template");
      // MCP search should still be called in "auto" but NOT in "project"
      // Actually, since templateSource="project", MCP search is skipped
      expect(mockedSearchMcp).not.toHaveBeenCalled();
    });
  });

  describe("Score boundaries", () => {
    it("score 0.50 is mcp_strong", async () => {
      mockedSearchMcp.mockResolvedValue(makeMcpCandidate(0.50));

      const result = await selectBudgetGenerationSource(makeInput());

      expect(result.kind).toBe("mcp_strong");
    });

    it("score 0.49 is mcp_review (not strong)", async () => {
      mockedSearchMcp.mockResolvedValue(makeMcpCandidate(0.49));

      const result = await selectBudgetGenerationSource(makeInput());

      expect(result.kind).toBe("mcp_review");
    });

    it("score 0.35 is mcp_review", async () => {
      mockedSearchMcp.mockResolvedValue(makeMcpCandidate(0.35));

      const result = await selectBudgetGenerationSource(makeInput());

      expect(result.kind).toBe("mcp_review");
    });

    it("score 0.34 falls through to projects/catalog", async () => {
      mockedSearchMcp.mockResolvedValue(makeMcpCandidate(0.34));
      mockedSearchProjects.mockResolvedValue([]);

      const result = await selectBudgetGenerationSource(makeInput());

      expect(result.kind).toBe("catalog");
    });
  });
});
