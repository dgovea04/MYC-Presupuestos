import { describe, expect, it } from "vitest";
import { isPrismaUniqueConstraintError, matchLocalPriceRow, normalizeMatchText, parseLocalPrice } from "@/lib/local-resource-pricing/service";
import { Prisma } from "@prisma/client";

describe("local resource pricing domain", () => {
  const resource = { id: "resource-1", code: "MAT-1", description: "Cemento Portland", unit: "bol", currency: "PEN", unitPrice: new Prisma.Decimal("25.4500") };

  it("uses exact id or unique code and rejects ambiguous fallback", () => {
    expect(matchLocalPriceRow({ resourceId: "resource-1", code: "other", description: "other", unit: "bol", currency: "PEN", proposedPrice: "1" }, [resource])?.id).toBe("resource-1");
    expect(matchLocalPriceRow({ code: "MAT-1", description: "Cemento Portland", unit: "bol", currency: "PEN", proposedPrice: "1" }, [resource])?.id).toBe("resource-1");
    expect(matchLocalPriceRow({ code: "unknown", description: "Cemento Portland", unit: "bol", currency: "PEN", proposedPrice: "1" }, [resource])?.id).toBe("resource-1");
    expect(matchLocalPriceRow({ code: "unknown", description: "Cemento Portland", unit: "bol", currency: "PEN", proposedPrice: "1" }, [resource, { ...resource, id: "resource-2" }])).toBeNull();
  });

  it("keeps decimal-safe price precision", () => {
    expect(parseLocalPrice("25,4500").toFixed(4)).toBe("25.4500");
    expect(() => parseLocalPrice("-1")).toThrow();
    expect(() => parseLocalPrice("1.12345")).toThrow();
  });

  it("recognizes Prisma uniqueness collisions for retry handling", () => {
    expect(isPrismaUniqueConstraintError({ code: "P2002" })).toBe(true);
    expect(isPrismaUniqueConstraintError({ code: "P2025" })).toBe(false);
    expect(isPrismaUniqueConstraintError(null)).toBe(false);
  });

  it("normalizes accents and whitespace only for matching fallback", () => {
    expect(normalizeMatchText("  Cemento  Portland ")).toBe("cemento portland");
    expect(normalizeMatchText("Árido" )).toBe("arido");
  });
});
