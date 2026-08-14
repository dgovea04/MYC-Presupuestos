import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { decryptApiKey, encryptApiKey } from "@/lib/ai/encryption";

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
const TOTP_SECRET_BYTES = 20;
const RECOVERY_CODE_COUNT = 10;
const MFA_PROOF_MAX_AGE_MS = 10 * 60 * 1000;
const MFA_PROOF_COOKIE_NAME = "myc-presupuestos.admin-mfa";

export const ADMIN_MFA_COOKIE_NAME = MFA_PROOF_COOKIE_NAME;
export const ADMIN_MFA_COOKIE_MAX_AGE_SECONDS = MFA_PROOF_MAX_AGE_MS / 1000;

export type AdminMfaStatus = {
  enabled: boolean;
};

export function generateTotpSecret() {
  return toBase32(randomBytes(TOTP_SECRET_BYTES));
}

export function buildTotpUri(secret: string, email: string) {
  const issuer = "MC Presupuestos";
  const label = `${issuer}:${email}`;
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });

  return `otpauth://totp/${encodeURIComponent(label)}?${query.toString()}`;
}

export function verifyTotpCode(secret: string, code: string, now = Date.now()) {
  const normalizedCode = normalizeTotpCode(code);

  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const currentCounter = Math.floor(now / 1000 / TOTP_STEP_SECONDS);

  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const counter = currentCounter + offset;

    if (counter < 0) {
      continue;
    }

    const expected = generateTotpCode(secret, counter);
    const expectedBuffer = Buffer.from(expected, "utf8");
    const providedBuffer = Buffer.from(normalizedCode, "utf8");

    if (timingSafeEqual(expectedBuffer, providedBuffer)) {
      return true;
    }
  }

  return false;
}

export function normalizeTotpCode(code: string) {
  return code.trim().replace(/\s+/g, "");
}

export function generateRecoveryCodes() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = randomBytes(6).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
  });
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

export async function getAdminMfaStatus(userId: string): Promise<AdminMfaStatus> {
  const rows = await prisma.$queryRaw<Array<{ mfaEnabled: boolean }>>`
    SELECT "mfaEnabled"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;

  return { enabled: rows[0]?.mfaEnabled === true };
}

export async function beginAdminMfaSetup(userId: string, email: string) {
  const secret = generateTotpSecret();
  const encryptedSecret = encryptApiKey(secret);

  const updatedUsers = await prisma.$executeRaw`
    UPDATE "User"
    SET "mfaSecretEncrypted" = ${encryptedSecret}, "mfaEnabled" = false, "updatedAt" = NOW()
    WHERE "id" = ${userId} AND "isSuperAdmin" = true
  `;

  if (updatedUsers === 0) {
    throw new Error("Solo el administrador principal puede configurar MFA.");
  }

  await prisma.$executeRaw`
    DELETE FROM "admin_mfa_recovery_codes"
    WHERE "userId" = ${userId}
  `;

  return {
    secret,
    otpauthUri: buildTotpUri(secret, email),
  };
}

export async function activateAdminMfa(userId: string, code: string) {
  const secret = await getStoredMfaSecret(userId);

  if (!secret || !verifyTotpCode(secret, code)) {
    return { status: "invalid" as const };
  }

  const recoveryCodes = generateRecoveryCodes();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "User"
      SET "mfaEnabled" = true, "updatedAt" = NOW()
      WHERE "id" = ${userId} AND "isSuperAdmin" = true
    `;

    await tx.$executeRaw`
      DELETE FROM "admin_mfa_recovery_codes"
      WHERE "userId" = ${userId}
    `;

    for (const recoveryCode of recoveryCodes) {
      await tx.$executeRaw`
        INSERT INTO "admin_mfa_recovery_codes" ("id", "userId", "codeHash")
        VALUES (${randomUUID()}, ${userId}, ${hashRecoveryCode(recoveryCode)})
      `;
    }
  });

  return { status: "enabled" as const, recoveryCodes };
}

export async function verifyAdminMfaCode(userId: string, code: string) {
  const secret = await getStoredMfaSecret(userId);

  if (secret && verifyTotpCode(secret, code)) {
    return true;
  }

  return consumeRecoveryCode(userId, code);
}

export async function disableAdminMfa(userId: string, code: string) {
  const status = await getAdminMfaStatus(userId);

  if (!status.enabled || !(await verifyAdminMfaCode(userId, code))) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "User"
      SET "mfaEnabled" = false, "mfaSecretEncrypted" = NULL, "updatedAt" = NOW()
      WHERE "id" = ${userId} AND "isSuperAdmin" = true
    `;
    await tx.$executeRaw`
      DELETE FROM "admin_mfa_recovery_codes"
      WHERE "userId" = ${userId}
    `;
  });

  return true;
}

export function createAdminMfaProof(userId: string, now = Date.now()) {
  const payload = Buffer.from(`${userId}.${now}`, "utf8").toString("base64url");
  const signature = signMfaPayload(payload);
  return `${payload}.${signature}`;
}

export function isValidAdminMfaProof(proof: string | null, userId: string, now = Date.now()) {
  if (!proof) {
    return false;
  }

  const [payload, signature] = proof.split(".");

  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = signMfaPayload(payload);
  const providedSignature = Buffer.from(signature, "base64url");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "base64url");

  if (providedSignature.length !== expectedSignatureBuffer.length || !timingSafeEqual(providedSignature, expectedSignatureBuffer)) {
    return false;
  }

  try {
    const decodedPayload = Buffer.from(payload, "base64url").toString("utf8");
    const separatorIndex = decodedPayload.lastIndexOf(".");
    const proofUserId = decodedPayload.slice(0, separatorIndex);
    const issuedAt = Number(decodedPayload.slice(separatorIndex + 1));

    return proofUserId === userId && Number.isFinite(issuedAt) && now - issuedAt >= 0 && now - issuedAt <= MFA_PROOF_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export function getAdminMfaProofFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${MFA_PROOF_COOKIE_NAME}=`));

  return cookie ? decodeURIComponent(cookie.slice(MFA_PROOF_COOKIE_NAME.length + 1)) : null;
}

async function getStoredMfaSecret(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ mfaSecretEncrypted: string | null }>>`
    SELECT "mfaSecretEncrypted"
    FROM "User"
    WHERE "id" = ${userId} AND "isSuperAdmin" = true
    LIMIT 1
  `;

  const encryptedSecret = rows[0]?.mfaSecretEncrypted;
  return encryptedSecret ? decryptApiKey(encryptedSecret) : "";
}

async function consumeRecoveryCode(userId: string, code: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "admin_mfa_recovery_codes"
    WHERE "userId" = ${userId}
      AND "codeHash" = ${hashRecoveryCode(code)}
      AND "usedAt" IS NULL
    LIMIT 1
  `;

  const recoveryCode = rows[0];

  if (!recoveryCode) {
    return false;
  }

  const updatedRows = await prisma.$executeRaw`
    UPDATE "admin_mfa_recovery_codes"
    SET "usedAt" = NOW()
    WHERE "id" = ${recoveryCode.id} AND "usedAt" IS NULL
  `;

  return updatedRows === 1;
}

function generateTotpCode(secret: string, counter: number) {
  const key = fromBase32(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function normalizeRecoveryCode(code: string) {
  return code.replaceAll("-", "").replace(/\s+/g, "").toUpperCase();
}

function signMfaPayload(payload: string) {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "myc-presupuestos-dev-auth-secret";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function toBase32(buffer: Buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

function fromBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let buffer = 0;
  const output: number[] = [];

  for (const character of value.toUpperCase().replace(/=+$/, "")) {
    const index = alphabet.indexOf(character);

    if (index < 0) {
      throw new Error("Invalid TOTP secret.");
    }

    buffer = (buffer << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}
