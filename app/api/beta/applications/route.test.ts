import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  BetaApplicationConflictError: class BetaApplicationConflictError extends Error {},
  createBetaApplication: vi.fn(),
  consumeRateLimit: vi.fn(),
  getAnalyticsRequestContext: vi.fn(),
}));

vi.mock("@/lib/beta/applications", () => ({
  createBetaApplication: mocks.createBetaApplication,
  BetaApplicationConflictError: mocks.BetaApplicationConflictError,
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  getRequestClientIp: vi.fn(() => "127.0.0.1"),
  getRateLimitHeaders: vi.fn(() => ({ "Retry-After": "3600" })),
}));
vi.mock("@/lib/analytics/request-context", () => ({
  getAnalyticsRequestContext: mocks.getAnalyticsRequestContext,
}));

import { POST } from "@/app/api/beta/applications/route";

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/beta/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/beta/applications", () => {
  beforeEach(() => {
    mocks.createBetaApplication.mockReset();
    mocks.consumeRateLimit.mockReset();
    mocks.getAnalyticsRequestContext.mockReset();
    mocks.consumeRateLimit.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 3600 });
    mocks.getAnalyticsRequestContext.mockReturnValue({ clientId: "client-1", params: { utm_source: "linkedin" } });
  });

  it("creates a pending application with server attribution", async () => {
    mocks.createBetaApplication.mockResolvedValue({ id: "application-1" });

    const response = await POST(buildRequest({ name: "María Calderón", email: "Maria@Example.com" }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true, applicationId: "application-1" });
    expect(mocks.createBetaApplication).toHaveBeenCalledWith({
      name: "María Calderón",
      email: "Maria@Example.com",
      metadata: expect.objectContaining({ utm_source: "linkedin", landing_path: "/api/beta/applications" }),
    });
  });

  it("rejects malformed input without creating an application", async () => {
    const response = await POST(buildRequest({ name: "", email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(mocks.createBetaApplication).not.toHaveBeenCalled();
  });

  it("returns conflict for an active duplicate", async () => {
    mocks.createBetaApplication.mockRejectedValue(new mocks.BetaApplicationConflictError("Ya existe una solicitud activa para este correo."));

    const response = await POST(buildRequest({ name: "María Calderón", email: "maria@example.com" }));

    expect(response.status).toBe(409);
  });

  it("returns 429 when the IP reaches the limit", async () => {
    mocks.consumeRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 120 });

    const response = await POST(buildRequest({ name: "María Calderón", email: "maria@example.com" }));

    expect(response.status).toBe(429);
    expect(mocks.createBetaApplication).not.toHaveBeenCalled();
  });
});
