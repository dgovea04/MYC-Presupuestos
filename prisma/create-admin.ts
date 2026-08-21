import { createPrismaClient } from "@/lib/db/prisma-client";
import { hashPassword } from "@/lib/auth/password";

const prisma = createPrismaClient(["warn", "error"]);
const PRIMARY_ADMIN_EMAIL = "dgovea04@gmail.com";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const email = requiredEnv("ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("ADMIN_PASSWORD");
  const name = process.env.ADMIN_NAME?.trim() || "Administrador MC";
  const companyName = process.env.ADMIN_COMPANY_NAME?.trim() || "MYC Presupuestos";
  const ruc = process.env.ADMIN_COMPANY_RUC?.trim() || null;
  const verifiedAt = new Date();
  const passwordHash = await hashPassword(password);

  const empresaPlan = await prisma.membershipPlan.upsert({
    where: { slug: "empresa" },
    update: {},
    create: {
      name: "Empresa",
      slug: "empresa",
      monthlyTokenLimit: 1000000,
      seatLimit: null,
      billingMode: "MANUAL",
      projectLimit: null,
      budgetLimit: null,
      entitlements: [
        "ai.local",
        "khipu.agent",
        "partidas.similarity",
        "metrados.advanced",
        "templates.budget",
        "work_schedule.intelligent",
        "polynomial_formula",
        "polynomial_formula.adjustments",
        "risk_analysis",
        "exports.advanced",
        "exports.basic",
      ],
    },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: verifiedAt,
      membershipPlanId: empresaPlan.id,
    },
    create: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: verifiedAt,
      membershipPlanId: empresaPlan.id,
    },
  });

  await prisma.$executeRaw`
    UPDATE "User"
    SET "isSuperAdmin" = ${email === PRIMARY_ADMIN_EMAIL},
        "adminProfile" = ${email === PRIMARY_ADMIN_EMAIL ? "SUPER_ADMIN" : "ADMIN"}::"AdminProfile"
    WHERE "id" = ${user.id}
  `;

  const existingCompany = await prisma.company.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const company =
    existingCompany ??
    (await prisma.company.create({
      data: {
        userId: user.id,
        name: companyName,
        ruc,
      },
    }));

  await prisma.companyMembership.upsert({
    where: { companyId_userId: { companyId: company.id, userId: user.id } },
    update: { role: "OWNER", status: "ACTIVE", suspendedUntil: null },
    create: { companyId: company.id, userId: user.id, role: "OWNER", status: "ACTIVE" },
  });

  await prisma.companySubscription.upsert({
    where: { companyId: company.id },
    update: { membershipPlanId: empresaPlan.id, provider: "MANUAL", status: "ACTIVE" },
    create: {
      companyId: company.id,
      membershipPlanId: empresaPlan.id,
      provider: "MANUAL",
      status: "ACTIVE",
    },
  });

  console.info(`Admin user ready: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
