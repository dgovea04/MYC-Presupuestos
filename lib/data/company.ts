import { prisma } from "@/lib/db/prisma";
import { companySchema, type CompanyInput } from "@/lib/validations/company";

export async function upsertPrimaryCompany(userId: string, input: CompanyInput) {
  const data = companySchema.parse(input);

  const existingMembership = await prisma.companyMembership.findFirst({
    where: { userId, role: "OWNER", status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    select: { companyId: true },
  });

  if (existingMembership) {
    return prisma.company.update({
      where: { id: existingMembership.companyId },
      data: {
        name: data.name,
        ruc: data.ruc ?? null,
      },
    });
  }

  // Legacy fallback: user may have a Company.userId record but no OWNER membership
  const legacyCompany = await prisma.company.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (legacyCompany) {
    await prisma.companyMembership.upsert({
      where: {
        companyId_userId: {
          companyId: legacyCompany.id,
          userId,
        },
      },
      update: {
        role: "OWNER",
        status: "ACTIVE",
        suspendedUntil: null,
      },
      create: {
        companyId: legacyCompany.id,
        userId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    return prisma.company.update({
      where: { id: legacyCompany.id },
      data: {
        name: data.name,
        ruc: data.ruc ?? null,
      },
    });
  }

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        userId,
        name: data.name,
        ruc: data.ruc ?? null,
      },
    });

    await tx.companyMembership.create({
      data: {
        companyId: company.id,
        userId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    return company;
  });
}

export async function getPrimaryCompany(userId: string) {
  const membership = await prisma.companyMembership.findFirst({
    where: { userId, role: "OWNER", status: "ACTIVE" },
    orderBy: { joinedAt: "asc" },
    include: { company: true },
  });

  if (membership) return membership.company;

  // Legacy fallback for users without an OWNER membership
  return prisma.company.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function updatePrimaryCompanyLogo(userId: string, logoUrl: string) {
  const company = await getPrimaryCompany(userId);

  if (!company) {
    throw new Error("Empresa no encontrada.");
  }

  return prisma.company.update({
    where: { id: company.id },
    data: { logoUrl },
  });
}

export async function clearPrimaryCompanyLogo(userId: string) {
  const company = await getPrimaryCompany(userId);

  if (!company) {
    throw new Error("Empresa no encontrada.");
  }

  return prisma.company.update({
    where: { id: company.id },
    data: { logoUrl: null },
  });
}
