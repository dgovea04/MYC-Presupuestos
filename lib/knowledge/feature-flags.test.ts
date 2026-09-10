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
});
