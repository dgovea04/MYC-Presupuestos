type KnowledgeFeature = "reviewLearningBridge" | "reviewEnrichment" | "adminReviewQueue" | "backfill" | "retrievalV1" | "importLearningBridge";

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
  importLearningBridge: "MC_KNOWLEDGE_IMPORT_LEARNING_BRIDGE",
};

export function isKnowledgeFeatureEnabled(feature: KnowledgeFeature, context?: KnowledgeFeatureContext): boolean {
  const enabledValue = process.env[environmentKeys[feature]];
  if (enabledValue === "true") return true;
  if (!context) return false;

  const companyAllowlist = readAllowlist(`${environmentKeys[feature]}_COMPANIES`);
  const projectAllowlist = readAllowlist(`${environmentKeys[feature]}_PROJECTS`);
  return (context.companyId !== undefined && companyAllowlist.has(context.companyId)) ||
    (context.projectId !== undefined && projectAllowlist.has(context.projectId));
}

function readAllowlist(key: string): ReadonlySet<string> {
  return new Set((process.env[key] ?? "").split(",").map((value) => value.trim()).filter(Boolean));
}
