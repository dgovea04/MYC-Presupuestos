import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  companyFindFirstMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  registerUserWithCompanyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRawMock,
    company: { findFirst: mocks.companyFindFirstMock },
    user: { findUnique: mocks.userFindUniqueMock },
  },
}));

vi.mock("@/lib/auth/registration", () => ({
  registerUserWithCompany: mocks.registerUserWithCompanyMock,
}));

import { authOptions } from "@/lib/auth/options";
import { resetUserProfileColumnSupportCacheForTests } from "@/lib/data/user-profile-columns";

function mockProfileColumns() {
  mocks.queryRawMock.mockResolvedValueOnce([
    { column_name: "avatarUrl" },
    { column_name: "phone" },
    { column_name: "jobTitle" },
    { column_name: "bio" },
  ]);
}

function mockDbRows(rows: Array<Record<string, unknown>>) {
  mocks.queryRawMock.mockResolvedValueOnce(rows);
}

const googleAccount = {
  provider: "google",
  type: "oauth",
  providerAccountId: "google-123",
};

const googleProfile = {
  email: "maria@gmail.com",
  email_verified: true,
  name: "Maria Calderon",
  picture: "https://lh3.googleusercontent.com/photo",
};

/** Google user: passwordHash is null — no password set */
function makeGoogleDbUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user-maria",
    name: "Maria Calderon",
    email: "maria@gmail.com",
    passwordHash: null,
    avatarUrl: "https://lh3.googleusercontent.com/photo",
    phone: null,
    jobTitle: null,
    bio: null,
    role: "USER",
    status: "ACTIVE",
    ...overrides,
  };
}

/** Credentials user: passwordHash is a legacy bcrypt hash */
function makeCredentialsDbUser(overrides: Partial<Record<string, unknown>> = {}) {
  return makeGoogleDbUser({ passwordHash: "some-legacy-bcrypt-hash", ...overrides });
}

const dbCompany = { id: "company-maria" };
const dbMembership = { membershipPlan: { slug: "starter" } };

function getCallbacks() {
  const cbs = authOptions.callbacks;
  if (!cbs?.signIn || !cbs?.jwt || !cbs?.session) {
    throw new Error("Missing callbacks");
  }
  return cbs;
}

describe("Google OAuth — integration flow (signIn → jwt → session)", () => {
  beforeEach(() => {
    mocks.queryRawMock.mockReset();
    mocks.companyFindFirstMock.mockReset();
    mocks.userFindUniqueMock.mockReset();
    mocks.registerUserWithCompanyMock.mockReset();
    resetUserProfileColumnSupportCacheForTests();
  });

  it("full flow: new user signs up via Google, gets correct session", async () => {
    const cbs = getCallbacks();

    // ── signIn: no existing user → registerUserWithCompany ──
    mockProfileColumns();
    mockDbRows([]);
    mocks.registerUserWithCompanyMock.mockResolvedValue({
      user: { id: "user-maria" },
      company: { id: "company-maria" },
    });

    const signInResult = await (cbs.signIn as any)({
      user: { email: googleProfile.email },
      account: googleAccount,
      profile: googleProfile,
      email: undefined,
      credentials: undefined,
    });

    expect(signInResult).toBe(true);
    expect(mocks.registerUserWithCompanyMock).toHaveBeenCalledWith({
      name: "Maria Calderon",
      email: "maria@gmail.com",
      avatarUrl: "https://lh3.googleusercontent.com/photo",
    });

    // ── jwt: reconcile from DB, set companyId and plan ──
    // profile columns are cached from signIn; only user search needs mocking
    mockDbRows([makeGoogleDbUser()]);
    mocks.companyFindFirstMock.mockResolvedValue(dbCompany);
    mocks.userFindUniqueMock.mockResolvedValue(dbMembership);

    const token = await (cbs.jwt as any)({
      token: { name: "", email: "" },
      user: {
        id: "google-oauth-id",
        name: "Maria Calderon",
        email: "maria@gmail.com",
        image: "https://lh3.googleusercontent.com/photo",
      },
      account: googleAccount,
      profile: undefined,
    });

    expect(token.id).toBe("user-maria");
    expect(token.name).toBe("Maria Calderon");
    expect(token.email).toBe("maria@gmail.com");
    expect(token.avatarUrl).toBe("https://lh3.googleusercontent.com/photo");
    expect(token.role).toBe("USER");
    expect(token.status).toBe("ACTIVE");
    expect(token.companyId).toBe("company-maria");
    expect(token.plan).toBe("starter");

    // ── session: hydrate from token, include companyId and plan ──
    // profile columns still cached; only user lookup needs mocking
    mockDbRows([makeGoogleDbUser()]);

    const session = await (cbs.session as any)({
      session: {
        expires: "2026-05-18T12:00:00.000Z",
        user: { name: "", email: "" },
      },
      token,
      user: undefined,
      newSession: undefined,
      trigger: "update",
    });

    expect(session?.user).toEqual({
      id: "user-maria",
      name: "Maria Calderon",
      email: "maria@gmail.com",
      avatarUrl: "https://lh3.googleusercontent.com/photo",
      phone: null,
      jobTitle: null,
      bio: null,
      role: "USER",
      status: "ACTIVE",
      companyId: "company-maria",
      plan: "starter",
    });
  });

  it("full flow: existing Google user signs in again, no duplicate created", async () => {
    const cbs = getCallbacks();

    // ── signIn: user already exists (Google account) ──
    mockProfileColumns();
    mockDbRows([makeGoogleDbUser()]);

    const signInResult = await (cbs.signIn as any)({
      user: { email: googleProfile.email },
      account: googleAccount,
      profile: googleProfile,
      email: undefined,
      credentials: undefined,
    });

    expect(signInResult).toBe(true);
    expect(mocks.registerUserWithCompanyMock).not.toHaveBeenCalled();

    // ── jwt: load existing user from DB ──
    // profile columns cached from signIn
    mockDbRows([makeGoogleDbUser()]);
    mocks.companyFindFirstMock.mockResolvedValue(dbCompany);
    mocks.userFindUniqueMock.mockResolvedValue(dbMembership);

    const token = await (cbs.jwt as any)({
      token: { name: "", email: "" },
      user: {
        id: "google-oauth-id",
        name: "Maria Calderon",
        email: "maria@gmail.com",
        image: "https://lh3.googleusercontent.com/photo",
      },
      account: googleAccount,
      profile: undefined,
    });

    expect(token.id).toBe("user-maria");
    expect(token.companyId).toBe("company-maria");
    expect(token.plan).toBe("starter");

    // ── session ──
    // profile columns still cached
    mockDbRows([makeGoogleDbUser()]);

    const session = await (cbs.session as any)({
      session: {
        expires: "2026-05-18T12:00:00.000Z",
        user: { name: "", email: "" },
      },
      token,
      user: undefined,
      newSession: undefined,
      trigger: "update",
    });

    expect(session?.user?.email).toBe("maria@gmail.com");
    expect(session?.user?.companyId).toBe("company-maria");
    expect(session?.user?.plan).toBe("starter");
  });

  it("full flow: email/password user signs in via Google, no duplicate created", async () => {
    const cbs = getCallbacks();

    // ── signIn: user already exists with passwordHash ──
    mockProfileColumns();
    mockDbRows([makeCredentialsDbUser()]);

    const signInResult = await (cbs.signIn as any)({
      user: { email: googleProfile.email },
      account: googleAccount,
      profile: googleProfile,
      email: undefined,
      credentials: undefined,
    });

    expect(signInResult).toBe(true);
    expect(mocks.registerUserWithCompanyMock).not.toHaveBeenCalled();

    // ── jwt ──
    // profile columns cached from signIn
    mockDbRows([makeCredentialsDbUser()]);
    mocks.companyFindFirstMock.mockResolvedValue(dbCompany);
    mocks.userFindUniqueMock.mockResolvedValue(dbMembership);

    const token = await (cbs.jwt as any)({
      token: { name: "", email: "" },
      user: {
        id: "google-oauth-id",
        name: "Maria Calderon",
        email: "maria@gmail.com",
        image: "https://lh3.googleusercontent.com/photo",
      },
      account: googleAccount,
      profile: undefined,
    });

    expect(token.id).toBe("user-maria");
    expect(token.companyId).toBe("company-maria");
    expect(token.plan).toBe("starter");

    // ── session ──
    // profile columns still cached
    mockDbRows([makeCredentialsDbUser()]);

    const session = await (cbs.session as any)({
      session: {
        expires: "2026-05-18T12:00:00.000Z",
        user: { name: "", email: "" },
      },
      token,
      user: undefined,
      newSession: undefined,
      trigger: "update",
    });

    expect(session?.user?.email).toBe("maria@gmail.com");
    expect(session?.user?.companyId).toBe("company-maria");
    expect(session?.user?.plan).toBe("starter");
    expect(session?.user?.role).toBe("USER");
    expect(session?.user?.status).toBe("ACTIVE");
  });

  it("denies sign-in: unverified Google email is rejected", async () => {
    const cbs = getCallbacks();

    // No DB mocks needed: email_verified check happens before any DB calls
    const result = await (cbs.signIn as any)({
      user: { email: googleProfile.email },
      account: googleAccount,
      profile: { ...googleProfile, email_verified: false },
      email: undefined,
      credentials: undefined,
    });

    expect(result).toBe(false);
  });

  it("denies the full flow: suspended user is rejected at signIn", async () => {
    const cbs = getCallbacks();

    mockProfileColumns();
    mockDbRows([makeGoogleDbUser({ status: "SUSPENDED" })]);

    const signInResult = await (cbs.signIn as any)({
      user: { email: googleProfile.email },
      account: googleAccount,
      profile: googleProfile,
      email: undefined,
      credentials: undefined,
    });

    expect(signInResult).toBe(false);
    expect(mocks.registerUserWithCompanyMock).not.toHaveBeenCalled();
  });

  it("denies the full flow: registration failure is caught and returns false", async () => {
    const cbs = getCallbacks();

    mockProfileColumns();
    mockDbRows([]);
    mocks.registerUserWithCompanyMock.mockRejectedValue(new Error("DB connection failed"));

    const signInResult = await (cbs.signIn as any)({
      user: { email: googleProfile.email },
      account: googleAccount,
      profile: googleProfile,
      email: undefined,
      credentials: undefined,
    });

    expect(signInResult).toBe(false);
    expect(mocks.registerUserWithCompanyMock).toHaveBeenCalledTimes(1);
  });
});
