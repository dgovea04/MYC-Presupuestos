import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock, companyFindFirstMock, userFindUniqueMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  companyFindFirstMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
    company: { findFirst: companyFindFirstMock },
    user: { findUnique: userFindUniqueMock },
  },
}));

import { authOptions } from "@/lib/auth/options";
import { resetUserProfileColumnSupportCacheForTests } from "@/lib/data/user-profile-columns";

describe("authOptions callbacks", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
    companyFindFirstMock.mockReset();
    userFindUniqueMock.mockReset();
    resetUserProfileColumnSupportCacheForTests();
  });

  it("uses an explicit auth secret for stable JWT session encryption", () => {
    expect(authOptions.secret).toBeTruthy();
  });

  it("uses an app-scoped session cookie to avoid stale default NextAuth JWTs", () => {
    expect(authOptions.cookies?.sessionToken?.name).toContain("myc-presupuestos.session-token");
  });

  it("keeps the NextAuth route handler in the non-optional catch-all segment", () => {
    const nonOptionalCatchAllRoute = path.join(process.cwd(), "app", "api", "auth", "[...nextauth]", "route.ts");
    const optionalCatchAllRoute = path.join(process.cwd(), "app", "api", "auth", "[[...nextauth]]", "route.ts");

    expect(existsSync(nonOptionalCatchAllRoute)).toBe(true);
    expect(existsSync(optionalCatchAllRoute)).toBe(false);
  });

  it("includes Google as a configured provider", () => {
    const providerIds = authOptions.providers.map((p) => p.id);
    expect(providerIds).toContain("google");
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

    const cb = authOptions.callbacks?.session;
    if (!cb) throw new Error("No session callback");
    const session = await (cb as any)({
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
        companyId: null,
        plan: null,
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
      companyId: null,
      plan: null,
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

    const cb = authOptions.callbacks?.session;
    if (!cb) throw new Error("No session callback");
    const session = await (cb as any)({
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
        companyId: "company-1",
        plan: "pro",
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
      companyId: "company-1",
      plan: "pro",
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

    const cb = authOptions.callbacks?.session;
    if (!cb) throw new Error("No session callback");
    const session = await (cb as any)({
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
        companyId: "company-demo",
        plan: "starter",
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
      companyId: "company-demo",
      plan: "starter",
    });
  });

  describe("Google OAuth signIn callback", () => {
    it("denies sign-in when Google profile has no email", async () => {
      const callback = authOptions.callbacks?.signIn;
      if (!callback) throw new Error("No signIn callback");
      const result = await (callback as any)({
        user: { email: null },
        account: { provider: "google", type: "oauth", providerAccountId: "123" },
        profile: { email_verified: true },
        email: undefined,
        credentials: undefined,
      });

      expect(result).toBe(false);
    });

    it("denies sign-in when Google email is not verified", async () => {
      const callback = authOptions.callbacks?.signIn;
      if (!callback) throw new Error("No signIn callback");
      const result = await (callback as any)({
        user: { email: "test@example.com" },
        account: { provider: "google", type: "oauth", providerAccountId: "123" },
        profile: { email: "test@example.com", email_verified: false },
        email: undefined,
        credentials: undefined,
      });

      expect(result).toBe(false);
    });

    it("denies sign-in when existing user is suspended", async () => {
      queryRawMock
        .mockResolvedValueOnce([
          { column_name: "avatarUrl" },
          { column_name: "phone" },
          { column_name: "jobTitle" },
          { column_name: "bio" },
        ])
        .mockResolvedValueOnce([
          {
            id: "user-suspended",
            name: "Suspended User",
            email: "test@example.com",
            passwordHash: null,
            role: "USER",
            status: "SUSPENDED",
          },
        ]);

      const callback = authOptions.callbacks?.signIn;
      if (!callback) throw new Error("No signIn callback");
      const result = await (callback as any)({
        user: { email: "test@example.com" },
        account: { provider: "google", type: "oauth", providerAccountId: "123" },
        profile: { email: "test@example.com", email_verified: true, name: "Test User" },
        email: undefined,
        credentials: undefined,
      });

      expect(result).toBe(false);
    });
  });

  describe("jwt callback with Google OAuth", () => {
    it("reconciles token from database when signing in via Google", async () => {
      queryRawMock
        .mockResolvedValueOnce([
          { column_name: "avatarUrl" },
          { column_name: "phone" },
          { column_name: "jobTitle" },
          { column_name: "bio" },
        ])
        .mockResolvedValueOnce([
          {
            id: "user-google-1",
            name: "Google User",
            email: "google@example.com",
            passwordHash: null,
            avatarUrl: "https://lh3.googleusercontent.com/photo",
            phone: null,
            jobTitle: null,
            bio: null,
            role: "USER",
            status: "ACTIVE",
          },
        ]);

      companyFindFirstMock.mockResolvedValue({ id: "company-google" });
      userFindUniqueMock.mockResolvedValue({
        membershipPlan: { slug: "starter" },
      });

      const callback = authOptions.callbacks?.jwt;
      if (!callback) throw new Error("No jwt callback");
      const token = await (callback as any)({
        token: { name: "", email: "" },
        user: {
          id: "google-oauth-id",
          name: "Google User",
          email: "google@example.com",
          image: "https://lh3.googleusercontent.com/photo",
        },
        account: {
          provider: "google",
          type: "oauth",
          providerAccountId: "google-oauth-id",
        },
        profile: undefined,
      });

      expect(token.id).toBe("user-google-1");
      expect(token.name).toBe("Google User");
      expect(token.email).toBe("google@example.com");
      expect(token.avatarUrl).toBe("https://lh3.googleusercontent.com/photo");
      expect(token.role).toBe("USER");
      expect(token.status).toBe("ACTIVE");
      expect(token.companyId).toBe("company-google");
      expect(token.plan).toBe("starter");
    });
  });
});
