import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getAiUsageReport: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/ai/credentials/metrics", () => ({
  getAiUsageReport: mocks.getAiUsageReport,
}));

import { GET } from "@/app/api/admin/ai-usage/route";

describe("GET /api/admin/ai-usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated or unauthorized administrators", async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/admin/ai-usage"));

    expect(response.status).toBe(401);
    expect(mocks.requireAdminSession).toHaveBeenCalledWith("ai_usage.read");
    expect(mocks.getAiUsageReport).not.toHaveBeenCalled();
  });

  it("normalizes valid filters and returns a no-store report", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.getAiUsageReport.mockResolvedValue({
      summary: { requests: 2, tokens: 500, actualCostMinor: 12, estimatedCostMinor: 15 },
      byWorkspace: [],
      byProvider: [],
      bySource: [],
      byTask: [],
      failures: [],
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/ai-usage?from=2026-08-01T00:00:00.000Z&to=2026-08-31T23:59:59.000Z&workspaceId=ws-1&userId=user-1&provider=OPENAI&credentialSource=WORKSPACE&task=chat",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.getAiUsageReport).toHaveBeenCalledWith({
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-31T23:59:59.000Z"),
      workspaceId: "ws-1",
      userId: "user-1",
      provider: "OPENAI",
      credentialSource: "WORKSPACE",
      task: "chat",
    });
    await expect(response.json()).resolves.toMatchObject({
      summary: { requests: 2, tokens: 500 },
    });
  });

  it("rejects malformed filters before querying the database", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });

    const response = await GET(
      new Request("http://localhost/api/admin/ai-usage?from=not-a-date&provider=")
    );

    expect(response.status).toBe(400);
    expect(mocks.getAiUsageReport).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Filtros inválidos" });
  });

  it("does not expose prompts or credential values through the route contract", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.getAiUsageReport.mockResolvedValue({
      summary: { requests: 1, tokens: 10, actualCostMinor: 0, estimatedCostMinor: 0 },
      byWorkspace: [{ workspaceId: "ws-1", requests: 1, tokens: 10, actualCostMinor: 0 }],
      byProvider: [{ provider: "OPENAI", model: "gpt-5-mini", requests: 1, tokens: 10, actualCostMinor: 0 }],
      bySource: [{ credentialSource: "WORKSPACE", billingScope: "WORKSPACE", requests: 1, tokens: 10, actualCostMinor: 0 }],
      byTask: [{ task: "chat", requests: 1, tokens: 10, actualCostMinor: 0 }],
      failures: [],
    });

    const response = await GET(new Request("http://localhost/api/admin/ai-usage?workspaceId=ws-1"));
    const body = await response.json();

    expect(JSON.stringify(body)).not.toContain("api-key");
    expect(JSON.stringify(body)).not.toContain("prompt");
    expect(body.bySource[0]).toEqual(expect.objectContaining({ credentialSource: "WORKSPACE" }));
  });
});
