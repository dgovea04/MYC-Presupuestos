import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = "myc-presupuestos-khipu-encryption-salt";
const FALLBACK_DEV_KEY = "myc-presupuestos-dev-fallback-key";

let startupWarningLogged = false;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET || FALLBACK_DEV_KEY;
  return scryptSync(secret, SALT, 32, { N: 16384, r: 8, p: 1 });
}

function getEncryptionKeySource(): "env" | "auth-secret" | "fallback" {
  if (process.env.ENCRYPTION_KEY) return "env";
  if (process.env.AUTH_SECRET) return "auth-secret";
  return "fallback";
}

export function isEncryptionKeySecure(): boolean {
  // Skip validation on client-side imports (process is undefined in browser)
  if (typeof process === "undefined" || !process.env) return true;

  const source = getEncryptionKeySource();
  const isProduction = process.env.NODE_ENV === "production";

  if (source === "fallback") {
    if (!startupWarningLogged) {
      startupWarningLogged = true;
      const message =
        "[MYC] ENCRYPTION_KEY no está configurada y AUTH_SECRET tampoco. " +
        "Las API keys se encriptan con una clave de desarrollo que cambiará cuando configures ENCRYPTION_KEY, " +
        "dejando las keys existentes inaccesibles. Configura ENCRYPTION_KEY en producción.";
      if (isProduction) {
        console.error(message);
      } else {
        console.warn(message);
      }
    }
    return false;
  }

  if (source === "auth-secret") {
    if (isProduction && !startupWarningLogged) {
      startupWarningLogged = true;
      console.log(
        "[MYC] ENCRYPTION_KEY no configurada. Usando AUTH_SECRET como clave de encripción para API keys. " +
          "Configura ENCRYPTION_KEY para una clave dedicada.",
      );
    }
    return true;
  }

  return true;
}

export function encryptApiKey(plaintext: string): string {
  if (!plaintext || plaintext.trim().length === 0) {
    throw new Error("Cannot encrypt an empty API key.");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

export function decryptApiKey(encryptedBase64: string): string {
  if (!encryptedBase64 || encryptedBase64.trim().length === 0) {
    return "";
  }

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedBase64, "base64");

    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      return "";
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.trim().length === 0) {
    return "";
  }

  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 3)}...`;
  }

  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

// Validate encryption key at module load time on the server
// biome-ignore lint/correctness/noTopLevelSideEffects: startup validation is intentional
isEncryptionKeySecure();
