import { describe, expect, it } from "vitest";
import { privateLearningContentHash, sanitizePrivateLearningPayload } from "./sanitization";
describe("private learning sanitization", () => {
  it("removes secrets and oversized file-like values deterministically", () => { const clean = sanitizePrivateLearningPayload({ token: "secret", description: "ok", nested: { apiKey: "hidden", value: 1 } }); expect(clean).toEqual({ description: "ok", nested: { value: 1 } }); expect(privateLearningContentHash({ companyId: "c1", signalType: "x", inputJson: clean, resultJson: {}, schemaVersion: "1" })).toHaveLength(64); });
});
