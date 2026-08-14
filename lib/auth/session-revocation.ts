import { prisma } from "@/lib/db/prisma";

export async function revokeUserSessions(userId: string) {
  const updatedUsers = await prisma.$executeRaw`
    UPDATE "User"
    SET "sessionVersion" = "sessionVersion" + 1, "updatedAt" = NOW()
    WHERE "id" = ${userId}
  `;

  if (updatedUsers === 0) {
    throw new Error("Usuario no encontrado.");
  }
}
