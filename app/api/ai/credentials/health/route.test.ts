import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ requireAdminSession: vi.fn() }));
vi.mock("@/lib/ai/credentials/lifecycle", () => ({ invalidateStaleAiCredentials: vi.fn() }));
import { requireAdminSession } from "@/lib/auth/session";
import { invalidateStaleAiCredentials } from "@/lib/ai/credentials/lifecycle";
import { POST } from "./route";
describe("credential health route", () => { it("rejects anonymous maintenance", async () => { vi.mocked(requireAdminSession).mockResolvedValue(null); expect((await POST(new Request("http://localhost", { method: "POST" }))).status).toBe(401); }); it("runs stale invalidation without returning secrets", async () => { vi.mocked(requireAdminSession).mockResolvedValue({ user: { id: "admin" } } as never); vi.mocked(invalidateStaleAiCredentials).mockResolvedValue({ invalidated: 2, cutoff: new Date() }); const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ staleAfterMs: 1000 }) })); expect(response.status).toBe(200); expect((await response.json()).invalidated).toBe(2); }); });
