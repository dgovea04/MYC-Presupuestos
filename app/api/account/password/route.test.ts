import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/account", () => ({
  AccountCurrentPasswordError: class AccountCurrentPasswordError extends Error {},
  updateUserPassword: vi.fn(),
}));

import { PATCH } from "@/app/api/account/password/route";
import { getAuthSession } from "@/lib/auth/session";
import { AccountCurrentPasswordError, updateUserPassword } from "@/lib/data/account";

describe("account password route", () => {
  it("returns 401 when the request is unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autenticado" });
  });

  it("updates the password when the payload is valid", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(updateUserPassword).mockResolvedValue(undefined);

    const response = await PATCH(
      new Request("http://localhost/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "actual-123",
          newPassword: "nueva-12345",
          confirmPassword: "nueva-12345",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserPassword).toHaveBeenCalledWith("user-1", {
      currentPassword: "actual-123",
      newPassword: "nueva-12345",
      confirmPassword: "nueva-12345",
    });
  });

  it("returns a friendly error when the current password is incorrect", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(updateUserPassword).mockRejectedValue(new AccountCurrentPasswordError());

    const response = await PATCH(
      new Request("http://localhost/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "incorrecta",
          newPassword: "nueva-12345",
          confirmPassword: "nueva-12345",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "La contrasena actual no es correcta.",
    });
  });
});
