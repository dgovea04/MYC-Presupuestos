import { prisma } from "@/lib/db/prisma";

/**
 * Creates a new user with company and starter membership in a single transaction.
 * Used by both the register API route and the Google OAuth signIn flow.
 */
export async function registerUserWithCompany(params: {
  name: string;
  email: string;
  passwordHash?: string;
  avatarUrl?: string;
  companyName?: string;
  ruc?: string;
}) {
  const { name, email, passwordHash, avatarUrl, companyName, ruc } = params;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash: (passwordHash ?? null) as string | null,
        avatarUrl: avatarUrl ?? null,
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
        name: companyName ?? `${name}'s Company`,
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
