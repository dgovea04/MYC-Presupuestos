import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeEmailVerificationTokenMock: vi.fn(),
}));

vi.mock("@/lib/auth/email-verification", () => ({
  consumeEmailVerificationToken: mocks.consumeEmailVerificationTokenMock,
}));

import { GET } from "@/app/api/auth/verify-email/route";

describe("GET /api/auth/verify-email", () => {
  beforeEach(() => {
    mocks.consumeEmailVerificationTokenMock.mockReset();
  });

  it("redirects to login with success state when the token is valid", async () => {
    mocks.consumeEmailVerificationTokenMock.mockResolvedValue({ status: "verified" });

    const response = await GET(new Request("http://localhost/api/auth/verify-email?token=valid-token"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?verified=1");
    expect(mocks.consumeEmailVerificationTokenMock).toHaveBeenCalledWith("valid-token");
  });

  it("preserves the Pro activation path after verification", async () => {
    mocks.consumeEmailVerificationTokenMock.mockResolvedValue({ status: "verified" });

    const response = await GET(new Request("http://localhost/api/auth/verify-email?token=valid-token&next=%2Fbilling%2Factivate%3Fplan%3Dpro"));

    expect(response.headers.get("location")).toBe("http://localhost/login?verified=1&next=%2Fbilling%2Factivate%3Fplan%3Dpro");
  });

  it("redirects to login with invalid state when the token is missing", async () => {
    const response = await GET(new Request("http://localhost/api/auth/verify-email"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?verified=0&reason=invalid");
    expect(mocks.consumeEmailVerificationTokenMock).not.toHaveBeenCalled();
  });

  it("redirects to login with the failure reason from the verification service", async () => {
    mocks.consumeEmailVerificationTokenMock.mockResolvedValue({ status: "expired" });

    const response = await GET(new Request("http://localhost/api/auth/verify-email?token=expired-token"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?verified=0&reason=expired");
  });
});
