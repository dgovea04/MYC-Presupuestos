import { describe, expect, it, vi } from "vitest";

const withAuthMock = vi.fn();

vi.mock("next-auth/middleware", () => ({
  withAuth: withAuthMock,
}));

describe("proxy auth configuration", () => {
  it("passes the custom app session cookie name to withAuth", async () => {
    await import("./proxy");

    expect(withAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cookies: {
          sessionToken: {
            name: "myc-presupuestos.session-token",
          },
        },
      }),
    );
  });
});
