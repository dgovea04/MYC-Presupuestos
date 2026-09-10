type KnowledgeFeature = "reviewLearningBridge" | "reviewEnrichment" | "adminReviewQueue" | "backfill" | "retrievalV1";

export type KnowledgeFeatureContext = {
  companyId?: string;
  projectId?: string;
};

const environmentKeys: Record<KnowledgeFeature, string> = {
  reviewLearningBridge: "MC_KNOWLEDGE_REVIEW_LEARNING_BRIDGE",
  reviewEnrichment: "MC_KNOWLEDGE_REVIEW_ENRICHMENT",
  adminReviewQueue: "MC_KNOWLEDGE_ADMIN_REVIEW_QUEUE",
  backfill: "MC_KNOWLEDGE_BACKFILL",
  retrievalV1: "MC_KNOWLEDGE_RETRIEVAL_V1",
};

export function isKnowledgeFeatureEnabled(feature: KnowledgeFeature, _context?: KnowledgeFeatureContext): boolean {
  return process.env[environmentKeys[feature]] === "true";
}
