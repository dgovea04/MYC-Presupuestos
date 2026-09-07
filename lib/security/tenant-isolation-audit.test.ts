import { describe, expect, it } from "vitest";
import { auditTenantQueries } from "./tenant-isolation-audit";
describe("tenant isolation audit", () => {
  it("reports sensitive queries without company filters", () => { const result = auditTenantQueries([{ name: "examples", sensitive: true, hasCompanyFilter: true }, { name: "leak", sensitive: true, hasCompanyFilter: false }]); expect(result.passed).toBe(false); expect(result.violations.map((item) => item.name)).toEqual(["leak"]); });
});
