import { cache } from "react";
import { prisma } from "@/lib/db/prisma";

export const getProjectAttachments = cache(
  async (projectId: string) => {
    return prisma.projectAttachment.findMany({
      where: { projectId },
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
  },
);
