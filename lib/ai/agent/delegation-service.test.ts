import { describe, expect, it, vi } from "vitest";
import { canUseDelegatedAgent } from "@/lib/ai/agent/delegation-service";

describe("delegation-service", () => {
  it("allows only an active delegation with the requested tool and context", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "d1" });
    const allowed = await canUseDelegatedAgent({ userId: "u1", workspaceId: "w1", toolName: "budget.write", projectId: "p1", prisma: { agentDelegation: { findFirst } } as never });
    expect(allowed).toBe(true);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: "w1", delegateeId: "u1", status: "ACTIVE", toolNames: { has: "budget.write" } }) }));
  });

  it("denies when no matching delegation exists", async () => {
    const allowed = await canUseDelegatedAgent({ userId: "u1", workspaceId: "w1", toolName: "project.write", prisma: { agentDelegation: { findFirst: vi.fn().mockResolvedValue(null) } } as never });
    expect(allowed).toBe(false);
  });
});
