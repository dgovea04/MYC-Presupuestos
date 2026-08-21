import { describe, expect, it, vi } from "vitest";
import { assertWorkspaceHasSeat, getWorkspaceSeatUsage, WorkspaceSeatLimitError } from "@/lib/workspace/seats";

function createClient() {
  return {
    companyMembership: { count: vi.fn(), findFirst: vi.fn() },
    companySubscription: { findUnique: vi.fn() },
    membershipPlan: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  };
}

describe("workspace seats", () => {
  it("counts active and invited memberships against company subscription limit", async () => {
    const client = createClient();
    client.companyMembership.count.mockResolvedValue(2);
    client.companySubscription.findUnique.mockResolvedValue({ membershipPlan: { seatLimit: 3 } });
    await expect(getWorkspaceSeatUsage("ws-1", client)).resolves.toEqual({ used: 2, limit: 3 });
    expect(client.companyMembership.count).toHaveBeenCalledWith({ where: { companyId: "ws-1", status: { in: ["ACTIVE", "INVITED"] } } });
  });

  it("allows unlimited company plan", async () => {
    const client = createClient();
    client.companyMembership.count.mockResolvedValue(200);
    client.companySubscription.findUnique.mockResolvedValue({ membershipPlan: { seatLimit: null } });
    await expect(assertWorkspaceHasSeat("ws-1", 10, client)).resolves.toEqual({ used: 200, limit: null });
  });

  it("rejects when adding a seat exceeds the limit", async () => {
    const client = createClient();
    client.companyMembership.count.mockResolvedValue(3);
    client.companySubscription.findUnique.mockResolvedValue({ membershipPlan: { seatLimit: 3 } });
    await expect(assertWorkspaceHasSeat("ws-1", 1, client)).rejects.toMatchObject<Partial<WorkspaceSeatLimitError>>({ used: 3, limit: 3, code: "WORKSPACE_SEAT_LIMIT_REACHED" });
  });
});
