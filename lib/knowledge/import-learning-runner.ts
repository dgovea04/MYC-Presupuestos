import { createImportLearningJob } from "./integration-jobs";
import { recordImportLearningBatch } from "./import-learning";
import type { ImportLearningBatch } from "./import-learning-types";

export async function recordImportLearningBestEffort(batch: ImportLearningBatch) {
  try {
    return await recordImportLearningBatch(batch);
  } catch (error) {
    try {
      await createImportLearningJob({ batch });
    } catch (jobError) {
      console.warn("Knowledge import learning job was not created", jobError);
    }
    console.warn("Knowledge import learning failed and was queued for retry", error);
    return { status: "RETRYABLE_FAILED" as const, reason: "KNOWLEDGE_WRITE_FAILED" as const };
  }
}
