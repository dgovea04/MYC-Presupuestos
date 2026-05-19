import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  queryRawMock,
} = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
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
  },
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: hashPasswordMock,
  verifyPassword: verifyPasswordMock,
}));

import {
  AccountCurrentPasswordError,
  clearUserAvatar,
  getUserAccount,
  updateUserAccountAvatar,
  updateUserAccountProfile,
  updateUserPassword,
} from "@/lib/data/account";
import { resetUserProfileColumnSupportCacheForTests } from "@/lib/data/user-profile-columns";

describe("account data", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
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
});
