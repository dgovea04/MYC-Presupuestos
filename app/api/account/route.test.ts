import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/account", () => ({
  getUserAccount: vi.fn(),
  updateUserAccountProfile: vi.fn(),
}));

import { GET, PATCH } from "@/app/api/account/route";
import { getAuthSession } from "@/lib/auth/session";
import { getUserAccount, updateUserAccountProfile } from "@/lib/data/account";

describe("account route", () => {
  it("returns 401 when the request is unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autenticado" });
  });

  it("returns the authenticated account profile on GET", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(getUserAccount).mockResolvedValue({
      id: "user-1",
      name: "Maria Calderon",
      email: "maria@example.com",
      avatarUrl: null,
      phone: "987654321",
      jobTitle: "Ingeniera Residente",
      bio: "Especialista en costos",
      createdAt: "2026-05-18T10:00:00.000Z",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "user-1",
      name: "Maria Calderon",
      email: "maria@example.com",
      avatarUrl: null,
      phone: "987654321",
      jobTitle: "Ingeniera Residente",
      bio: "Especialista en costos",
      createdAt: "2026-05-18T10:00:00.000Z",
    });
  });

  it("validates and updates the profile name on PATCH", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(updateUserAccountProfile).mockResolvedValue({
      id: "user-1",
      name: "Maria Calderon",
      email: "maria@example.com",
      avatarUrl: null,
      phone: "987654321",
      jobTitle: "Ingeniera Residente",
      bio: "Especialista en costos",
      createdAt: "2026-05-18T10:00:00.000Z",
    });

    const response = await PATCH(
      new Request("http://localhost/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Maria Calderon",
          phone: "987654321",
          jobTitle: "Ingeniera Residente",
          bio: "Especialista en costos",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserAccountProfile).toHaveBeenCalledWith("user-1", {
      name: "Maria Calderon",
      phone: "987654321",
      jobTitle: "Ingeniera Residente",
      bio: "Especialista en costos",
    });
  });

  it("returns 400 for invalid profile payloads", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });

    const response = await PATCH(
      new Request("http://localhost/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Al" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Revisa los datos de tu perfil e intenta nuevamente.",
    });
  });
});
