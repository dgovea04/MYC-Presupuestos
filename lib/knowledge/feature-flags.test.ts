import { describe, expect, it, vi } from "vitest";
import { isKnowledgeFeatureEnabled } from "./feature-flags";

describe("knowledge feature flags", () => {
  it("keeps integration capabilities disabled unless explicitly enabled", () => {
    vi.stubEnv("MC_KNOWLEDGE_REVIEW_LEARNING_BRIDGE", "false");
    expect(isKnowledgeFeatureEnabled("reviewLearningBridge")).toBe(false);
    vi.stubEnv("MC_KNOWLEDGE_REVIEW_LEARNING_BRIDGE", "true");
    expect(isKnowledgeFeatureEnabled("reviewLearningBridge")).toBe(true);
    vi.unstubAllEnvs();
  });

  it("does not treat arbitrary truthy values as enabled", () => {
    vi.stubEnv("MC_KNOWLEDGE_REVIEW_ENRICHMENT", "yes");
    expect(isKnowledgeFeatureEnabled("reviewEnrichment")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("uses the environment fallback when retrieval is evaluated for a company and project", () => {
    vi.stubEnv("MC_KNOWLEDGE_RETRIEVAL_V1", "true");

    expect(isKnowledgeFeatureEnabled("retrievalV1", { companyId: "company-1", projectId: "project-1" })).toBe(true);

    vi.unstubAllEnvs();
  });

  it("enables import learning only for an allowlisted pilot company or project", () => {
    vi.stubEnv("MC_KNOWLEDGE_IMPORT_LEARNING_BRIDGE", "false");
    vi.stubEnv("MC_KNOWLEDGE_IMPORT_LEARNING_BRIDGE_COMPANIES", "company-pilot");
    vi.stubEnv("MC_KNOWLEDGE_IMPORT_LEARNING_BRIDGE_PROJECTS", "project-pilot");

    expect(isKnowledgeFeatureEnabled("importLearningBridge", { companyId: "company-pilot", projectId: "project-outside" })).toBe(true);
    expect(isKnowledgeFeatureEnabled("importLearningBridge", { companyId: "company-outside", projectId: "project-pilot" })).toBe(true);
    expect(isKnowledgeFeatureEnabled("importLearningBridge", { companyId: "company-outside", projectId: "project-outside" })).toBe(false);

    vi.unstubAllEnvs();
  });

  it("does not activate the pilot when the global flag is disabled and allowlists are empty", () => {
    vi.stubEnv("MC_KNOWLEDGE_IMPORT_LEARNING_BRIDGE", "false");
    vi.stubEnv("MC_KNOWLEDGE_IMPORT_LEARNING_BRIDGE_COMPANIES", "");
    vi.stubEnv("MC_KNOWLEDGE_IMPORT_LEARNING_BRIDGE_PROJECTS", "");

    expect(isKnowledgeFeatureEnabled("importLearningBridge", { companyId: "company-1", projectId: "project-1" })).toBe(false);

    vi.unstubAllEnvs();
  });
});
