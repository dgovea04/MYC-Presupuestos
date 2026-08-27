import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ getAuthSession: vi.fn() }));
vi.mock("@/lib/workspace/authorization", () => ({ requireWorkspaceRole: vi.fn() }));
vi.mock("@/lib/ai/credentials/credential-service", () => ({ rotateScopedAiCredential: vi.fn(), revokeScopedAiCredential: vi.fn() }));
vi.mock("@/lib/ai/credentials/audit", () => ({ recordAiCredentialAudit: vi.fn() }));
vi.mock("@/lib/auth/rate-limit", () => ({ consumeRateLimit: vi.fn(), getRateLimitHeaders: vi.fn(() => ({ "retry-after": "60" })), getRequestClientIp: vi.fn(() => "127.0.0.1") }));
import { getAuthSession } from "@/lib/auth/session";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import { rotateScopedAiCredential, revokeScopedAiCredential } from "@/lib/ai/credentials/credential-service";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { PATCH, DELETE } from "./route";

const params = Promise.resolve({ id: "ws-1", credentialId: "cred-1" });
const safe = { id: "cred-1", scope: "TEAM" as const, workspaceId: "ws-1", teamId: "team-1", projectId: null, userId: null, provider: "OPENAI" as const, maskedValue: "sk-...1234", status: "ACTIVE" as const, isFallback: false, lastValidatedAt: null, lastError: null, health: "UNKNOWN" as const };

describe("contextual credential lifecycle route", () => {
  it("blocks unauthenticated rotation", async () => { vi.mocked(getAuthSession).mockResolvedValue(null); expect((await PATCH(new Request("http://localhost", { method: "PATCH", body: "{}" }), { params })).status).toBe(401); });
  it("blocks rate-limited revocation", async () => { vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "admin" } } as never); vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 60 }); expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), { params })).status).toBe(429); });
  it("rotates and returns only the safe representation", async () => { vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "admin" } } as never); vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 0 }); vi.mocked(requireWorkspaceRole).mockResolvedValue({ companyId: "ws-1", userId: "admin", role: "ADMIN" }); vi.mocked(rotateScopedAiCredential).mockResolvedValue(safe); const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ apiKey: "new-secret" }) }), { params }); const body = await response.json() as { credential: Record<string, unknown> }; expect(response.status).toBe(200); expect(body.credential).not.toHaveProperty("encryptedSecret"); expect(body.credential).not.toHaveProperty("apiKey"); });
  it("revokes an authorized contextual credential", async () => { vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "admin" } } as never); vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 0 }); vi.mocked(requireWorkspaceRole).mockResolvedValue({ companyId: "ws-1", userId: "admin", role: "ADMIN" }); vi.mocked(revokeScopedAiCredential).mockResolvedValue({ ...safe, status: "REVOKED", health: "REVOKED" }); const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params }); expect(response.status).toBe(200); expect(revokeScopedAiCredential).toHaveBeenCalledWith({ actorUserId: "admin", credentialId: "cred-1", expectedWorkspaceId: "ws-1" }); });
});
