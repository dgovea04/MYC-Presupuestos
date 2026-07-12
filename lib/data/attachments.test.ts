import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projectAttachmentFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    projectAttachment: {
      findMany: mocks.projectAttachmentFindMany,
    },
  },
}));

import { getProjectAttachments } from "@/lib/data/attachments";

describe("getProjectAttachments", () => {
  beforeEach(() => {
    mocks.projectAttachmentFindMany.mockReset();
  });

  it("returns attachments ordered by createdAt desc for a given project", async () => {
    const attachments = [
      {
        id: "att-2",
        fileName: "plano-estructural.pdf",
        fileType: "application/pdf",
        fileSize: 2048000,
        filePath: "/uploads/project-attachments/proj-1/plano-estructural.pdf",
        category: "PLANO",
        createdAt: new Date("2026-07-10T00:00:00.000Z"),
        user: { name: "Maria Lopez" },
      },
      {
        id: "att-1",
        fileName: "especificaciones.docx",
        fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: 512000,
        filePath: "/uploads/project-attachments/proj-1/especificaciones.docx",
        category: "ESPECIFICACION",
        createdAt: new Date("2026-07-05T00:00:00.000Z"),
        user: { name: "Juan Perez" },
      },
    ];

    mocks.projectAttachmentFindMany.mockResolvedValue(attachments);

    const result = await getProjectAttachments("proj-1");

    expect(mocks.projectAttachmentFindMany).toHaveBeenCalledTimes(1);
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
    expect(result).toEqual(attachments);
    expect(result).toHaveLength(2);
    // Most recent first
    expect(result[0]!.id).toBe("att-2");
    expect(result[1]!.id).toBe("att-1");
  });

  it("returns empty array when project has no attachments", async () => {
    mocks.projectAttachmentFindMany.mockResolvedValue([]);

    const result = await getProjectAttachments("proj-empty");

    expect(mocks.projectAttachmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: "proj-empty" } }),
    );
    expect(result).toEqual([]);
  });

  it("includes the user name in the select", async () => {
    mocks.projectAttachmentFindMany.mockResolvedValue([
      {
        id: "att-1",
        fileName: "contrato.pdf",
        fileType: "application/pdf",
        fileSize: 1024000,
        filePath: "/uploads/project-attachments/proj-1/contrato.pdf",
        category: "CONTRATO",
        createdAt: new Date("2026-07-12T00:00:00.000Z"),
        user: { name: "Admin MYC" },
      },
    ]);

    const result = await getProjectAttachments("proj-1");

    expect(result[0]!.user).toEqual({ name: "Admin MYC" });
  });

});
