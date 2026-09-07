import { describe, expect, it } from "vitest";
import { assertKnowledgeScopeAccess, getVisibleScopes } from "./scope";

describe("knowledge scope access", () => {
  it("allows global and same-tenant company/project data", () => {
    expect(() => assertKnowledgeScopeAccess({ scope: "GLOBAL", actor: { companyId: "a" } })).not.toThrow();
    expect(() => assertKnowledgeScopeAccess({ scope: "COMPANY", companyId: "a", actor: { companyId: "a" } })).not.toThrow();
    expect(() => assertKnowledgeScopeAccess({ scope: "PROJECT", companyId: "a", projectId: "p", actor: { companyId: "a", projectIds: ["p"] } })).not.toThrow();
  });

  it("rejects cross-tenant reads", () => {
    expect(() => assertKnowledgeScopeAccess({ scope: "COMPANY", companyId: "b", actor: { companyId: "a" } })).toThrow("tenant");
  });

  it("returns project, company and global precedence", () => {
    expect(getVisibleScopes({ companyId: "a", projectId: "p" })).toEqual([
      { scope: "PROJECT", companyId: "a", projectId: "p" },
      { scope: "COMPANY", companyId: "a" },
      { scope: "GLOBAL" },
    ]);
  });
});

