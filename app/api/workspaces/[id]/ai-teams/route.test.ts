import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ getAuthSession: vi.fn() }));
vi.mock("@/lib/workspace/authorization", () => ({ requireWorkspaceRole: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { workspaceTeam: { findMany: vi.fn(), create: vi.fn() } } }));
import { getAuthSession } from "@/lib/auth/session";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import { prisma } from "@/lib/db/prisma";
import { GET, POST } from "./route";

describe("workspace AI teams routes", () => {
  it("rejects unauthenticated access", async () => { vi.mocked(getAuthSession).mockResolvedValue(null); const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "ws-1" }) }); expect(response.status).toBe(401); });
  it("requires admin to create a team", async () => { vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "u-1" } } as never); vi.mocked(requireWorkspaceRole).mockRejectedValue(new Error("No autorizado")); const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ name: "Costos" }) }), { params: Promise.resolve({ id: "ws-1" }) }); expect(response.status).toBe(400); expect(prisma.workspaceTeam.create).not.toHaveBeenCalled(); });
});
