import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getUserProfileColumnSupport } from "@/lib/data/user-profile-columns";
import { accountPasswordSchema, accountProfileSchema, type AccountPasswordInput, type AccountProfileInput } from "@/lib/validations/account";
import type { AccountRecord } from "@/types/account";
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
    createdAt: account.createdAt.toISOString(),
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
    SET "passwordHash" = ${await hashPassword(data.newPassword)}, "updatedAt" = NOW()
    WHERE "id" = ${userId}
  `;
}
