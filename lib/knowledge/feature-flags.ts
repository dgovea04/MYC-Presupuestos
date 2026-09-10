type KnowledgeFeature = "reviewLearningBridge" | "reviewEnrichment" | "adminReviewQueue" | "backfill";

const environmentKeys: Record<KnowledgeFeature, string> = {
  reviewLearningBridge: "MC_KNOWLEDGE_REVIEW_LEARNING_BRIDGE",
  reviewEnrichment: "MC_KNOWLEDGE_REVIEW_ENRICHMENT",
  adminReviewQueue: "MC_KNOWLEDGE_ADMIN_REVIEW_QUEUE",
  backfill: "MC_KNOWLEDGE_BACKFILL",
};

export function isKnowledgeFeatureEnabled(feature: KnowledgeFeature): boolean {
  return process.env[environmentKeys[feature]] === "true";
}
