import { describe, expect, it } from "vitest";
import { auditPrivateLearningMetric } from "./metrics";
describe("private learning metrics", () => {
  it("keeps metric payloads aggregate-only", () => { expect(auditPrivateLearningMetric({ companyId: "company-1", activeExamples: 2, usages: 3 })).toEqual({ companyId: "company-1", activeExamples: 2, usages: 3 }); });
});
