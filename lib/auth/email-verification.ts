import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { assignAutomaticBetaForUser } from "@/lib/beta/assignments";

const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;
const RESEND_API_URL = "https://api.resend.com/emails";

export const UNVERIFIED_EMAIL_ERROR = "UNVERIFIED_EMAIL";

type VerificationLookupRow = {
  userId: string;
  expiresAt: Date;
  emailVerifiedAt: Date | null;
};

type ResendLookupRow = {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
};

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildEmailVerificationUrl(token: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  return `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
}

export async function issueEmailVerification(params: { userId: string; email: string; name: string }) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashEmailVerificationToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM "email_verification_tokens"
      WHERE "userId" = ${params.userId}
    `;

    await tx.$executeRaw`
      INSERT INTO "email_verification_tokens" ("id", "userId", "tokenHash", "expiresAt")
      VALUES (${randomUUID()}, ${params.userId}, ${tokenHash}, ${expiresAt})
    `;
  });

  const verificationUrl = buildEmailVerificationUrl(token);
  await sendVerificationEmail({
    email: params.email,
    name: params.name,
    verificationUrl,
  });

  return {
    sent: true,
    verificationUrl,
    expiresAt,
  };
}

export async function consumeEmailVerificationToken(token: string) {
  const tokenHash = hashEmailVerificationToken(token);
  const rows = await prisma.$queryRaw<Array<VerificationLookupRow>>`
    SELECT evt."userId", evt."expiresAt", u."emailVerifiedAt"
    FROM "email_verification_tokens" evt
    INNER JOIN "User" u ON u."id" = evt."userId"
    WHERE evt."tokenHash" = ${tokenHash}
    LIMIT 1
  `;

  const match = rows[0];

  if (!match) {
    return { status: "invalid" as const };
  }

  if (match.emailVerifiedAt) {
    await prisma.$executeRaw`
      DELETE FROM "email_verification_tokens"
      WHERE "userId" = ${match.userId}
    `;

    return { status: "already_verified" as const };
  }

  if (match.expiresAt.getTime() < Date.now()) {
    await prisma.$executeRaw`
      DELETE FROM "email_verification_tokens"
      WHERE "userId" = ${match.userId}
    `;

    return { status: "expired" as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "User"
      SET "emailVerifiedAt" = NOW()
      WHERE "id" = ${match.userId}
    `;

    await tx.$executeRaw`
      DELETE FROM "email_verification_tokens"
      WHERE "userId" = ${match.userId}
    `;
  });

  void assignAutomaticBetaForUser(match.userId).catch(() => undefined);

  return { status: "verified" as const };
}

export async function resendEmailVerification(email: string) {
  const rows = await prisma.$queryRaw<Array<ResendLookupRow>>`
    SELECT "id", "name", "email", "passwordHash", "emailVerifiedAt"
    FROM "User"
    WHERE "email" = ${email}
    LIMIT 1
  `;

  const user = rows[0];

  if (!user || !user.passwordHash || user.emailVerifiedAt) {
    return { sent: false as const };
  }

  await issueEmailVerification({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  return { sent: true as const };
}

async function sendVerificationEmail(params: { email: string; name: string; verificationUrl: string }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (!resendApiKey || !emailFrom) {
    console.log(`[auth] Verification email for ${params.email}: ${params.verificationUrl}`);
    return;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [params.email],
      subject: "Verifica tu correo en MC Presupuestos",
      html: [
        `<p>Hola ${escapeHtml(params.name)},</p>`,
        "<p>Confirma tu correo para activar tu cuenta de MC Presupuestos.</p>",
        `<p><a href="${params.verificationUrl}">Verificar correo</a></p>`,
      ].join(""),
    }),
  });

  if (!response.ok) {
    throw new Error("No se pudo enviar el correo de verificacion.");
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
