/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const { mockRequireAdminSession, mockSeedAgentWorkflows } = vi.hoisted(
  () => ({
    mockRequireAdminSession: vi.fn(),
    mockSeedAgentWorkflows: vi.fn(),
  }),
);

vi.mock("@/lib/auth/session", () => ({
  requireAdminSession: mockRequireAdminSession,
}));

vi.mock("@/lib/data/seed-agent-workflows", () => ({
  seedAgentWorkflows: mockSeedAgentWorkflows,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
}));

import { POST } from "./route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function expectJsonResponse(
  response: Response,
  status: number,
  body: Record<string, unknown>,
) {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toMatchObject(body);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/admin/ai/workflows/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 403 when user is not authenticated", async () => {
      mockRequireAdminSession.mockResolvedValue(null);

      const response = await POST();

      await expectJsonResponse(response, 403, { error: "Forbidden" });
    });

    it("returns 403 when user is not admin", async () => {
      mockRequireAdminSession.mockResolvedValue(null);

      const response = await POST();

      await expectJsonResponse(response, 403, { error: "Forbidden" });
    });
  });

  describe("sync execution", () => {
    it("returns upserted count and empty errors on success", async () => {
      mockRequireAdminSession.mockResolvedValue({
        user: { id: "admin-1", role: "ADMIN" },
      });
      mockSeedAgentWorkflows.mockResolvedValue({
        upserted: 7,
        errors: [],
      });

      const response = await POST();

      await expectJsonResponse(response, 200, {
        ok: true,
        upserted: 7,
        errors: [],
      });
    });

    it("returns upserted count with non-empty errors when some workflows fail", async () => {
      mockRequireAdminSession.mockResolvedValue({
        user: { id: "admin-1", role: "ADMIN" },
      });
      mockSeedAgentWorkflows.mockResolvedValue({
        upserted: 5,
        errors: [
          'Workflow "test": bundle "missing-bundle" no encontrado.',
        ],
      });

      const response = await POST();

      await expectJsonResponse(response, 200, {
        ok: true,
        upserted: 5,
        errors: [
          'Workflow "test": bundle "missing-bundle" no encontrado.',
        ],
      });
    });

    it("calls seedAgentWorkflows with the prisma client", async () => {
      mockRequireAdminSession.mockResolvedValue({
        user: { id: "admin-1", role: "ADMIN" },
      });
      mockSeedAgentWorkflows.mockResolvedValue({
        upserted: 7,
        errors: [],
      });

      await POST();

      // Check that seedAgentWorkflows was called with the prisma client
      const { prisma } = await import("@/lib/db/prisma");
      expect(mockSeedAgentWorkflows).toHaveBeenCalledWith(prisma);
    });
  });

  describe("error handling", () => {
    it("returns 500 when seedAgentWorkflows throws", async () => {
      mockRequireAdminSession.mockResolvedValue({
        user: { id: "admin-1", role: "ADMIN" },
      });
      mockSeedAgentWorkflows.mockRejectedValue(
        new Error("Connection lost"),
      );

      const response = await POST();

      await expectJsonResponse(response, 500, {
        error: "Connection lost",
        ok: false,
      });
    });

    it("returns 500 with generic message for non-Error throws", async () => {
      mockRequireAdminSession.mockResolvedValue({
        user: { id: "admin-1", role: "ADMIN" },
      });
      mockSeedAgentWorkflows.mockRejectedValue("raw string");

      const response = await POST();

      await expectJsonResponse(response, 500, {
        error: "Error inesperado",
        ok: false,
      });
    });
  });
});
