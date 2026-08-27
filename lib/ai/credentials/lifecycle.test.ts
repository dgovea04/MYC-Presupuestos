import { describe, expect, it } from "vitest";
import { getAiCredentialHealth } from "@/lib/ai/credentials/lifecycle";

describe("getAiCredentialHealth", () => {
  const now = new Date("2026-08-27T00:00:00.000Z");

  it("marks revoked and invalid credentials explicitly", () => {
    expect(getAiCredentialHealth({ status: "REVOKED", lastValidatedAt: now, lastError: null })).toBe("REVOKED");
    expect(getAiCredentialHealth({ status: "INVALID", lastValidatedAt: now, lastError: null })).toBe("INVALID");
  });

  it("marks missing and stale validation as unknown/degraded", () => {
    expect(getAiCredentialHealth({ status: "ACTIVE", lastValidatedAt: null, lastError: null, now })).toBe("UNKNOWN");
    expect(getAiCredentialHealth({ status: "ACTIVE", lastValidatedAt: new Date("2026-08-25T00:00:00.000Z"), lastError: null, now })).toBe("DEGRADED");
  });

  it("marks recently validated credentials healthy", () => {
    expect(getAiCredentialHealth({ status: "ACTIVE", lastValidatedAt: new Date("2026-08-26T12:00:00.000Z"), lastError: null, now })).toBe("HEALTHY");
  });
});
