import { prisma } from "@/lib/db/prisma";

function normalizeCompanyNameSource(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDefaultCompanyName(params: { name?: string | null; email?: string | null }) {
  const source = params.name?.trim() || params.email?.split("@")[0]?.trim() || "usuario";
  const normalizedSource = normalizeCompanyNameSource(source) || "usuario";

  return `${normalizedSource}-empresa`;
}

/**
 * Creates a new user with company and starter membership in a single transaction.
 * Used by both the register API route and the Google OAuth signIn flow.
 */
export async function registerUserWithCompany(params: {
  name: string;
  email: string;
  passwordHash?: string;
  avatarUrl?: string;
  emailVerifiedAt?: Date;
  companyName?: string;
  ruc?: string;
}) {
  const { name, email, passwordHash, avatarUrl, emailVerifiedAt, companyName, ruc } = params;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash: (passwordHash ?? null) as string | null,
        avatarUrl: avatarUrl ?? null,
        emailVerifiedAt: emailVerifiedAt ?? null,
        membershipPlan: {
          connectOrCreate: {
            where: { slug: "starter" },
            create: {
              name: "Starter",
              slug: "starter",
              monthlyTokenLimit: 100000,
            },
          },
        },
      },
    });

    const company = await tx.company.create({
      data: {
        userId: user.id,
        name: companyName ?? buildDefaultCompanyName({ name, email }),
        ruc: ruc ?? null,
      },
    });

    await tx.companyMembership.create({
      data: {
        companyId: company.id,
        userId: user.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    return { user, company };
  });
}

export type RegisteredUser = Awaited<ReturnType<typeof registerUserWithCompany>>;

export async function ensureUserHasCompany(userId: string, options?: { name?: string | null; email?: string | null }) {
  const ownedCompanyMembership = await prisma.companyMembership.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      role: "OWNER",
      company: { userId },
    },
    orderBy: { joinedAt: "asc" },
    select: { companyId: true },
  });

  if (ownedCompanyMembership) {
    return ownedCompanyMembership.companyId;
  }

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

    return legacyCompany.id;
  }

  const fallbackName = buildDefaultCompanyName({
    name: options?.name,
    email: options?.email,
  });

  const company = await prisma.company.create({
    data: {
      userId,
      name: fallbackName,
    },
    select: { id: true },
  });

  await prisma.companyMembership.create({
    data: {
      companyId: company.id,
      userId,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  return company.id;
}
