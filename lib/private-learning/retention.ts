import { prisma } from "@/lib/db/prisma";
export async function expirePrivateLearningExamples(now = new Date()): Promise<number> {
  const result = await prisma.privateLearningExample.updateMany({ where: { status: "ACTIVE", expiresAt: { lte: now } }, data: { status: "EXPIRED" } });
  return result.count;
}
