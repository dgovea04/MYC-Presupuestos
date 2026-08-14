/* @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { AdminUserAccessForm } from "@/components/admin/admin-user-access-form";

const plans = [{ name: "Starter", slug: "starter" }];

const pendingUser = {
  id: "user-1",
  name: "Usuario Test",
  email: "test2@test2.com",
  emailVerifiedAt: null,
  role: "USER" as const,
  status: "ACTIVE" as const,
  planSlug: "starter",
  aiTokenExtraMonthly: 0,
};

describe("AdminUserAccessForm", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a manual email verification action for users with pending email verification", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminUserAccessForm plans={plans} users={[pendingUser]} />);

    expect(screen.getByText("Correo pendiente de validacion")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Validar correo" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/user-1/verify-email", {
        method: "PATCH",
      });
    });
    expect(await screen.findByText("Correo validado manualmente.")).toBeTruthy();
  });

  it("shows verified state without a manual verification button when the email is verified", () => {
    render(
      <AdminUserAccessForm
        plans={plans}
        users={[
          {
            ...pendingUser,
            emailVerifiedAt: "2026-08-11T10:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Correo verificado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Validar correo" })).toBeNull();
  });

  it("uses the refreshed status when access is saved after suspending a user", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<AdminUserAccessForm plans={plans} users={[pendingUser]} />);

    rerender(
      <AdminUserAccessForm
        plans={plans}
        users={[{ ...pendingUser, status: "SUSPENDED" }]}
      />,
    );

    await waitFor(() => {
      expect((document.querySelector('select[name="status"]') as HTMLSelectElement).value).toBe("SUSPENDED");
    });

    fireEvent.click(screen.getByRole("button", { name: "Guardar acceso" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/user-1", expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"status":"SUSPENDED"'),
      }));
    });
  });
});
