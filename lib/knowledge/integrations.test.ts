import { describe, expect, it, vi } from "vitest";
import { recordImportKnowledgeEvent, recordReviewDecisionKnowledgeEvent } from "./integrations";

const { recordKnowledgeEvent } = vi.hoisted(() => ({ recordKnowledgeEvent: vi.fn().mockResolvedValue({ created: true }) }));
vi.mock("./events", () => ({ recordKnowledgeEvent }));

describe("knowledge integration adapters", () => {
  it("emits an idempotent project import event", async () => {
    await recordImportKnowledgeEvent({ userId: "u1", companyId: "c1", projectId: "p1", budgetId: "b1", sourceType: "S10_IMPORT" });
    expect(recordKnowledgeEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "IMPORT_COMPLETED", scope: "PROJECT", idempotencyKey: "import:S10_IMPORT:b1" }));
  });

  it("maps review resolution to a confirmed or rejected event", async () => {
    await recordReviewDecisionKnowledgeEvent({ userId: "u1", companyId: "c1", projectId: "p1", findingId: "f1", resolution: "CONFIRMED_ISSUE" });
    expect(recordKnowledgeEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "REVIEW_ISSUE_CONFIRMED", entityId: "f1" }));
  });
});
