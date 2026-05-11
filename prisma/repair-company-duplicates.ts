import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    orderBy: [{ userId: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      userId: true,
      name: true,
      ruc: true,
      createdAt: true,
    },
  });

  const duplicates = buildDuplicateGroups(companies);

  if (duplicates.length === 0) {
    console.log("No se encontraron empresas duplicadas para reparar.");
    return;
  }

  for (const group of duplicates) {
    const [primary, ...duplicatesToMerge] = group;
    console.log(
      `Fusionando ${duplicatesToMerge.length} empresa(s) duplicada(s) en ${primary.name} (${primary.id}) para el usuario ${primary.userId}.`,
    );

    for (const duplicate of duplicatesToMerge) {
      await prisma.$transaction(async (tx) => {
        await tx.project.updateMany({
          where: { companyId: duplicate.id },
          data: { companyId: primary.id },
        });

        await tx.resource.updateMany({
          where: { companyId: duplicate.id },
          data: { companyId: primary.id },
        });

        await tx.company.delete({
          where: { id: duplicate.id },
        });
      });
    }
  }
}

type CompanyRecord = {
  id: string;
  userId: string;
  name: string;
  ruc: string | null;
  createdAt: Date;
};

function buildDuplicateGroups(companies: CompanyRecord[]) {
  const companiesByUser = new Map<string, CompanyRecord[]>();

  for (const company of companies) {
    const userCompanies = companiesByUser.get(company.userId) ?? [];
    userCompanies.push(company);
    companiesByUser.set(company.userId, userCompanies);
  }

  const groups: CompanyRecord[][] = [];

  for (const userCompanies of companiesByUser.values()) {
    const visited = new Set<string>();

    for (const company of userCompanies) {
      if (visited.has(company.id)) continue;

      const duplicates = userCompanies.filter((candidate) => {
        if (candidate.id === company.id) return false;
        return isDuplicateCompany(company, candidate);
      });

      if (duplicates.length === 0) continue;

      const group = [company, ...duplicates].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
      for (const entry of group) {
        visited.add(entry.id);
      }
      groups.push(group);
    }
  }

  return groups;
}

function isDuplicateCompany(left: CompanyRecord, right: CompanyRecord) {
  const sameRuc = left.ruc && right.ruc && left.ruc.trim() === right.ruc.trim();
  const sameNormalizedName = normalizeCompanyName(left.name) === normalizeCompanyName(right.name);
  return Boolean(sameRuc || sameNormalizedName);
}

function normalizeCompanyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
