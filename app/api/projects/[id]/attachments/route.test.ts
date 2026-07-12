import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  projectFindFirst: vi.fn(),
  projectAttachmentFindMany: vi.fn(),
  projectAttachmentCreate: vi.fn(),
  projectAttachmentFindFirst: vi.fn(),
  projectAttachmentDelete: vi.fn(),
  storeProjectAttachment: vi.fn(),
  deleteStoredAttachment: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: {
      findFirst: mocks.projectFindFirst,
    },
    projectAttachment: {
      findMany: mocks.projectAttachmentFindMany,
      create: mocks.projectAttachmentCreate,
      findFirst: mocks.projectAttachmentFindFirst,
      delete: mocks.projectAttachmentDelete,
    },
  },
}));

vi.mock("@/lib/storage/project-attachments", () => ({
  storeProjectAttachment: mocks.storeProjectAttachment,
  deleteStoredAttachment: mocks.deleteStoredAttachment,
}));

vi.mock("@/lib/workspace/access", () => ({
  assertWorkspaceMembership: mocks.assertWorkspaceMembership,
}));

vi.mock("@/lib/validations/attachment", () => ({
  projectAttachmentCategoryValues: ["PLANO", "ESPECIFICACION", "CONTRATO", "MEMORIA", "FOTO", "OTRO"] as const,
}));

import { DELETE, GET, POST } from "@/app/api/projects/[id]/attachments/route";

function createStoredFile() {
  return {
    fileName: "plano.pdf",
    fileType: "application/pdf",
    fileSize: 1024000,
    filePath: "/uploads/project-attachments/proj-1/plano.pdf",
  };
}

// Use string dates to match JSON serialization (NextResponse.json serializes Dates to ISO strings)
function createAttachmentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    fileName: "plano.pdf",
    fileType: "application/pdf",
    fileSize: 1024000,
    filePath: "/uploads/project-attachments/proj-1/plano.pdf",
    category: "PLANO",
    createdAt: "2026-07-12T00:00:00.000Z",
    user: { name: "Maria Lopez" },
    ...overrides,
  };
}

describe("attachments API route", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset?.());
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
  });

  describe("GET /api/projects/[id]/attachments", () => {
    it("returns 401 when not authenticated", async () => {
      mocks.getAuthSession.mockResolvedValue(null);

      const response = await GET(new Request("http://localhost/api/projects/proj-1/attachments"), {
        params: Promise.resolve({ id: "proj-1" }),
      });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "No autenticado" });
    });

    it("returns 401 when session has no user id", async () => {
      mocks.getAuthSession.mockResolvedValue({ user: null });

      const response = await GET(new Request("http://localhost/api/projects/proj-1/attachments"), {
        params: Promise.resolve({ id: "proj-1" }),
      });

      expect(response.status).toBe(401);
    });

    it("returns 404 when project is not found", async () => {
      mocks.projectFindFirst.mockResolvedValue(null);

      const response = await GET(new Request("http://localhost/api/projects/proj-1/attachments"), {
        params: Promise.resolve({ id: "proj-1" }),
      });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Proyecto no encontrado" });
    });

    it("returns attachments ordered by createdAt desc", async () => {
      mocks.projectFindFirst.mockResolvedValue({ id: "proj-1", companyId: "company-1" });
      const attachments = [
        createAttachmentRecord({ id: "att-2", fileName: "b.pdf", createdAt: "2026-07-10T00:00:00.000Z" }),
        createAttachmentRecord({ id: "att-1", fileName: "a.pdf", createdAt: "2026-07-05T00:00:00.000Z" }),
      ];
      mocks.projectAttachmentFindMany.mockResolvedValue(attachments);

      const response = await GET(new Request("http://localhost/api/projects/proj-1/attachments"), {
        params: Promise.resolve({ id: "proj-1" }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(attachments);
      expect(mocks.projectAttachmentFindMany).toHaveBeenCalledWith({
        where: { projectId: "proj-1" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          filePath: true,
          category: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      });
    });

    it("returns empty array when project has no attachments", async () => {
      mocks.projectFindFirst.mockResolvedValue({ id: "proj-1", companyId: "company-1" });
      mocks.projectAttachmentFindMany.mockResolvedValue([]);

      const response = await GET(new Request("http://localhost/api/projects/proj-1/attachments"), {
        params: Promise.resolve({ id: "proj-1" }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([]);
    });
  });

  describe("POST /api/projects/[id]/attachments", () => {
    function createFormData(file?: File, category?: string) {
      const fd = new FormData();
      if (file) fd.set("file", file);
      if (category) fd.set("category", category);
      return fd;
    }

    it("returns 401 when not authenticated", async () => {
      mocks.getAuthSession.mockResolvedValue(null);

      const response = await POST(
        new Request("http://localhost/api/projects/proj-1/attachments", {
          method: "POST",
          body: createFormData(new File(["a"], "a.pdf", { type: "application/pdf" })),
        }),
        { params: Promise.resolve({ id: "proj-1" }) },
      );

      expect(response.status).toBe(401);
    });

    it("returns 404 when project is not found", async () => {
      mocks.projectFindFirst.mockResolvedValue(null);

      const response = await POST(
        new Request("http://localhost/api/projects/proj-1/attachments", {
          method: "POST",
          body: createFormData(new File(["a"], "a.pdf", { type: "application/pdf" })),
        }),
        { params: Promise.resolve({ id: "proj-1" }) },
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Proyecto no encontrado" });
    });

    it("returns 400 when no file is provided", async () => {
      mocks.projectFindFirst.mockResolvedValue({ id: "proj-1", companyId: "company-1" });

      const response = await POST(
        new Request("http://localhost/api/projects/proj-1/attachments", {
          method: "POST",
          body: createFormData(), // no file
        }),
        { params: Promise.resolve({ id: "proj-1" }) },
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "Archivo requerido" });
    });

    it("uploads a file and returns the created attachment", async () => {
      mocks.projectFindFirst.mockResolvedValue({ id: "proj-1", companyId: "company-1" });
      mocks.storeProjectAttachment.mockResolvedValue(createStoredFile());
      mocks.projectAttachmentCreate.mockResolvedValue(createAttachmentRecord());

      const file = new File(["content"], "plano.pdf", { type: "application/pdf" });
      const response = await POST(
        new Request("http://localhost/api/projects/proj-1/attachments", {
          method: "POST",
          body: createFormData(file, "PLANO"),
        }),
        { params: Promise.resolve({ id: "proj-1" }) },
      );

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual(createAttachmentRecord());
      expect(mocks.storeProjectAttachment).toHaveBeenCalledWith("proj-1", expect.any(File));
      expect(mocks.projectAttachmentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: "proj-1",
          fileName: "plano.pdf",
          fileType: "application/pdf",
          fileSize: 1024000,
          category: "PLANO",
          userId: "user-1",
        }),
      });
      expect(mocks.assertWorkspaceMembership).toHaveBeenCalledWith({
        userId: "user-1",
        companyId: "company-1",
        minimumRole: "EDITOR",
      });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects/proj-1");
    });

    it("defaults category to OTRO when not provided", async () => {
      mocks.projectFindFirst.mockResolvedValue({ id: "proj-1", companyId: "company-1" });
      mocks.storeProjectAttachment.mockResolvedValue(createStoredFile());
      mocks.projectAttachmentCreate.mockResolvedValue(createAttachmentRecord({ category: "OTRO" }));

      const file = new File(["content"], "plano.pdf", { type: "application/pdf" });
      const response = await POST(
        new Request("http://localhost/api/projects/proj-1/attachments", {
          method: "POST",
          body: createFormData(file), // no category
        }),
        { params: Promise.resolve({ id: "proj-1" }) },
      );

      expect(response.status).toBe(201);
      expect(mocks.projectAttachmentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ category: "OTRO" }),
      });
    });

    it("returns 400 when category is invalid", async () => {
      mocks.projectFindFirst.mockResolvedValue({ id: "proj-1", companyId: "company-1" });

      const file = new File(["content"], "plano.pdf", { type: "application/pdf" });
      const response = await POST(
        new Request("http://localhost/api/projects/proj-1/attachments", {
          method: "POST",
          body: createFormData(file, "INVALID_CATEGORY"),
        }),
        { params: Promise.resolve({ id: "proj-1" }) },
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "Categoría inválida" });
    });

    it("returns 400 when workspace membership check fails", async () => {
      mocks.projectFindFirst.mockResolvedValue({ id: "proj-1", companyId: "company-1" });
      mocks.assertWorkspaceMembership.mockRejectedValue(new Error("No tienes permisos"));

      const file = new File(["content"], "plano.pdf", { type: "application/pdf" });
      const response = await POST(
        new Request("http://localhost/api/projects/proj-1/attachments", {
          method: "POST",
          body: createFormData(file),
        }),
        { params: Promise.resolve({ id: "proj-1" }) },
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "No tienes permisos" });
    });
  });

  describe("DELETE /api/projects/[id]/attachments", () => {
    function createDeleteRequest(attachmentId: string) {
      return new Request("http://localhost/api/projects/proj-1/attachments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentId }),
      });
    }

    it("returns 401 when not authenticated", async () => {
      mocks.getAuthSession.mockResolvedValue(null);

      const response = await DELETE(createDeleteRequest("att-1"), {
        params: Promise.resolve({ id: "proj-1" }),
      });

      expect(response.status).toBe(401);
    });

    it("returns 404 when project is not found", async () => {
      mocks.projectFindFirst.mockResolvedValue(null);

      const response = await DELETE(createDeleteRequest("att-1"), {
        params: Promise.resolve({ id: "proj-1" }),
      });

      expect(response.status).toBe(404);
    });

    it("returns 400 when attachmentId is missing", async () => {
      mocks.projectFindFirst.mockResolvedValue({ id: "proj-1", companyId: "company-1" });

      const response = await DELETE(
        new Request("http://localhost/api/projects/proj-1/attachments", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ id: "proj-1" }) },
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "ID de archivo requerido" });
    });

    it("returns 400 when workspace membership check fails", async () => {
      mocks.projectFindFirst.mockResolvedValue({ id: "proj-1", companyId: "company-1" });
      mocks.assertWorkspaceMembership.mockRejectedValue(new Error("No tienes permisos"));

      const response = await DELETE(createDeleteRequest("att-1"), {
        params: Promise.resolve({ id: "proj-1" }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "No tienes permisos" });
    });

    it("returns 404 when attachment is not found", async () => {
      mocks.projectFindFirst.mockResolvedValue({ id: "proj-1", companyId: "company-1" });
      mocks.projectAttachmentFindFirst.mockResolvedValue(null);

      const response = await DELETE(createDeleteRequest("att-nonexistent"), {
        params: Promise.resolve({ id: "proj-1" }),
      });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Archivo no encontrado" });
    });

    it("deletes the attachment and file on success", async () => {
      mocks.projectFindFirst.mockResolvedValue({ id: "proj-1", companyId: "company-1" });
      mocks.projectAttachmentFindFirst.mockResolvedValue({
        id: "att-1",
        filePath: "/uploads/project-attachments/proj-1/plano.pdf",
      });
      mocks.projectAttachmentDelete.mockResolvedValue({ id: "att-1" });
      mocks.deleteStoredAttachment.mockResolvedValue(undefined);

      const response = await DELETE(createDeleteRequest("att-1"), {
        params: Promise.resolve({ id: "proj-1" }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
      expect(mocks.projectAttachmentDelete).toHaveBeenCalledWith({ where: { id: "att-1" } });
      expect(mocks.deleteStoredAttachment).toHaveBeenCalledWith("/uploads/project-attachments/proj-1/plano.pdf");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects/proj-1");
      expect(mocks.assertWorkspaceMembership).toHaveBeenCalledWith({
        userId: "user-1",
        companyId: "company-1",
        minimumRole: "EDITOR",
      });
    });

    it("deletes DB record even if file deletion fails (orphan file on disk)", async () => {
      mocks.projectFindFirst.mockResolvedValue({ id: "proj-1", companyId: "company-1" });
      mocks.projectAttachmentFindFirst.mockResolvedValue({
        id: "att-1",
        filePath: "/uploads/project-attachments/proj-1/plano.pdf",
      });
      mocks.projectAttachmentDelete.mockResolvedValue({ id: "att-1" });
      mocks.deleteStoredAttachment.mockRejectedValue(new Error("File not found on disk"));

      const response = await DELETE(createDeleteRequest("att-1"), {
        params: Promise.resolve({ id: "proj-1" }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "File not found on disk" });
    });
  });
});
