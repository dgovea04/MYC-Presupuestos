import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  queryRawMock,
  userFindUniqueMock,
  getEffectiveWorkspaceLicenseMock,
} = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  getEffectiveWorkspaceLicenseMock: vi.fn(),
}));

const {
  hashPasswordMock,
  verifyPasswordMock,
} = vi.hoisted(() => ({
  hashPasswordMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
    user: {
      findUnique: userFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: hashPasswordMock,
  verifyPassword: verifyPasswordMock,
}));

vi.mock("@/lib/workspace/entitlements", () => ({
  getEffectiveWorkspaceLicense: getEffectiveWorkspaceLicenseMock,
}));

import {
  AccountCurrentPasswordError,
  clearUserAvatar,
  getUserAccount,
  getUserAccountMembership,
  updateUserAccountAvatar,
  updateUserAccountProfile,
  updateUserPassword,
} from "@/lib/data/account";
import { resetUserProfileColumnSupportCacheForTests } from "@/lib/data/user-profile-columns";

describe("account data", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
    userFindUniqueMock.mockReset();
    getEffectiveWorkspaceLicenseMock.mockReset();
    hashPasswordMock.mockReset();
    verifyPasswordMock.mockReset();
    resetUserProfileColumnSupportCacheForTests();
  });

  it("returns the normalized account record for the authenticated user", async () => {
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
          name: "Maria Calderon",
          email: "maria@example.com",
          avatarUrl: "/uploads/avatars/user-1.png",
          phone: "987654321",
          jobTitle: "Ingeniera Residente",
          bio: "Especialista en costos",
          createdAt: new Date("2026-05-18T10:00:00.000Z"),
        },
      ]);

    await expect(getUserAccount("user-1")).resolves.toEqual({
      id: "user-1",
      name: "Maria Calderon",
      email: "maria@example.com",
      avatarUrl: "/uploads/avatars/user-1.png",
      phone: "987654321",
      jobTitle: "Ingeniera Residente",
      bio: "Especialista en costos",
      createdAt: "2026-05-18T10:00:00.000Z",
    });
  });

  it("updates the user profile fields for profile edits", async () => {
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
          name: "Maria Calderon",
          email: "maria@example.com",
          avatarUrl: null,
          phone: "987654321",
          jobTitle: "Ingeniera Residente",
          bio: "Especialista en costos",
          createdAt: new Date("2026-05-18T10:00:00.000Z"),
        },
      ]);

    await updateUserAccountProfile("user-1", {
      name: "Maria Calderon",
      phone: "987654321",
      jobTitle: "Ingeniera Residente",
      bio: "Especialista en costos",
    });

    expect(queryRawMock).toHaveBeenCalledTimes(2);
  });

  it("stores and clears avatar urls without touching other account fields", async () => {
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
          avatarUrl: "/uploads/avatars/user-1.webp",
          phone: null,
          jobTitle: null,
          bio: null,
          createdAt: new Date("2026-05-18T10:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "user-1",
          name: "Maria",
          email: "maria@example.com",
          avatarUrl: null,
          phone: null,
          jobTitle: null,
          bio: null,
          createdAt: new Date("2026-05-18T10:00:00.000Z"),
        },
      ]);

    await updateUserAccountAvatar("user-1", "/uploads/avatars/user-1.webp");
    await clearUserAvatar("user-1");

    expect(queryRawMock).toHaveBeenCalledTimes(3);
  });

  it("falls back to blank profile fields when professional columns are not migrated yet", async () => {
    queryRawMock
      .mockResolvedValueOnce([{ column_name: "avatarUrl" }])
      .mockResolvedValueOnce([
        {
          id: "user-1",
          name: "Maria",
          email: "maria@example.com",
          avatarUrl: null,
          createdAt: new Date("2026-05-18T10:00:00.000Z"),
        },
      ]);

    await expect(getUserAccount("user-1")).resolves.toEqual({
      id: "user-1",
      name: "Maria",
      email: "maria@example.com",
      avatarUrl: null,
      phone: "",
      jobTitle: "",
      bio: "",
      createdAt: "2026-05-18T10:00:00.000Z",
    });
  });

  it("changes the password only when the current password is valid", async () => {
    queryRawMock.mockResolvedValueOnce([{ passwordHash: "stored-hash" }]).mockResolvedValueOnce([]);
    verifyPasswordMock.mockResolvedValue(true);
    hashPasswordMock.mockResolvedValue("next-hash");

    await updateUserPassword("user-1", {
      currentPassword: "actual-123",
      newPassword: "nueva-12345",
      confirmPassword: "nueva-12345",
    });

    expect(verifyPasswordMock).toHaveBeenCalledWith("actual-123", "stored-hash");
    expect(hashPasswordMock).toHaveBeenCalledWith("nueva-12345");
    expect(queryRawMock).toHaveBeenCalledTimes(2);
  });

  it("rejects password changes when the current password is incorrect", async () => {
    queryRawMock.mockResolvedValueOnce([{ passwordHash: "stored-hash" }]);
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      updateUserPassword("user-1", {
        currentPassword: "incorrecta",
        newPassword: "nueva-12345",
        confirmPassword: "nueva-12345",
      }),
    ).rejects.toBeInstanceOf(AccountCurrentPasswordError);
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  describe("getUserAccountMembership", () => {
    beforeEach(() => {
      userFindUniqueMock.mockResolvedValue({
        aiTokenExtraMonthly: 0,
        membershipPlan: {
          name: "Pro",
          slug: "pro",
          monthlyTokenLimit: 10000,
        },
        billingSubscriptions: [],
        aiUsagePeriods: [],
      });
      getEffectiveWorkspaceLicenseMock.mockResolvedValue({
        planSlug: "pro",
        planName: "Pro",
        role: "OWNER",
        availableFeatures: ["ai.local", "exports.advanced"],
      });
    });

    it("passes activeCompanyId to getEffectiveWorkspaceLicense", async () => {
      await getUserAccountMembership("user-1", "ws-1");

      expect(getEffectiveWorkspaceLicenseMock).toHaveBeenCalledWith({
        userId: "user-1",
        companyId: "ws-1",
      });
    });

    it("passes null companyId when not provided", async () => {
      await getUserAccountMembership("user-1");

      expect(getEffectiveWorkspaceLicenseMock).toHaveBeenCalledWith({
        userId: "user-1",
        companyId: undefined,
      });
    });

    it("passes null companyId when explicitly null", async () => {
      await getUserAccountMembership("user-1", null);

      expect(getEffectiveWorkspaceLicenseMock).toHaveBeenCalledWith({
        userId: "user-1",
        companyId: null,
      });
    });

    it("returns effectivePlanSlug from workspace license", async () => {
      getEffectiveWorkspaceLicenseMock.mockResolvedValue({
        planSlug: "starter",
        planName: "Starter",
        role: "MEMBER",
        availableFeatures: [],
      });

      const result = await getUserAccountMembership("user-1", "ws-1");

      expect(result.effectivePlanSlug).toBe("starter");
      expect(result.canUpgrade).toBe(true);
    });

    it("returns canUpgrade=false when license is already pro", async () => {
      const result = await getUserAccountMembership("user-1", "ws-1");

      expect(result.effectivePlanSlug).toBe("pro");
      expect(result.canUpgrade).toBe(false);
    });

    it("falls back to the user's personal plan when no active workspace license is available", async () => {
      getEffectiveWorkspaceLicenseMock.mockResolvedValue(null);

      const result = await getUserAccountMembership("user-1", null);

      expect(result.effectivePlanSlug).toBe("pro");
      expect(result.canUpgrade).toBe(false);
    });

    it("throws when user is not found", async () => {
      userFindUniqueMock.mockResolvedValue(null);

      await expect(
        getUserAccountMembership("user-1", "ws-1"),
      ).rejects.toThrow("Usuario no encontrado.");
    });
  });
});
