import { describe, expect, it } from "vitest";
import { getKnowledgeRetryDecision } from "./retry-policy";

describe("knowledge retry policy", () => {
  it("uses deterministic exponential backoff", () => {
    expect(getKnowledgeRetryDecision(0, new Date("2026-09-09T12:00:00Z"))).toEqual({ retryable: true, nextRetryAt: new Date("2026-09-09T12:00:05Z"), attempt: 1 });
    expect(getKnowledgeRetryDecision(2, new Date("2026-09-09T12:00:00Z"))).toEqual({ retryable: true, nextRetryAt: new Date("2026-09-09T12:00:20Z"), attempt: 3 });
  });

  it("moves a job to dead letter after the maximum attempts", () => {
    expect(getKnowledgeRetryDecision(5, new Date("2026-09-09T12:00:00Z"))).toEqual({ retryable: false, attempt: 6 });
  });
});
