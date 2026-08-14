import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;
const RESEND_API_URL = "https://api.resend.com/emails";

type PasswordResetUser = {
  id: string;
  name: string;
  email: string;
};

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildPasswordResetUrl(token: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function issuePasswordReset(userId: string) {
  const users = await prisma.$queryRaw<Array<PasswordResetUser>>`
    SELECT "id", "name", "email"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;
  const user = users[0];

  if (!user) {
    throw new Error("Usuario no encontrado.");
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM "password_reset_tokens"
      WHERE "userId" = ${user.id}
    `;

    await tx.$executeRaw`
      INSERT INTO "password_reset_tokens" ("id", "userId", "tokenHash", "expiresAt")
      VALUES (${randomUUID()}, ${user.id}, ${tokenHash}, ${expiresAt})
    `;
  });

  const resetUrl = buildPasswordResetUrl(token);
  await sendPasswordResetEmail({
    email: user.email,
    name: user.name,
    resetUrl,
  });

  return { user, expiresAt };
}

export async function consumePasswordResetToken(token: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);

  return prisma.$transaction(async (tx) => {
    const matches = await tx.$queryRaw<Array<{ userId: string }>>`
      DELETE FROM "password_reset_tokens"
      WHERE "tokenHash" = ${hashPasswordResetToken(token)}
        AND "expiresAt" > NOW()
        AND "usedAt" IS NULL
      RETURNING "userId"
    `;
    const match = matches[0];

    if (!match) {
      return { status: "invalid" as const };
    }

    await tx.$executeRaw`
      UPDATE "User"
      SET "passwordHash" = ${passwordHash}, "passwordChangedAt" = NOW(), "sessionVersion" = "sessionVersion" + 1, "updatedAt" = NOW()
      WHERE "id" = ${match.userId}
    `;

    return { status: "updated" as const };
  });
}

async function sendPasswordResetEmail(params: { email: string; name: string; resetUrl: string }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (!resendApiKey || !emailFrom) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("El servicio de correo no esta configurado.");
    }

    console.info(`[auth] Password reset email queued for ${params.email}`);
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
      subject: "Cambia tu contrasena en MC Presupuestos",
      html: [
        `<p>Hola ${escapeHtml(params.name)},</p>`,
        "<p>Un administrador solicito un enlace para que puedas cambiar tu contrasena.</p>",
        `<p><a href="${params.resetUrl}">Cambiar contrasena</a></p>`,
        "<p>Este enlace vence en 30 minutos y solo puede utilizarse una vez.</p>",
        "<p>Si no esperabas este correo, puedes ignorarlo.</p>",
      ].join(""),
    }),
  });

  if (!response.ok) {
    throw new Error("No se pudo enviar el correo para cambiar la contrasena.");
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
