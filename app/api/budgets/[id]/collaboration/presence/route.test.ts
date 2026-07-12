import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/collaboration/presence", () => ({
  upsertPresenceHeartbeat: vi.fn(),
  removePresence: vi.fn(),
  listActivePresence: vi.fn(),
}));

import { GET, POST, DELETE } from "@/app/api/budgets/[id]/collaboration/presence/route";
import { getAuthSession } from "@/lib/auth/session";
import { upsertPresenceHeartbeat, removePresence, listActivePresence } from "@/lib/collaboration/presence";

const defaultPresence = {
  id: "presence-1",
  companyId: "company-1",
  projectId: "project-1",
  budgetId: "budget-1",
  userId: "user-1",
  userName: "Juan Perez",
  userAvatarUrl: null,
  route: "/budgets/budget-1",
  module: "budget",
  status: "ACTIVE" as const,
  lastSeenAt: "2026-07-07T12:00:00.000Z",
  expiresAt: "2026-07-07T12:00:30.000Z",
};

describe("collaboration presence route", () => {
  it("returns 401 when unauthenticated on GET", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/presence"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when unauthenticated on POST", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: "/budgets/budget-1", module: "budget" }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 401 when unauthenticated on DELETE", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/budgets/budget-1/collaboration/presence", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("lists active presence", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listActivePresence).mockResolvedValue([defaultPresence]);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/presence"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(listActivePresence).toHaveBeenCalledWith("budget-1", "user-1");
    await expect(response.json()).resolves.toEqual({ presence: [defaultPresence] });
  });

  it("returns an empty presence list when nobody is active", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listActivePresence).mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/presence"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ presence: [] });
  });

  it("upserts presence heartbeat on POST", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(upsertPresenceHeartbeat).mockResolvedValue(defaultPresence);

    const body = { route: "/budgets/budget-1", module: "budget", status: "ACTIVE" as const };

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(upsertPresenceHeartbeat).toHaveBeenCalledWith(
      "budget-1",
      "user-1",
      body.route,
      body.module,
      body.status,
    );
    await expect(response.json()).resolves.toEqual({ presence: defaultPresence });
  });

  it("defaults presence status to ACTIVE when not provided", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(upsertPresenceHeartbeat).mockResolvedValue({
      ...defaultPresence,
      status: "ACTIVE",
    });

    const body = { route: "/budgets/budget-1", module: "budget" };

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(upsertPresenceHeartbeat).toHaveBeenCalledWith(
      "budget-1",
      "user-1",
      "/budgets/budget-1",
      "budget",
      "ACTIVE",
    );
  });

  it("removes presence on DELETE", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(removePresence).mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("http://localhost/api/budgets/budget-1/collaboration/presence", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(removePresence).toHaveBeenCalledWith("budget-1", "user-1");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("rejects invalid presence payload with 400", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: "", module: "" }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when listActivePresence throws", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listActivePresence).mockRejectedValue(new Error("Presupuesto no encontrado"));

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/presence"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Presupuesto no encontrado",
    });
  });

  it("returns 400 when removePresence throws", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(removePresence).mockRejectedValue(new Error("No tienes permisos"));

    const response = await DELETE(
      new Request("http://localhost/api/budgets/budget-1/collaboration/presence", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No tienes permisos",
    });
  });

  it("treats aborted POST presence requests as quiet cancellations", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    const abortError = Object.assign(new Error("aborted"), { code: "ECONNRESET" });
    vi.mocked(upsertPresenceHeartbeat).mockRejectedValue(abortError);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: "/budgets/budget-1", module: "budget" }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(204);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
