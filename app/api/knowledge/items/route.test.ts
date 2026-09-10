import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthSession, createCanonicalItem, assertKnowledgeReadAccess, assertKnowledgeWriteAccess, findMany } = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  createCanonicalItem: vi.fn(),
  assertKnowledgeReadAccess: vi.fn(),
  assertKnowledgeWriteAccess: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getAuthSession, requireSuperAdminSession: vi.fn() }));
vi.mock("@/lib/knowledge/canonical-items", () => ({ createCanonicalItem }));
vi.mock("@/lib/knowledge/api-access", () => ({ assertKnowledgeReadAccess, assertKnowledgeWriteAccess }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { canonicalItem: { findMany } } }));

import { GET, POST } from "./route";

describe("knowledge items route error classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthSession.mockResolvedValue({ user: { id: "u1", activeCompanyId: "c1" } });
    assertKnowledgeReadAccess.mockResolvedValue(undefined);
    assertKnowledgeWriteAccess.mockResolvedValue(undefined);
  });

  it("returns 500 without exposing an internal POST error", async () => {
    createCanonicalItem.mockRejectedValueOnce(new Error("database password leaked"));

    const response = await POST(new Request("http://localhost/api/knowledge/items", {
      method: "POST",
      body: JSON.stringify({ name: "Cemento", scope: "COMPANY" }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "No se pudo crear la partida" });
  });

  it("returns 500 without exposing an internal GET error", async () => {
    findMany.mockRejectedValueOnce(new Error("database password leaked"));

    const response = await GET(new Request("http://localhost/api/knowledge/items"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "No se pudieron consultar las partidas" });
  });
});
