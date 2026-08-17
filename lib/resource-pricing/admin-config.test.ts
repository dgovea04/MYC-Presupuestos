import { describe, expect, it } from "vitest";
import { maskApiKey } from "@/lib/ai/encryption";

describe("resource price provider administration", () => {
  it("uses masked credentials for public configuration", () => {
    expect(maskApiKey("secret-value")).not.toContain("secret-value");
  });
});
