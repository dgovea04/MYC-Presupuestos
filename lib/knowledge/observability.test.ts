import { beforeEach, describe, expect, it, vi } from "vitest";

const { metricEvent } = vi.hoisted(() => ({ metricEvent: { upsert: vi.fn().mockResolvedValue({ id: "metric-1" }) } }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { knowledgeMetricEvent: metricEvent } }));

import { getKnowledgeMetrics, logKnowledgeOperation, resetKnowledgeMetrics } from "./observability";

describe("persistent Knowledge observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetKnowledgeMetrics();
  });

  it("persists an idempotent metric event and keeps aggregate counters", () => {
    logKnowledgeOperation({ stage: "bridge", outcome: "success", correlationId: "corr-1", companyId: "c1", projectId: "p1", idempotencyKey: "metric-key-1", durationMs: 42, metadata: { created: 3, skipped: 1, conflicts: 2, failed: 1 } });

    expect(metricEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: "metric-key-1" },
      create: expect.objectContaining({ metric: "knowledge.bridge.success", companyId: "c1", projectId: "p1", durationMs: 42, metadata: { created: 3, skipped: 1, conflicts: 2, failed: 1 } }),
      update: {},
    }));
    expect(getKnowledgeMetrics()).toMatchObject({ "knowledge.bridge.success": 1, "knowledge.bridge.created": 3, "knowledge.bridge.skipped": 1, "knowledge.bridge.conflicts": 2, "knowledge.bridge.failed": 1 });
  });

  it("does not fail the operation when metric persistence is unavailable", () => {
    metricEvent.upsert.mockRejectedValueOnce(new Error("database unavailable"));

    expect(() => logKnowledgeOperation({ stage: "promotion", outcome: "success", correlationId: "corr-2", idempotencyKey: "metric-key-2" })).not.toThrow();
    expect(getKnowledgeMetrics()).toMatchObject({ "knowledge.promotion.success": 1 });
  });
});
