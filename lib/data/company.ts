import { prisma } from "@/lib/db/prisma";
import { companySchema, type CompanyInput } from "@/lib/validations/company";

export async function upsertPrimaryCompany(userId: string, input: CompanyInput) {
  const data = companySchema.parse(input);

  const existingCompany = await prisma.company.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (existingCompany) {
    return prisma.company.update({
      where: { id: existingCompany.id },
      data: {
        name: data.name,
        ruc: data.ruc ?? null,
      },
    });
  }

  return prisma.company.create({
    data: {
      userId,
      name: data.name,
      ruc: data.ruc ?? null,
    },
  });
}
