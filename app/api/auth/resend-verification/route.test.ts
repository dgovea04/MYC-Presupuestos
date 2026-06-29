import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resendEmailVerificationMock: vi.fn(),
}));

vi.mock("@/lib/auth/email-verification", () => ({
  resendEmailVerification: mocks.resendEmailVerificationMock,
}));

import { POST } from "@/app/api/auth/resend-verification/route";

function buildRequest(body: Record<string, string>) {
  return new Request("http://localhost/api/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/resend-verification", () => {
  beforeEach(() => {
    mocks.resendEmailVerificationMock.mockReset();
  });

  it("resends a verification email for a valid request", async () => {
    mocks.resendEmailVerificationMock.mockResolvedValue({ sent: true });

    const response = await POST(buildRequest({ email: "maria@example.com" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sent: true });
    expect(mocks.resendEmailVerificationMock).toHaveBeenCalledWith("maria@example.com");
  });

  it("returns 400 for an invalid email payload", async () => {
    const response = await POST(buildRequest({ email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(mocks.resendEmailVerificationMock).not.toHaveBeenCalled();
  });
});
