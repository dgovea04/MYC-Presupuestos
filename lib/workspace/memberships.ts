import { prisma } from "@/lib/db/prisma";
import { workspaceMembershipSchema, workspaceMemberUpdateSchema, type WorkspaceMembershipInput } from "@/lib/validations/workspace";
import type { WorkspaceRole } from "@/types/workspace";

export async function listMembers(companyId: string) {
  return prisma.companyMembership.findMany({
    where: { companyId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
}

export async function addWorkspaceMember(input: WorkspaceMembershipInput) {
  const parsed = workspaceMembershipSchema.parse(input);
  return prisma.companyMembership.create({ data: parsed });
}

export async function updateWorkspaceMember(
  companyId: string,
  userId: string,
  role?: WorkspaceRole,
  status?: "ACTIVE" | "INVITED" | "SUSPENDED",
) {
  workspaceMemberUpdateSchema.parse({ role, status });
  return prisma.companyMembership.update({
    where: { companyId_userId: { companyId, userId } },
    data: { role, status },
  });
}

export async function removeWorkspaceMember(companyId: string, userId: string) {
  return prisma.companyMembership.delete({
    where: { companyId_userId: { companyId, userId } },
  });
}
