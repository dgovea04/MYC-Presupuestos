import { describe, expect, it, vi } from "vitest";
import { POST as postPrice } from "./price-observations/route";
import { POST as postYield } from "./yield-observations/route";
import { POST as postSource } from "./sources/route";
import { POST as postEvidence } from "./sources/evidence/route";
import { GET as getItems } from "./items/route";
import { GET as getResources } from "./resources/route";
import { POST as postItemAlias } from "./items/[id]/aliases/route";
import { POST as postResourceAlias } from "./resources/[id]/aliases/route";

const { getAuthSession } = vi.hoisted(() => ({ getAuthSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/auth/session", () => ({ getAuthSession, requireSuperAdminSession: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/knowledge/observations", () => ({ createPriceObservation: vi.fn(), createYieldObservation: vi.fn() }));
vi.mock("@/lib/knowledge/provenance", () => ({ createKnowledgeSource: vi.fn(), createKnowledgeEvidence: vi.fn() }));

const request = (url: string, method = "GET") => new Request(`http://localhost${url}`, { method, body: method === "GET" ? undefined : "{}" });

describe("knowledge route authentication matrix", () => {
  it.each([
    ["price observations", () => postPrice(request("/api/knowledge/price-observations", "POST"))],
    ["yield observations", () => postYield(request("/api/knowledge/yield-observations", "POST"))],
    ["sources", () => postSource(request("/api/knowledge/sources", "POST"))],
    ["evidence", () => postEvidence(request("/api/knowledge/sources/evidence", "POST"))],
    ["items", () => getItems(request("/api/knowledge/items"))],
    ["resources", () => getResources(request("/api/knowledge/resources"))],
    ["item aliases", () => postItemAlias(request("/api/knowledge/items/i1/aliases", "POST"), { params: Promise.resolve({ id: "i1" }) })],
    ["resource aliases", () => postResourceAlias(request("/api/knowledge/resources/r1/aliases", "POST"), { params: Promise.resolve({ id: "r1" }) })],
  ] as const)("rejects unauthenticated %s", async (_label, call) => {
    expect((await call()).status).toBe(401);
  });
});
