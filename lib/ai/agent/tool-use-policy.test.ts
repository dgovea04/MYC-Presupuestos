import { describe, expect, it } from "vitest";
import { isToolAllowedForIntent } from "./tool-use-policy";
import type { AgentIntent } from "./intent-router";

function makeIntent(type: AgentIntent["type"], confidence: AgentIntent["confidence"] = "medium"): AgentIntent {
  return {
    type,
    confidence,
    reason: "test",
    requiredFields: [],
    extracted: {},
    suggestedTools: [],
  };
}

describe("isToolAllowedForIntent", () => {
  describe("general_chat", () => {
    it("blocks all tools", () => {
      expect(isToolAllowedForIntent("searchProjects", makeIntent("general_chat"))).toBe(false);
      expect(isToolAllowedForIntent("createProject", makeIntent("general_chat"))).toBe(false);
      expect(isToolAllowedForIntent("previewBudgetGeneration", makeIntent("general_chat"))).toBe(false);
    });
  });

  describe("preview_budget_generation", () => {
    it("allows previewBudgetGeneration", () => {
      expect(isToolAllowedForIntent("previewBudgetGeneration", makeIntent("preview_budget_generation"))).toBe(true);
    });

    it("allows createBudgetGeneral", () => {
      expect(isToolAllowedForIntent("createBudgetGeneral", makeIntent("preview_budget_generation"))).toBe(true);
    });

    it("allows searchProjects (universal read)", () => {
      expect(isToolAllowedForIntent("searchProjects", makeIntent("preview_budget_generation"))).toBe(true);
    });

    it("blocks generateBudget", () => {
      expect(isToolAllowedForIntent("generateBudget", makeIntent("preview_budget_generation"))).toBe(false);
    });

    it("blocks unrelated tools", () => {
      expect(isToolAllowedForIntent("reviewAPU", makeIntent("preview_budget_generation"))).toBe(false);
      expect(isToolAllowedForIntent("exportPDF", makeIntent("preview_budget_generation"))).toBe(false);
    });
  });

  describe("apply_budget_generation", () => {
    it("allows generateBudget", () => {
      expect(isToolAllowedForIntent("generateBudget", makeIntent("apply_budget_generation"))).toBe(true);
    });

    it("blocks previewBudgetGeneration", () => {
      expect(isToolAllowedForIntent("previewBudgetGeneration", makeIntent("apply_budget_generation"))).toBe(false);
    });
  });

  describe("create_general_budget", () => {
    it("allows createBudgetGeneral and searchProjects", () => {
      expect(isToolAllowedForIntent("createBudgetGeneral", makeIntent("create_general_budget"))).toBe(true);
      expect(isToolAllowedForIntent("searchProjects", makeIntent("create_general_budget"))).toBe(true);
    });
  });

  describe("create_sub_budget", () => {
    it("allows createSubBudget and searchBudgets", () => {
      expect(isToolAllowedForIntent("createSubBudget", makeIntent("create_sub_budget"))).toBe(true);
      expect(isToolAllowedForIntent("searchBudgets", makeIntent("create_sub_budget"))).toBe(true);
    });
  });

  describe("search_mcp_template", () => {
    it("allows searchMcpTemplates", () => {
      expect(isToolAllowedForIntent("searchMcpTemplates", makeIntent("search_mcp_template"))).toBe(true);
    });

    it("blocks write tools", () => {
      expect(isToolAllowedForIntent("generateBudget", makeIntent("search_mcp_template"))).toBe(false);
    });
  });

  describe("apply_mcp_template", () => {
    it("allows applyBudgetFromMcpTemplate", () => {
      expect(isToolAllowedForIntent("applyBudgetFromMcpTemplate", makeIntent("apply_mcp_template"))).toBe(true);
    });
  });

  describe("review_apu", () => {
    it("allows APU review tools", () => {
      expect(isToolAllowedForIntent("reviewAPU", makeIntent("review_apu"))).toBe(true);
      expect(isToolAllowedForIntent("calculateAPU", makeIntent("review_apu"))).toBe(true);
      expect(isToolAllowedForIntent("searchPartidas", makeIntent("review_apu"))).toBe(true);
    });

    it("blocks createProject", () => {
      expect(isToolAllowedForIntent("createProject", makeIntent("review_apu"))).toBe(false);
    });
  });

  describe("optimize_apu", () => {
    it("allows optimizeAPU and related tools", () => {
      expect(isToolAllowedForIntent("optimizeAPU", makeIntent("optimize_apu"))).toBe(true);
      expect(isToolAllowedForIntent("searchInsumos", makeIntent("optimize_apu"))).toBe(true);
    });
  });

  describe("export_report", () => {
    it("allows export tools", () => {
      expect(isToolAllowedForIntent("calculateBudget", makeIntent("export_report"))).toBe(true);
      expect(isToolAllowedForIntent("exportPDF", makeIntent("export_report"))).toBe(true);
      expect(isToolAllowedForIntent("exportExcel", makeIntent("export_report"))).toBe(true);
      expect(isToolAllowedForIntent("exportS10", makeIntent("export_report"))).toBe(true);
    });

    it("blocks createProject", () => {
      expect(isToolAllowedForIntent("createProject", makeIntent("export_report"))).toBe(false);
    });
  });

  describe("intent without explicit allowlist", () => {
    // For intents not in the allowlist map, all tools should be allowed (legacy behavior)
    it("allows any tool for intents without defined allowlist", () => {
      // Using select_existing_project which has searchProjects in its allowlist
      expect(isToolAllowedForIntent("searchProjects", makeIntent("select_existing_project"))).toBe(true);
    });
  });
});
