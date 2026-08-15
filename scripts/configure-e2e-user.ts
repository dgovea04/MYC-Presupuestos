import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  ensureUserHasCompany,
  registerUserWithCompanyAndDemo,
} from "@/lib/auth/registration";
import { ensureDemoProjectForCompany } from "@/lib/onboarding/demo-project";

const DEFAULT_EMAIL = "e2e@mycpresupuestos.local";
const DEFAULT_PASSWORD = "E2eLocalTest123!";

function getConfiguration() {
  const email = (process.env.E2E_USER_EMAIL ?? DEFAULT_EMAIL).trim().toLowerCase();
  const password = process.env.E2E_USER_PASSWORD ?? DEFAULT_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E_USER_EMAIL y E2E_USER_PASSWORD no pueden estar vacíos.");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("La configuración del usuario E2E está bloqueada en NODE_ENV=production.");
  }

  return { email, password };
}

async function main() {
  const { email, password } = getConfiguration();
  const passwordHash = await hashPassword(password);
  const verifiedAt = new Date();
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  let userId: string;
  let companyId: string;
  let demoProjectStatus: string;

  if (existingUser) {
    const user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: "Usuario E2E",
        passwordHash,
        emailVerifiedAt: verifiedAt,
        status: "ACTIVE",
        role: "ADMIN",
        isSuperAdmin: false,
        adminProfile: null,
        mfaEnabled: false,
        mfaSecretEncrypted: null,
        sessionVersion: { increment: 1 },
      },
      select: { id: true },
    });

    userId = user.id;
    companyId = await ensureUserHasCompany(userId, {
      name: "Usuario E2E",
      email,
    });

    const demoProject = await ensureDemoProjectForCompany({ userId, companyId });
    demoProjectStatus = demoProject.status;
  } else {
    const registration = await registerUserWithCompanyAndDemo({
      name: "Usuario E2E",
      email,
      passwordHash,
      emailVerifiedAt: verifiedAt,
      companyName: "Constructora E2E",
    });

    userId = registration.user.id;
    companyId = registration.company.id;
    demoProjectStatus = registration.demoProject.status;

    await prisma.user.update({
      where: { id: userId },
      data: {
        role: "ADMIN",
        isSuperAdmin: false,
        adminProfile: null,
      },
    });
  }

  const empresaPlan = await prisma.membershipPlan.findUnique({
    where: { slug: "empresa" },
    select: { id: true },
  });

  if (empresaPlan) {
    await prisma.user.update({
      where: { id: userId },
      data: { membershipPlanId: empresaPlan.id },
    });
  }

  // Rate-limit keys are stored as hashes, so they cannot be filtered by the
  // readable credential-login prefix. This utility is local-only and clears
  // all security buckets to make repeated E2E runs deterministic.
  await prisma.securityRateLimitBucket.deleteMany();

  await prisma.userSettings.updateMany({
    where: { userId },
    data: { defaultViewMode: "modern" },
  });

  const verifiedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, emailVerifiedAt: true, passwordHash: true, mfaEnabled: true },
  });
  const passwordMatches = verifiedUser?.passwordHash
    ? await verifyPassword(password, verifiedUser.passwordHash)
    : false;

  console.info(
    JSON.stringify(
      {
        email,
        userId,
        companyId,
        demoProjectStatus,
        defaultProjectName: "Edificio Multifamiliar - Demo",
        defaultBudgetName: "Arquitectura",
        status: verifiedUser?.status,
        emailVerified: Boolean(verifiedUser?.emailVerifiedAt),
        hasPasswordHash: Boolean(verifiedUser?.passwordHash),
        passwordMatches,
        mfaEnabled: verifiedUser?.mfaEnabled,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
