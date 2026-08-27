import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ getAuthSession: vi.fn() }));
vi.mock("@/lib/workspace/authorization", () => ({ requireWorkspaceRole: vi.fn() }));
vi.mock("@/lib/ai/credentials/credential-service", () => ({ createScopedAiCredential: vi.fn(), listScopedAiCredentials: vi.fn() }));
vi.mock("@/lib/ai/credentials/audit", () => ({ recordAiCredentialAudit: vi.fn() }));
vi.mock("@/lib/auth/rate-limit", () => ({ consumeRateLimit: vi.fn(), getRateLimitHeaders: vi.fn(() => ({ "retry-after": "60" })), getRequestClientIp: vi.fn(() => "127.0.0.1") }));
import { getAuthSession } from "@/lib/auth/session";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import { createScopedAiCredential, listScopedAiCredentials } from "@/lib/ai/credentials/credential-service";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { GET, POST } from "./route";

describe("contextual AI credential route", () => {
  it("rejects unauthenticated access", async () => { vi.mocked(getAuthSession).mockResolvedValue(null); const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "ws-1" }) }); expect(response.status).toBe(401); });
  it("rejects rate-limited mutations", async () => { vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "admin" } } as never); vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 60 }); const response = await POST(new Request("http://localhost", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "ws-1" }) }); expect(response.status).toBe(429); expect(requireWorkspaceRole).not.toHaveBeenCalled(); });
  it("rejects unauthorized mutations", async () => { vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 0 }); vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "admin" } } as never); vi.mocked(requireWorkspaceRole).mockRejectedValue(new Error("No autorizado")); const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ scope: "PROJECT", projectId: "foreign", provider: "OPENAI", apiKey: "secret" }) }), { params: Promise.resolve({ id: "ws-1" }) }); expect(response.status).toBe(400); expect(createScopedAiCredential).not.toHaveBeenCalled(); });
  it("lists only the requested contextual scope and never handles secrets", async () => { vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "viewer" } } as never); vi.mocked(requireWorkspaceRole).mockResolvedValue({ companyId: "ws-1", userId: "viewer", role: "VIEWER" }); vi.mocked(listScopedAiCredentials).mockResolvedValue([]); const response = await GET(new Request("http://localhost/api?scope=TEAM&teamId=team-1"), { params: Promise.resolve({ id: "ws-1" }) }); expect(response.status).toBe(200); expect(listScopedAiCredentials).toHaveBeenCalledWith({ workspaceId: "ws-1", scope: "TEAM", teamId: "team-1", projectId: undefined }); });
});
