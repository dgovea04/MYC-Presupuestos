import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/account", () => ({
  clearUserAvatar: vi.fn(),
  getUserAccount: vi.fn(),
  updateUserAccountAvatar: vi.fn(),
}));

vi.mock("@/lib/account/avatar-storage", () => ({
  deleteStoredAvatar: vi.fn(),
  storeAvatarFile: vi.fn(),
}));

import { DELETE, POST } from "@/app/api/account/avatar/route";
import { getAuthSession } from "@/lib/auth/session";
import { clearUserAvatar, getUserAccount, updateUserAccountAvatar } from "@/lib/data/account";
import { deleteStoredAvatar, storeAvatarFile } from "@/lib/account/avatar-storage";

describe("account avatar route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const formData = new FormData();
    formData.set("avatar", new File(["avatar"], "avatar.png", { type: "image/png" }));

    const response = await POST(
      new Request("http://localhost/api/account/avatar", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(401);
  });

  it("stores a valid avatar and persists the returned url", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(getUserAccount).mockResolvedValue({
      id: "user-1",
      name: "Maria",
      email: "maria@example.com",
      avatarUrl: null,
      createdAt: "2026-05-18T10:00:00.000Z",
    });
    vi.mocked(storeAvatarFile).mockResolvedValue("/uploads/avatars/user-1.png");
    vi.mocked(updateUserAccountAvatar).mockResolvedValue({
      id: "user-1",
      name: "Maria",
      email: "maria@example.com",
      avatarUrl: "/uploads/avatars/user-1.png",
      createdAt: "2026-05-18T10:00:00.000Z",
    });

    const formData = new FormData();
    formData.set("avatar", new File(["avatar"], "avatar.png", { type: "image/png" }));

    const response = await POST(
      new Request("http://localhost/api/account/avatar", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    expect(storeAvatarFile).toHaveBeenCalled();
    expect(updateUserAccountAvatar).toHaveBeenCalledWith("user-1", "/uploads/avatars/user-1.png");
  });

  it("rejects invalid avatar files", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });

    const formData = new FormData();
    formData.set("avatar", new File(["avatar"], "avatar.txt", { type: "text/plain" }));

    const response = await POST(
      new Request("http://localhost/api/account/avatar", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Revisa la imagen seleccionada e intenta nuevamente.",
    });
  });

  it("rejects webp avatars so exported documents keep using compatible image formats", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });

    const formData = new FormData();
    formData.set("avatar", new File(["avatar"], "avatar.webp", { type: "image/webp" }));

    const response = await POST(
      new Request("http://localhost/api/account/avatar", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Revisa la imagen seleccionada e intenta nuevamente.",
    });
  });

  it("clears the avatar and removes the local file", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(getUserAccount).mockResolvedValue({
      id: "user-1",
      name: "Maria",
      email: "maria@example.com",
      avatarUrl: "/uploads/avatars/user-1.webp",
      createdAt: "2026-05-18T10:00:00.000Z",
    });
    vi.mocked(clearUserAvatar).mockResolvedValue({
      id: "user-1",
      name: "Maria",
      email: "maria@example.com",
      avatarUrl: null,
      createdAt: "2026-05-18T10:00:00.000Z",
    });

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(deleteStoredAvatar).toHaveBeenCalledWith("/uploads/avatars/user-1.webp");
    expect(clearUserAvatar).toHaveBeenCalledWith("user-1");
  });
});
