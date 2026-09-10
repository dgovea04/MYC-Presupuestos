import { processDueKnowledgeIntegrationJobs, processKnowledgeIntegrationJob } from "@/lib/knowledge/integration-jobs";

const parsedLimit = Number(process.env.KNOWLEDGE_WORKER_BATCH_SIZE ?? "10");
const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100 ? parsedLimit : 10;
const jobId = process.env.KNOWLEDGE_WORKER_JOB_ID?.trim();
const results = jobId ? [await processKnowledgeIntegrationJob(jobId)] : await processDueKnowledgeIntegrationJobs({ limit });
const summary = results.reduce<Record<string, number>>((counts, result) => {
  counts[result.status] = (counts[result.status] ?? 0) + 1;
  return counts;
}, {});
console.log(JSON.stringify({ processed: results.length, statuses: summary }));
