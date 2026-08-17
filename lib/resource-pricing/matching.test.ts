import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { matchQuoteToResource } from "@/lib/resource-pricing/matching";

describe("resource price matching", () => {
  const globalResource = { id: "global-1", companyId: null, code: "MAT-001", description: "Cemento", category: "MATERIAL", unit: "bol", currency: "PEN", unitPrice: new Prisma.Decimal("25") } as never;
  const companyResource = { ...globalResource, id: "company-1", companyId: "company-1" } as never;

  it("matches a global resource by external binding", () => {
    const result = matchQuoteToResource([globalResource], [{ externalResourceId: "ext-1", externalCode: null, description: "Cemento", category: "MATERIAL", unit: "bol", currency: "PEN", price: "26", observedAt: "2026-08-17T00:00:00.000Z", sourceLabel: "test", rawHash: "hash" }], [{ resourceId: "global-1", provider: "fake", externalResourceId: "ext-1", active: true }], "fake");
    expect(result[0].resource?.id).toBe("global-1");
    expect(result[0].status).toBe("MATCHED");
  });

  it("does not choose a company resource when the global catalog has no match", () => {
    const result = matchQuoteToResource([companyResource], [{ externalResourceId: "other", externalCode: "OTHER", description: "Otro", category: "MATERIAL", unit: "kg", currency: "PEN", price: "1", observedAt: "2026-08-17T00:00:00.000Z", sourceLabel: "test", rawHash: "hash" }], [], "fake");
    expect(result[0].status).toBe("UNMATCHED");
  });
});
