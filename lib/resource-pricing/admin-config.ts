import { decryptApiKey, encryptApiKey, maskApiKey } from "@/lib/ai/encryption";
import { prisma } from "@/lib/db/prisma";
import type { ResourcePriceProviderConfigPublic, ResourcePriceProviderName, ResourcePriceProviderStatus } from "@/types/resource-pricing";
import type { ResourcePriceProviderConfigInput } from "@/lib/validations/resource-pricing";

const SINGLETON_KEY = "primary";

export type ResolvedResourcePriceProviderConfig = {
  provider: ResourcePriceProviderName;
  status: ResourcePriceProviderStatus;
  baseUrl: string | null;
  apiVersion: string;
  credential: string;
  timeoutMs: number;
  maxBatchSize: number;
  defaultTtlHours: number;
  allowFallback: boolean;
  lastHealthCheckAt: Date | null;
  lastHealthStatus: string | null;
};

const defaultConfig: ResolvedResourcePriceProviderConfig = {
  provider: "mc-presupuestos-price-api",
  status: "DISABLED",
  baseUrl: null,
  apiVersion: "v1",
  credential: "",
  timeoutMs: 8000,
  maxBatchSize: 50,
  defaultTtlHours: 24,
  allowFallback: false,
  lastHealthCheckAt: null,
  lastHealthStatus: null,
};

export async function getPrimaryResourcePriceProviderConfig(): Promise<ResolvedResourcePriceProviderConfig> {
  const row = await prisma.resourcePriceProviderConfig.findUnique({ where: { singletonKey: SINGLETON_KEY } });
  if (!row) return { ...defaultConfig };

  return {
    provider: row.provider as ResourcePriceProviderName,
    status: row.status as ResourcePriceProviderStatus,
    baseUrl: row.baseUrl,
    apiVersion: row.apiVersion,
    credential: row.credentialEncrypted ? decryptApiKey(row.credentialEncrypted) : "",
    timeoutMs: row.timeoutMs,
    maxBatchSize: row.maxBatchSize,
    defaultTtlHours: row.defaultTtlHours,
    allowFallback: row.allowFallback,
    lastHealthCheckAt: row.lastHealthCheckAt,
    lastHealthStatus: row.lastHealthStatus,
  };
}

export async function getPublicPrimaryResourcePriceProviderConfig(): Promise<ResourcePriceProviderConfigPublic> {
  const config = await getPrimaryResourcePriceProviderConfig();
  return {
    provider: config.provider,
    status: config.status,
    baseUrl: config.baseUrl,
    apiVersion: config.apiVersion,
    credentialConfigured: config.credential.length > 0,
    credentialMasked: maskApiKey(config.credential),
    timeoutMs: config.timeoutMs,
    maxBatchSize: config.maxBatchSize,
    defaultTtlHours: config.defaultTtlHours,
    allowFallback: config.allowFallback,
    lastHealthCheckAt: config.lastHealthCheckAt?.toISOString() ?? null,
    lastHealthStatus: config.lastHealthStatus,
  };
}

export async function updatePrimaryResourcePriceProviderConfig(
  input: ResourcePriceProviderConfigInput,
  actorUserId: string,
) {
  if (input.provider === "fake" && process.env.NODE_ENV === "production") {
    throw new Error("El proveedor fake no puede activarse en producción.");
  }

  const existing = await prisma.resourcePriceProviderConfig.findUnique({ where: { singletonKey: SINGLETON_KEY } });
  const encryptedCredential =
    input.credential === undefined
      ? existing?.credentialEncrypted
      : input.credential === null || input.credential.trim() === ""
        ? null
        : encryptApiKey(input.credential.trim());

  const row = await prisma.resourcePriceProviderConfig.upsert({
    where: { singletonKey: SINGLETON_KEY },
    create: {
      singletonKey: SINGLETON_KEY,
      provider: input.provider,
      status: input.status,
      baseUrl: input.baseUrl ?? null,
      apiVersion: input.apiVersion,
      credentialEncrypted: encryptedCredential ?? null,
      timeoutMs: input.timeoutMs,
      maxBatchSize: input.maxBatchSize,
      defaultTtlHours: input.defaultTtlHours,
      allowFallback: input.allowFallback,
      lastUpdatedById: actorUserId,
    },
    update: {
      provider: input.provider,
      status: input.status,
      baseUrl: input.baseUrl ?? null,
      apiVersion: input.apiVersion,
      credentialEncrypted: encryptedCredential ?? null,
      timeoutMs: input.timeoutMs,
      maxBatchSize: input.maxBatchSize,
      defaultTtlHours: input.defaultTtlHours,
      allowFallback: input.allowFallback,
      lastUpdatedById: actorUserId,
    },
  });

  return {
    provider: row.provider as ResourcePriceProviderName,
    status: row.status as ResourcePriceProviderStatus,
    baseUrl: row.baseUrl,
    apiVersion: row.apiVersion,
    credentialConfigured: Boolean(row.credentialEncrypted),
    credentialMasked: maskApiKey(row.credentialEncrypted ? decryptApiKey(row.credentialEncrypted) : ""),
    timeoutMs: row.timeoutMs,
    maxBatchSize: row.maxBatchSize,
    defaultTtlHours: row.defaultTtlHours,
    allowFallback: row.allowFallback,
    lastHealthCheckAt: row.lastHealthCheckAt?.toISOString() ?? null,
    lastHealthStatus: row.lastHealthStatus,
  } satisfies ResourcePriceProviderConfigPublic;
}

export async function recordPrimaryProviderHealth(input: { ok: boolean; message?: string }) {
  const row = await prisma.resourcePriceProviderConfig.findUnique({ where: { singletonKey: SINGLETON_KEY } });
  if (!row) return;

  await prisma.resourcePriceProviderConfig.update({
    where: { id: row.id },
    data: {
      status: input.ok ? "HEALTHY" : "DEGRADED",
      lastHealthCheckAt: new Date(),
      lastHealthStatus: input.message ?? (input.ok ? "ok" : "error"),
    },
  });
}
