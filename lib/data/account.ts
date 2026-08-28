import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getUserProfileColumnSupport } from "@/lib/data/user-profile-columns";
import { accountPasswordSchema, accountProfileSchema, type AccountPasswordInput, type AccountProfileInput } from "@/lib/validations/account";
import { getCurrentAiUsagePeriod } from "@/lib/ai/usage";
import { getEffectiveWorkspaceLicense } from "@/lib/workspace/entitlements";
import { ensureDate } from "@/lib/utils";
import type { AccountMembershipRecord, AccountRecord } from "@/types/account";
import { z } from "zod";

export class AccountCurrentPasswordError extends Error {
  constructor() {
    super("La contrasena actual no es correcta.");
  }
}

function toAccountRecord(account: {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  phone: string | null;
  jobTitle: string | null;
  bio: string | null;
  createdAt: Date;
}): AccountRecord {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    avatarUrl: account.avatarUrl,
    phone: account.phone ?? "",
    jobTitle: account.jobTitle ?? "",
    bio: account.bio ?? "",
    createdAt: ensureDate(account.createdAt).toISOString(),
  };
}

const accountRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  createdAt: z.date(),
});

const passwordRowSchema = z.object({
  passwordHash: z.string(),
});

async function readSingleRow<T>(queryPromise: Promise<Array<unknown>>, schema: z.ZodSchema<T>, notFoundMessage: string): Promise<T> {
  const rows = await queryPromise;
  const row = rows[0];
  const parsedRow = schema.safeParse(row);

  if (!parsedRow.success) {
    throw new Error(notFoundMessage);
  }

  return parsedRow.data;
}

function normalizeAccountRow(row: unknown) {
  const parsedRow = accountRowSchema.safeParse(row);

  if (!parsedRow.success) {
    throw new Error("Usuario no encontrado.");
  }

  return {
    ...parsedRow.data,
    avatarUrl: parsedRow.data.avatarUrl ?? null,
    phone: parsedRow.data.phone ?? null,
    jobTitle: parsedRow.data.jobTitle ?? null,
    bio: parsedRow.data.bio ?? null,
  };
}

export async function getUserAccount(userId: string): Promise<AccountRecord> {
  const profileColumns = await getUserProfileColumnSupport();
  const rows = await prisma.$queryRaw<Array<unknown>>`
    SELECT "id", "name", "email"
    ${profileColumns.avatarUrl ? Prisma.sql`, "avatarUrl"` : Prisma.empty}
    ${profileColumns.phone ? Prisma.sql`, "phone"` : Prisma.empty}
    ${profileColumns.jobTitle ? Prisma.sql`, "jobTitle"` : Prisma.empty}
    ${profileColumns.bio ? Prisma.sql`, "bio"` : Prisma.empty}
    , "createdAt"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;
  const account = normalizeAccountRow(rows[0]);

  return toAccountRecord(account);
}

export async function getUserAccountMembership(userId: string, activeCompanyId?: string | null): Promise<AccountMembershipRecord> {
  const periodStart = getCurrentAiUsagePeriod();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      aiTokenExtraMonthly: true,
      membershipPlan: {
        select: {
          name: true,
          slug: true,
          monthlyTokenLimit: true,
        },
      },
      billingSubscriptions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          provider: true,
          status: true,
          stripeCustomerId: true,
          currentPeriodEnd: true,
          pastDueStartedAt: true,
        },
      },
      aiUsagePeriods: {
        where: { periodStart },
        select: {
          consumedTokens: true,
          reservedTokens: true,
        },
        take: 1,
      },
      aiTokenLedger: {
        where: { periodStart, type: "CONSUME" },
        select: { tokens: true, billingScope: true },
      },
    },
  });

  if (!user) {
    throw new Error("Usuario no encontrado.");
  }

  const license = await getEffectiveWorkspaceLicense({ userId, companyId: activeCompanyId });
  const monthlyTokenLimit = license?.monthlyTokenLimit ?? user.membershipPlan?.monthlyTokenLimit ?? 0;
  const extraTokens = user.aiTokenExtraMonthly;
  // El ledger es la fuente de verdad: también incluye consumos facturados
  // a la plataforma, que no generan una fila en AiUsagePeriod.
  const platformConsumedTokens = user.aiTokenLedger.filter((entry) => entry.billingScope === "PLATFORM").reduce((total, entry) => total + entry.tokens, 0);
  const workspaceConsumedTokens = user.aiTokenLedger.filter((entry) => entry.billingScope === "WORKSPACE").reduce((total, entry) => total + entry.tokens, 0);
  const userConsumedTokens = user.aiTokenLedger.filter((entry) => entry.billingScope === "USER").reduce((total, entry) => total + entry.tokens, 0);
  const consumedTokens = platformConsumedTokens;
  const reservedTokens = user.aiUsagePeriods[0]?.reservedTokens ?? 0;
  const allowance = Math.max(0, license?.betaAiTokenLimit ?? monthlyTokenLimit + extraTokens);
  const effectivePlanSlug = normalizePlanSlug(license?.planSlug ?? user.membershipPlan?.slug);
  const billingSubscription = user.billingSubscriptions[0] ?? null;
  const graceEndsAt =
    billingSubscription?.status === "PAST_DUE" && billingSubscription.pastDueStartedAt
      ? new Date(ensureDate(billingSubscription.pastDueStartedAt).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  return {
    planName: license?.planName ?? user.membershipPlan?.name ?? "Sin membresia",
    planSlug: license?.planSlug ?? user.membershipPlan?.slug ?? "",
    effectivePlanSlug,
    billingProvider: billingSubscription?.provider ?? null,
    billingStatus: billingSubscription?.status ?? null,
    currentPeriodEnd: billingSubscription?.currentPeriodEnd ? ensureDate(billingSubscription.currentPeriodEnd).toISOString() : null,
    graceEndsAt,
    canManageBilling: Boolean(billingSubscription?.stripeCustomerId),
    canUpgrade: effectivePlanSlug === "starter" || license?.accessSource === "BETA",
    accessSource: normalizeAccessSource(license?.accessSource),
    betaGrantId: license?.betaGrantId ?? null,
    betaCampaignName: license?.betaCampaignName ?? null,
    betaExpiresAt: license?.betaExpiresAt ?? null,
    betaDaysRemaining: license?.betaExpiresAt
      ? Math.max(1, Math.ceil((new Date(license.betaExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null,
    betaAiTokenLimit: license?.betaAiTokenLimit ?? null,
    monthlyTokenLimit,
    extraTokens,
    consumedTokens,
    platformConsumedTokens,
    workspaceConsumedTokens,
    userConsumedTokens,
    reservedTokens,
    allowance,
    availableTokens: Math.max(0, allowance - consumedTokens - reservedTokens),
  };
}

function normalizeAccessSource(source?: string): "PLAN" | "COMPANY_SUBSCRIPTION" | "BETA" | "STRIPE" {
  if (source === "BETA" || source === "COMPANY_SUBSCRIPTION" || source === "STRIPE") {
    return source;
  }

  return "PLAN";
}

function normalizePlanSlug(slug?: string | null): "starter" | "pro" | "empresa" {
  return slug === "pro" || slug === "empresa" ? slug : "starter";
}

export async function updateUserAccountProfile(userId: string, input: AccountProfileInput): Promise<AccountRecord> {
  const data = accountProfileSchema.parse(input);
  const profileColumns = await getUserProfileColumnSupport();
  const rows = await prisma.$queryRaw<Array<unknown>>`
    UPDATE "User"
    SET
      "name" = ${data.name},
      ${profileColumns.phone ? Prisma.sql`"phone" = ${data.phone.length > 0 ? data.phone : null},` : Prisma.empty}
      ${profileColumns.jobTitle ? Prisma.sql`"jobTitle" = ${data.jobTitle.length > 0 ? data.jobTitle : null},` : Prisma.empty}
      ${profileColumns.bio ? Prisma.sql`"bio" = ${data.bio.length > 0 ? data.bio : null},` : Prisma.empty}
      "updatedAt" = NOW()
    WHERE "id" = ${userId}
    RETURNING "id", "name", "email"
    ${profileColumns.avatarUrl ? Prisma.sql`, "avatarUrl"` : Prisma.empty}
    ${profileColumns.phone ? Prisma.sql`, "phone"` : Prisma.empty}
    ${profileColumns.jobTitle ? Prisma.sql`, "jobTitle"` : Prisma.empty}
    ${profileColumns.bio ? Prisma.sql`, "bio"` : Prisma.empty}
    , "createdAt"
  `;
  const account = normalizeAccountRow(rows[0]);

  return toAccountRecord(account);
}

export async function updateUserAccountAvatar(userId: string, avatarUrl: string): Promise<AccountRecord> {
  const profileColumns = await getUserProfileColumnSupport();

  if (!profileColumns.avatarUrl) {
    throw new Error("El avatar no esta disponible en la base de datos actual.");
  }

  const rows = await prisma.$queryRaw<Array<unknown>>`
    UPDATE "User"
    SET "avatarUrl" = ${avatarUrl}, "updatedAt" = NOW()
    WHERE "id" = ${userId}
    RETURNING "id", "name", "email", "avatarUrl"
    ${profileColumns.phone ? Prisma.sql`, "phone"` : Prisma.empty}
    ${profileColumns.jobTitle ? Prisma.sql`, "jobTitle"` : Prisma.empty}
    ${profileColumns.bio ? Prisma.sql`, "bio"` : Prisma.empty}
    , "createdAt"
  `;
  const account = normalizeAccountRow(rows[0]);

  return toAccountRecord(account);
}

export async function clearUserAvatar(userId: string): Promise<AccountRecord> {
  const profileColumns = await getUserProfileColumnSupport();

  if (!profileColumns.avatarUrl) {
    throw new Error("El avatar no esta disponible en la base de datos actual.");
  }

  const rows = await prisma.$queryRaw<Array<unknown>>`
    UPDATE "User"
    SET "avatarUrl" = NULL, "updatedAt" = NOW()
    WHERE "id" = ${userId}
    RETURNING "id", "name", "email", "avatarUrl"
    ${profileColumns.phone ? Prisma.sql`, "phone"` : Prisma.empty}
    ${profileColumns.jobTitle ? Prisma.sql`, "jobTitle"` : Prisma.empty}
    ${profileColumns.bio ? Prisma.sql`, "bio"` : Prisma.empty}
    , "createdAt"
  `;
  const account = normalizeAccountRow(rows[0]);

  return toAccountRecord(account);
}

export async function updateUserPassword(userId: string, input: AccountPasswordInput): Promise<void> {
  const data = accountPasswordSchema.parse(input);
  const user = await readSingleRow(
    prisma.$queryRaw<Array<unknown>>`
      SELECT "passwordHash"
      FROM "User"
      WHERE "id" = ${userId}
      LIMIT 1
    `,
    passwordRowSchema,
    "Usuario no encontrado.",
  );

  const isCurrentPasswordValid = await verifyPassword(data.currentPassword, user.passwordHash);

  if (!isCurrentPasswordValid) {
    throw new AccountCurrentPasswordError();
  }

  await prisma.$queryRaw<Array<unknown>>`
    UPDATE "User"
    SET "passwordHash" = ${await hashPassword(data.newPassword)}, "passwordChangedAt" = NOW(), "sessionVersion" = "sessionVersion" + 1, "updatedAt" = NOW()
    WHERE "id" = ${userId}
  `;
}
