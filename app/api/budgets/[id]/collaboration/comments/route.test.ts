import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/collaboration/comments", () => ({
  listCommentsForEntity: vi.fn(),
  createComment: vi.fn(),
}));

import { GET, POST } from "@/app/api/budgets/[id]/collaboration/comments/route";
import { getAuthSession } from "@/lib/auth/session";
import { listCommentsForEntity, createComment } from "@/lib/collaboration/comments";

const defaultComment = {
  id: "comment-1",
  companyId: "company-1",
  projectId: "project-1",
  budgetId: "budget-1",
  entityType: "BUDGET_ITEM" as const,
  entityId: "item-1",
  parentCommentId: null,
  body: "Revisar rendimiento",
  mentions: [],
  createdById: "user-1",
  createdByName: "Juan Perez",
  createdByAvatarUrl: null,
  resolvedAt: null,
  resolvedById: null,
  resolvedByName: null,
  createdAt: "2026-07-07T12:00:00.000Z",
  updatedAt: "2026-07-07T12:00:00.000Z",
  replyCount: 0,
};

describe("collaboration comments route", () => {
  it("returns 401 when unauthenticated on GET", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/comments"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 401 when unauthenticated on POST", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "BUDGET_ITEM", entityId: "item-1", body: "Test" }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("lists comments for a budget with no filters", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listCommentsForEntity).mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/comments"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ comments: [] });
    expect(listCommentsForEntity).toHaveBeenCalledWith("budget-1", "user-1", {});
  });

  it("forwards entityType and entityId filters to the service", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listCommentsForEntity).mockResolvedValue([defaultComment]);

    const response = await GET(
      new Request(
        "http://localhost/api/budgets/budget-1/collaboration/comments?entityType=BUDGET_ITEM&entityId=item-1&limit=20&cursor=2026-01-01T00:00:00.000Z",
      ),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(listCommentsForEntity).toHaveBeenCalledWith("budget-1", "user-1", {
      entityType: "BUDGET_ITEM",
      entityId: "item-1",
      cursor: "2026-01-01T00:00:00.000Z",
      limit: 20,
    });
  });

  it("creates a comment for the authenticated user", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(createComment).mockResolvedValue(defaultComment);

    const body = {
      entityType: "BUDGET_ITEM",
      entityId: "item-1",
      body: "Revisar rendimiento",
      mentions: ["user-2"],
    };

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(201);
    expect(createComment).toHaveBeenCalledWith("budget-1", "user-1", body);
    await expect(response.json()).resolves.toEqual({ comment: defaultComment });
  });

  it("creates a comment with parentCommentId for replies", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(createComment).mockResolvedValue({
      ...defaultComment,
      parentCommentId: "parent-1",
    });

    const body = {
      entityType: "BUDGET_ITEM",
      entityId: "item-1",
      parentCommentId: "parent-1",
      body: "Respuesta",
    };

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(201);
    expect(createComment).toHaveBeenCalledWith("budget-1", "user-1", body);
  });

  it("returns 400 when the comment service throws", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(createComment).mockRejectedValue(new Error("No tienes permisos"));

    const response = await POST(
      new Request("http://localhost/api/budgets/budget-1/collaboration/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "BUDGET", entityId: "budget-1", body: "Test" }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No tienes permisos",
    });
  });

  it("returns 400 when the list service throws", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(listCommentsForEntity).mockRejectedValue(new Error("Presupuesto no encontrado"));

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/collaboration/comments"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Presupuesto no encontrado",
    });
  });
});
