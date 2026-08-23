import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock, companyFindFirstMock, companyMembershipFindManyMock, userFindUniqueMock, verifyPasswordMock, verifyAdminMfaCodeMock, consumeRateLimitMock, registerUserWithCompanyAndDemoMock, ensureUserHasCompanyMock, ensureDemoProjectForCompanyMock, assignAutomaticBetaForUserMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  companyFindFirstMock: vi.fn(),
  companyMembershipFindManyMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
  verifyAdminMfaCodeMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
  registerUserWithCompanyAndDemoMock: vi.fn(),
  ensureUserHasCompanyMock: vi.fn(),
  ensureDemoProjectForCompanyMock: vi.fn(),
  assignAutomaticBetaForUserMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
    company: { findFirst: companyFindFirstMock },
    companyMembership: { findMany: companyMembershipFindManyMock },
    user: { findUnique: userFindUniqueMock },
  },
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: verifyPasswordMock,
}));

vi.mock("@/lib/auth/admin-mfa", () => ({
  verifyAdminMfaCode: verifyAdminMfaCodeMock,
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

vi.mock("@/lib/auth/registration", () => ({
  ensureUserHasCompany: ensureUserHasCompanyMock,
  registerUserWithCompanyAndDemo: registerUserWithCompanyAndDemoMock,
}));

vi.mock("@/lib/onboarding/demo-project", () => ({
  ensureDemoProjectForCompany: ensureDemoProjectForCompanyMock,
}));

vi.mock("@/lib/beta/assignments", () => ({
  assignAutomaticBetaForUser: assignAutomaticBetaForUserMock,
}));

import { authOptions } from "@/lib/auth/options";
import { resetUserProfileColumnSupportCacheForTests } from "@/lib/data/user-profile-columns";

type AuthCallbacks = NonNullable<typeof authOptions.callbacks>;
type SessionCallback = NonNullable<AuthCallbacks["session"]>;
type SignInCallback = NonNullable<AuthCallbacks["signIn"]>;
type JwtCallback = NonNullable<AuthCallbacks["jwt"]>;

async function runSessionCallback(input: Parameters<SessionCallback>[0]) {
  const callback = authOptions.callbacks?.session;
  if (!callback) throw new Error("No session callback");
  return callback(input);
}

async function runSignInCallback(input: Parameters<SignInCallback>[0]) {
  const callback = authOptions.callbacks?.signIn;
  if (!callback) throw new Error("No signIn callback");
  return callback(input);
}

async function runJwtCallback(input: Parameters<JwtCallback>[0]) {
  const callback = authOptions.callbacks?.jwt;
  if (!callback) throw new Error("No jwt callback");
  return callback(input);
}

describe("authOptions callbacks", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
    companyFindFirstMock.mockReset();
    companyMembershipFindManyMock.mockReset();
    userFindUniqueMock.mockReset();
    verifyPasswordMock.mockReset();
    verifyAdminMfaCodeMock.mockReset();
    consumeRateLimitMock.mockReset().mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 900 });
    registerUserWithCompanyAndDemoMock.mockReset();
    ensureUserHasCompanyMock.mockReset();
    ensureDemoProjectForCompanyMock.mockReset();
    assignAutomaticBetaForUserMock.mockReset().mockResolvedValue(null);
    resetUserProfileColumnSupportCacheForTests();
  });

  it("uses an explicit auth secret for stable JWT session encryption", () => {
    expect(authOptions.secret).toBeTruthy();
  });

  it("uses an app-scoped session cookie to avoid stale default NextAuth JWTs", () => {
    expect(authOptions.cookies?.sessionToken?.name).toContain("myc-presupuestos.session-token");
  });

  it("keeps the NextAuth route handler in the optional catch-all segment", () => {
    const nonOptionalCatchAllRoute = path.join(process.cwd(), "app", "api", "auth", "[...nextauth]", "route.ts");
    const optionalCatchAllRoute = path.join(process.cwd(), "app", "api", "auth", "[[...nextauth]]", "route.ts");

    expect(existsSync(nonOptionalCatchAllRoute)).toBe(false);
    expect(existsSync(optionalCatchAllRoute)).toBe(true);
  });

  it("includes Google as a configured provider", () => {
    const providerIds = authOptions.providers.map((p) => p.id);
    expect(providerIds).toContain("google");
  });

  it("denies credentials sign-in when the email is still unverified", async () => {
    queryRawMock
      .mockResolvedValueOnce([
        { column_name: "avatarUrl" },
        { column_name: "phone" },
        { column_name: "jobTitle" },
        { column_name: "bio" },
        { column_name: "emailVerifiedAt" },
      ])
      .mockResolvedValueOnce([
        {
          id: "user-1",
          name: "Maria",
          email: "maria@example.com",
          passwordHash: "stored-hash",
          avatarUrl: null,
          phone: null,
          jobTitle: null,
          bio: null,
          role: "USER",
          status: "ACTIVE",
          emailVerifiedAt: null,
        },
      ]);
    verifyPasswordMock.mockResolvedValue(true);

    const credentialsProvider = authOptions.providers.find((provider) => provider.id === "credentials");
    if (!credentialsProvider || credentialsProvider.type !== "credentials") {
      throw new Error("Missing credentials provider");
    }

    const authorize = credentialsProvider.authorize;
    if (!authorize) {
      throw new Error("Missing credentials authorize callback");
    }

    expect(
      authorize({
        email: "maria@example.com",
        password: "password123",
      }, {} as never),
    ).toBeNull();
  });

  it("blocks credential attempts after the persistent account rate limit is exceeded", async () => {
    consumeRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 600 });
    const credentialsProvider = authOptions.providers.find((provider) => provider.id === "credentials");
    if (!credentialsProvider || credentialsProvider.type !== "credentials" || !credentialsProvider.options) {
      throw new Error("Missing credentials provider");
    }
    const authorize = (credentialsProvider.options as { authorize: (credentials: Record<string, unknown>, request: never) => Promise<unknown> }).authorize;

    expect(await authorize({ email: "admin@example.com", password: "password123" }, {} as never)).toBeNull();
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("requires and validates MFA for the primary administrator during credentials login", async () => {
    queryRawMock
      .mockResolvedValueOnce([
        { column_name: "avatarUrl" },
        { column_name: "phone" },
        { column_name: "jobTitle" },
        { column_name: "bio" },
        { column_name: "emailVerifiedAt" },
      ])
      .mockResolvedValueOnce([
        {
          id: "primary-1",
          name: "Administrador Principal",
          email: "admin@example.com",
          passwordHash: "stored-hash",
          role: "ADMIN",
          status: "ACTIVE",
          isSuperAdmin: true,
          mfaEnabled: true,
          emailVerifiedAt: new Date("2026-08-14T10:00:00.000Z"),
        },
      ]);
    verifyPasswordMock.mockResolvedValue(true);
    verifyAdminMfaCodeMock.mockResolvedValue(false);

    const credentialsProvider = authOptions.providers.find((provider) => provider.id === "credentials");
    if (!credentialsProvider || credentialsProvider.type !== "credentials" || !credentialsProvider.options) {
      throw new Error("Missing credentials provider");
    }
    const authorize = (credentialsProvider.options as { authorize: (credentials: Record<string, unknown>, request: never) => Promise<unknown> }).authorize;

    await expect(authorize({ email: "admin@example.com", password: "password123" }, {} as never)).rejects.toThrow("MFA_REQUIRED");
    expect(verifyAdminMfaCodeMock).not.toHaveBeenCalled();

    queryRawMock.mockResolvedValueOnce([
      {
        id: "primary-1",
        name: "Administrador Principal",
        email: "admin@example.com",
        passwordHash: "stored-hash",
        role: "ADMIN",
        status: "ACTIVE",
        isSuperAdmin: true,
        mfaEnabled: true,
        emailVerifiedAt: new Date("2026-08-14T10:00:00.000Z"),
      },
    ]);

    const secondLoginResult = await authorize({ email: "admin@example.com", password: "password123", mfaCode: "123456" }, {} as never);
    expect(secondLoginResult).toBeNull();
    expect(verifyAdminMfaCodeMock).toHaveBeenCalledWith("primary-1", "123456");
  });

  it("allows the primary administrator to complete credentials login with valid MFA", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ column_name: "avatarUrl" }, { column_name: "phone" }, { column_name: "jobTitle" }, { column_name: "bio" }])
      .mockResolvedValueOnce([
        {
          id: "primary-1",
          name: "Administrador Principal",
          email: "admin@example.com",
          passwordHash: "stored-hash",
          role: "ADMIN",
          adminProfile: "SUPER_ADMIN",
          status: "ACTIVE",
          isSuperAdmin: true,
          mfaEnabled: true,
          emailVerifiedAt: new Date("2026-08-14T10:00:00.000Z"),
        },
      ]);
    verifyPasswordMock.mockResolvedValue(true);
    verifyAdminMfaCodeMock.mockResolvedValue(true);

    const credentialsProvider = authOptions.providers.find((provider) => provider.id === "credentials");
    if (!credentialsProvider || credentialsProvider.type !== "credentials" || !credentialsProvider.options) {
      throw new Error("Missing credentials provider");
    }
    const authorize = (credentialsProvider.options as { authorize: (credentials: Record<string, unknown>, request: never) => Promise<unknown> }).authorize;

    expect(await authorize({ email: "admin@example.com", password: "password123", mfaCode: "123456" }, {} as never)).toMatchObject({ id: "primary-1", isSuperAdmin: true, mfaEnabled: true });
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

    const session = await runSessionCallback({
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
      adminProfile: null,
      status: "ACTIVE",
      mfaEnabled: false,
      companyId: null,
      activeCompanyId: null,
      workspaces: [],
      plan: null,
    });
  });

  it("invalidates a token when its user no longer exists", async () => {
    queryRawMock
      .mockResolvedValueOnce([
        { column_name: "avatarUrl" },
        { column_name: "phone" },
        { column_name: "jobTitle" },
        { column_name: "bio" },
      ])
      .mockResolvedValueOnce([]);

    const session = await runSessionCallback({
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
      id: "",
      name: "Nombre Token",
      email: "token@example.com",
      avatarUrl: "/uploads/avatars/token.webp",
      phone: "999888777",
      jobTitle: "Coordinador de obra",
      bio: "Perfil desde token",
      role: "USER",
      adminProfile: null,
      status: "ACTIVE",
      mfaEnabled: false,
      companyId: "company-1",
      activeCompanyId: null,
      workspaces: [],
      plan: "pro",
    });
  });

  it("invalidates a session when the persisted version differs from the JWT", async () => {
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
          name: "Maria",
          email: "maria@example.com",
          role: "USER",
          status: "ACTIVE",
          sessionVersion: 3,
        },
      ]);

    const session = await runSessionCallback({
      session: {
        expires: "2026-05-18T12:00:00.000Z",
        user: { name: "Maria", email: "maria@example.com" },
      },
      token: { id: "user-1", name: "Maria", email: "maria@example.com", sessionVersion: 2 },
      user: undefined,
      newSession: undefined,
      trigger: "update",
    });

    expect(session?.user.id).toBe("");
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

    const session = await runSessionCallback({
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
      adminProfile: null,
      status: "ACTIVE",
      mfaEnabled: false,
      companyId: "company-demo",
      activeCompanyId: null,
      workspaces: [],
      plan: "starter",
    });
  });

  describe("redirect callback", () => {
    it("allows an app-relative URL starting with /", async () => {
      const callback = authOptions.callbacks?.redirect;
      if (!callback) throw new Error("No redirect callback");
      const result = await callback({ url: "/billing/activate?plan=pro", baseUrl: "http://localhost:3000" });
      expect(result).toBe("/billing/activate?plan=pro");
    });

    it("allows an absolute URL matching NEXT_PUBLIC_APP_URL", async () => {
      const callback = authOptions.callbacks?.redirect;
      if (!callback) throw new Error("No redirect callback");
      const result = await callback({ url: "http://localhost:3000/billing/activate?plan=pro", baseUrl: "http://localhost:3000" });
      expect(result).toBe("http://localhost:3000/billing/activate?plan=pro");
    });

    it("redirects to /dashboard for a URL with a different origin", async () => {
      const callback = authOptions.callbacks?.redirect;
      if (!callback) throw new Error("No redirect callback");
      const result = await callback({ url: "https://evil.example.com/dashboard", baseUrl: "http://localhost:3000" });
      expect(result).toBe("http://localhost:3000/dashboard");
    });

    it("redirects to /dashboard for a double-slash protocol-relative URL", async () => {
      const callback = authOptions.callbacks?.redirect;
      if (!callback) throw new Error("No redirect callback");
      const result = await callback({ url: "//evil.example.com", baseUrl: "http://localhost:3000" });
      expect(result).toBe("http://localhost:3000/dashboard");
    });

    it("redirects to /dashboard for an absolute URL matching NEXTAUTH_URL when NEXT_PUBLIC_APP_URL is unset", async () => {
      const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      const originalAuthUrl = process.env.NEXTAUTH_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      process.env.NEXTAUTH_URL = "https://myc.app";

      try {
        // Re-import to pick up new env; the redirect callback reads them at call time
        const callback = authOptions.callbacks?.redirect;
        if (!callback) throw new Error("No redirect callback");
        const result = await callback({ url: "https://myc.app/billing/activate?plan=pro", baseUrl: "https://myc.app" });
        expect(result).toBe("https://myc.app/billing/activate?plan=pro");
      } finally {
        if (originalAppUrl) {
          process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
        } else {
          delete process.env.NEXT_PUBLIC_APP_URL;
        }
        if (originalAuthUrl) {
          process.env.NEXTAUTH_URL = originalAuthUrl;
        } else {
          delete process.env.NEXTAUTH_URL;
        }
      }
    });

    it("preserves the Pro activation path from Google OAuth", async () => {
      const callback = authOptions.callbacks?.redirect;
      if (!callback) throw new Error("No redirect callback");
      const result = await callback({ url: "http://localhost:3000/billing/activate?plan=pro", baseUrl: "http://localhost:3000" });
      expect(result).toBe("http://localhost:3000/billing/activate?plan=pro");
    });
  });

  describe("Google OAuth signIn callback", () => {
    it("denies sign-in when Google profile has no email", async () => {
      const result = await runSignInCallback({
        user: { email: null },
        account: { provider: "google", type: "oauth", providerAccountId: "123" },
        profile: { email_verified: true },
        email: undefined,
        credentials: undefined,
      });

      expect(result).toBe(false);
    });

    it("denies sign-in when Google email is not verified", async () => {
      const result = await runSignInCallback({
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

      const result = await runSignInCallback({
        user: { email: "test@example.com" },
        account: { provider: "google", type: "oauth", providerAccountId: "123" },
        profile: { email: "test@example.com", email_verified: true, name: "Test User" },
        email: undefined,
        credentials: undefined,
      });

      expect(result).toBe(false);
    });

    it("registers a new Google user with a company and demo project", async () => {
      registerUserWithCompanyAndDemoMock.mockResolvedValue({
        user: { id: "user-google-new" },
        company: { id: "company-google-new" },
        demoProject: { status: "created" },
      });
      queryRawMock
        .mockResolvedValueOnce([
          { column_name: "avatarUrl" },
          { column_name: "phone" },
          { column_name: "jobTitle" },
          { column_name: "bio" },
          { column_name: "emailVerifiedAt" },
        ])
        .mockResolvedValueOnce([]);

      const result = await runSignInCallback({
        user: { email: "maria@example.com" },
        account: { provider: "google", type: "oauth", providerAccountId: "123" },
        profile: {
          email: "maria@example.com",
          email_verified: true,
          name: "Maria Calderon",
          picture: "https://example.com/avatar.png",
        },
        email: undefined,
        credentials: undefined,
      });

      expect(result).toBe(true);
      expect(registerUserWithCompanyAndDemoMock).toHaveBeenCalledWith({
        name: "Maria Calderon",
        email: "maria@example.com",
        avatarUrl: "https://example.com/avatar.png",
        emailVerifiedAt: expect.any(Date),
      });
    });

    it("ensures an active existing Google user has an initial company and demo project", async () => {
      queryRawMock
        .mockResolvedValueOnce([
          { column_name: "avatarUrl" },
          { column_name: "phone" },
          { column_name: "jobTitle" },
          { column_name: "bio" },
        ])
        .mockResolvedValueOnce([
          {
            id: "user-google-existing",
            name: "Google User",
            email: "google@example.com",
            passwordHash: null,
            avatarUrl: null,
            phone: null,
            jobTitle: null,
            bio: null,
            role: "USER",
            status: "ACTIVE",
          },
        ]);
      ensureUserHasCompanyMock.mockResolvedValue("company-google");

      const result = await runSignInCallback({
        user: { email: "google@example.com" },
        account: { provider: "google", type: "oauth", providerAccountId: "123" },
        profile: { email: "google@example.com", email_verified: true, name: "Google User" },
        email: undefined,
        credentials: undefined,
      });

      expect(result).toBe(true);
      expect(ensureUserHasCompanyMock).toHaveBeenCalledWith("user-google-existing", {
        name: "Google User",
        email: "google@example.com",
      });
      expect(ensureDemoProjectForCompanyMock).toHaveBeenCalledWith({
        userId: "user-google-existing",
        companyId: "company-google",
        enabled: true,
      });
      expect(registerUserWithCompanyAndDemoMock).not.toHaveBeenCalled();
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
      companyMembershipFindManyMock.mockResolvedValue([
        {
          companyId: "company-google",
          role: "OWNER",
          company: { name: "Google Company", logoUrl: null },
        },
      ]);
      userFindUniqueMock.mockResolvedValue({
        membershipPlan: { slug: "starter" },
      });

      const token = await runJwtCallback({
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
      expect(token.activeCompanyId).toBe("company-google");
      expect(token.workspaces).toEqual([
        {
          id: "company-google",
          name: "Google Company",
          role: "OWNER",
          logoUrl: null,
        },
      ]);
      expect(token.plan).toBe("starter");
    });
  });
});
