import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

import { authOptions } from "@/lib/auth/options";
import { resetUserProfileColumnSupportCacheForTests } from "@/lib/data/user-profile-columns";

describe("authOptions callbacks", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
    resetUserProfileColumnSupportCacheForTests();
  });

  it("uses an explicit auth secret for stable JWT session encryption", () => {
    expect(authOptions.secret).toBeTruthy();
  });

  it("uses an app-scoped session cookie to avoid stale default NextAuth JWTs", () => {
    expect(authOptions.cookies?.sessionToken?.name).toContain("myc-presupuestos.session-token");
  });

  it("hydrates session user fields from the latest database snapshot", async () => {
    queryRawMock
      .mockResolvedValueOnce([
        { column_name: "avatarUrl" },
        { column_name: "phone" },
        { column_name: "jobTitle" },
        { column_name: "bio" },
      ])
      .mockResolvedValueOnce([
      {
        id: "user-1",
        name: "Maria Actualizada",
        email: "maria@example.com",
        avatarUrl: "/uploads/avatars/user-1.webp",
        phone: "987654321",
        jobTitle: "Ingeniera Residente",
        bio: "Especialista en costos",
        role: "USER",
        status: "ACTIVE",
      },
      ]);

    const session = await authOptions.callbacks?.session?.({
      session: {
        expires: "2026-05-18T12:00:00.000Z",
        user: {
          name: "Nombre Viejo",
          email: "old@example.com",
        },
      },
      token: {
        id: "user-1",
        name: "Nombre Viejo",
        email: "old@example.com",
        avatarUrl: null,
      },
      user: undefined,
      newSession: undefined,
      trigger: "update",
    });

    expect(queryRawMock).toHaveBeenCalledTimes(2);
    expect(session?.user).toEqual({
      id: "user-1",
      name: "Maria Actualizada",
      email: "maria@example.com",
      avatarUrl: "/uploads/avatars/user-1.webp",
      phone: "987654321",
      jobTitle: "Ingeniera Residente",
      bio: "Especialista en costos",
      role: "USER",
      status: "ACTIVE",
    });
  });

  it("falls back to token values when the database snapshot is unavailable", async () => {
    queryRawMock
      .mockResolvedValueOnce([
        { column_name: "avatarUrl" },
        { column_name: "phone" },
        { column_name: "jobTitle" },
        { column_name: "bio" },
      ])
      .mockResolvedValueOnce([]);

    const session = await authOptions.callbacks?.session?.({
      session: {
        expires: "2026-05-18T12:00:00.000Z",
        user: {
          name: "Nombre Token",
          email: "token@example.com",
        },
      },
      token: {
        id: "user-1",
        name: "Nombre Token",
        email: "token@example.com",
        avatarUrl: "/uploads/avatars/token.webp",
        phone: "999888777",
        jobTitle: "Coordinador de obra",
        bio: "Perfil desde token",
        role: "USER",
        status: "ACTIVE",
      },
      user: undefined,
      newSession: undefined,
      trigger: "update",
    });

    expect(session?.user).toEqual({
      id: "user-1",
      name: "Nombre Token",
      email: "token@example.com",
      avatarUrl: "/uploads/avatars/token.webp",
      phone: "999888777",
      jobTitle: "Coordinador de obra",
      bio: "Perfil desde token",
      role: "USER",
      status: "ACTIVE",
    });
  });

  it("hydrates session gracefully when optional profile columns are not yet migrated", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ column_name: "avatarUrl" }])
      .mockResolvedValueOnce([
        {
          id: "user-1",
          name: "Usuario Demo",
          email: "demo@mycpresupuestos.pe",
          avatarUrl: "/uploads/avatars/user-1.webp",
        },
      ]);

    const session = await authOptions.callbacks?.session?.({
      session: {
        expires: "2026-05-18T12:00:00.000Z",
        user: {
          name: "Usuario Demo",
          email: "demo@mycpresupuestos.pe",
        },
      },
      token: {
        id: "user-1",
        name: "Usuario Demo",
        email: "demo@mycpresupuestos.pe",
        avatarUrl: "/uploads/avatars/user-1.webp",
      },
      user: undefined,
      newSession: undefined,
      trigger: "update",
    });

    expect(session?.user).toEqual({
      id: "user-1",
      name: "Usuario Demo",
      email: "demo@mycpresupuestos.pe",
      avatarUrl: "/uploads/avatars/user-1.webp",
      phone: null,
      jobTitle: null,
      bio: null,
      role: "USER",
      status: "ACTIVE",
    });
  });
});
