import { cache } from "react";
import { revalidateTag } from "next/cache";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { getEffectiveWorkspaceLicense } from "@/lib/workspace/entitlements";
import { requireWorkspaceRole } from "@/lib/workspace/authorization";
import {
  aiPolicyInputSchema,
  defaultAiPolicyInput,
  normalizePolicyForPlan,
  type AiPolicyInput,
  type EffectiveAiPolicy,
} from "@/lib/ai/credentials/policy-types";
import type { AiCredentialProvider, AiPolicyMode } from "@/lib/ai/credentials/types";

export const AI_POLICY_CACHE_TAG = "ai-policy";

type PolicyPrisma = typeof defaultPrisma;

const providerToPlanValue: Record<AiCredentialProvider, string> = {
  OPENAI: "OPENAI",
  GEMINI: "GEMINI",
  OPENROUTER: "OPENROUTER",
};

const defaultPlanCapabilities = {
  slug: "starter",
  allowByok: false,
  allowWorkspaceKey: false,
  allowKhipuChat: false,
  allowKhipuAgent: false,
  allowAgentWrites: false,
  allowedAiProviders: [] as string[],
  allowedAiModels: [] as string[],
  userAiTokenLimit: null,
  workspaceAiTokenLimit: null,
};

export class AiPolicyAccessError extends Error {
  readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = "AiPolicyAccessError";
  }
}

export async function getEffectiveAiPolicy({
  userId,
  workspaceId,
  prisma = defaultPrisma,
}: {
  userId: string;
  workspaceId: string;
  prisma?: PolicyPrisma;
}): Promise<EffectiveAiPolicy> {
  const license = await getEffectiveWorkspaceLicense({ userId, companyId: workspaceId });
  if (!license) {
    throw new AiPolicyAccessError("No tienes una membresía activa en este workspace.");
  }

  const [storedPolicy, plan] = await Promise.all([
    prisma.aiPolicy.findUnique({ where: { workspaceId } }),
    prisma.membershipPlan.findUnique({
      where: { slug: license.planSlug },
      select: {
        allowByok: true,
        allowWorkspaceKey: true,
        allowKhipuChat: true,
        allowKhipuAgent: true,
        allowAgentWrites: true,
        allowedAiProviders: true,
        allowedAiModels: true,
        userAiTokenLimit: true,
        workspaceAiTokenLimit: true,
      },
    }),
  ]);

  const planCapabilities = plan ?? defaultPlanCapabilities;
  const rawPolicy: AiPolicyInput = storedPolicy
    ? aiPolicyInputSchema.parse({
        mode: storedPolicy.mode,
        defaultProvider: storedPolicy.defaultProvider,
        allowedProviders: storedPolicy.allowedProviders,
        allowedModels: storedPolicy.allowedModels,
        allowUserKeys: storedPolicy.allowUserKeys,
        allowWorkspaceKey: storedPolicy.allowWorkspaceKey,
        fallbackEnabled: storedPolicy.fallbackEnabled,
        monthlyTokenLimit: storedPolicy.monthlyTokenLimit,
        monthlyBudgetMinor: storedPolicy.monthlyBudgetMinor,
        hardLimit: storedPolicy.hardLimit,
        alertThresholds: storedPolicy.alertThresholds,
        allowAgentWrites: storedPolicy.allowAgentWrites,
      })
    : defaultAiPolicyInput;
  const normalized = normalizePolicyForPlan(rawPolicy, {
    slug: license.planSlug,
    ...planCapabilities,
  });

  return {
    ...normalized,
    workspaceId,
    planSlug: license.planSlug,
    canUseChat: planCapabilities.allowKhipuChat || license.availableFeatures.includes("ai.local"),
    canUseAgent: planCapabilities.allowKhipuAgent || license.availableFeatures.includes("khipu.agent"),
    canUseByok: normalized.allowUserKeys,
    canUseWorkspaceCredential: normalized.allowWorkspaceKey,
    userTokenLimit: planCapabilities.userAiTokenLimit ?? null,
    workspaceTokenLimit: planCapabilities.workspaceAiTokenLimit ?? normalized.monthlyTokenLimit,
  };
}

export async function updateWorkspaceAiPolicy({
  actorUserId,
  workspaceId,
  input,
  prisma = defaultPrisma,
}: {
  actorUserId: string;
  workspaceId: string;
  input: AiPolicyInput;
  prisma?: PolicyPrisma;
}) {
  await requireWorkspaceRole({ userId: actorUserId, companyId: workspaceId, minimumRole: "ADMIN" });
  const parsed = aiPolicyInputSchema.parse(input);
  const current = await getEffectiveAiPolicy({ userId: actorUserId, workspaceId, prisma });
  const plan = await prisma.membershipPlan.findUnique({
    where: { slug: current.planSlug },
    select: {
      allowByok: true,
      allowWorkspaceKey: true,
      allowKhipuChat: true,
      allowKhipuAgent: true,
      allowAgentWrites: true,
      allowedAiProviders: true,
      allowedAiModels: true,
    },
  });
  const normalized = normalizePolicyForPlan(parsed, { ...defaultPlanCapabilities, ...plan });
  const policy = await prisma.aiPolicy.upsert({
    where: { workspaceId },
    create: { workspaceId, ...normalized },
    update: normalized,
  });

  revalidateTag(`${AI_POLICY_CACHE_TAG}:${workspaceId}`, "max");
  revalidateTag(`effective-license-${actorUserId}-${workspaceId}`, "max");
  return policy;
}

export async function assertAiPolicyAllows({
  policy,
  provider,
  task,
  model,
}: {
  policy: EffectiveAiPolicy;
  provider: string;
  task: string;
  model?: string;
}) {
  if (task === "chat" && !policy.canUseChat) {
    throw new AiPolicyAccessError("Khipu Chat no está habilitado para este workspace.");
  }
  if (task === "agent" && !policy.canUseAgent) {
    throw new AiPolicyAccessError("Khipu Agente no está habilitado para este workspace.");
  }
  const normalizedProvider = provider.toUpperCase();
  const providerValue = normalizedProvider === "OPENAI" || normalizedProvider === "GEMINI" || normalizedProvider === "OPENROUTER"
    ? providerToPlanValue[normalizedProvider as AiCredentialProvider]
    : normalizedProvider;
  if (provider !== "auto" && provider !== "ollama" && !policy.allowedProviders.includes(providerValue as AiCredentialProvider)) {
    throw new AiPolicyAccessError(`El proveedor ${provider} no está permitido por la política del workspace.`);
  }
  if (model && policy.allowedModels.length > 0 && !policy.allowedModels.includes(model)) {
    throw new AiPolicyAccessError(`El modelo ${model} no está permitido por la política del workspace.`);
  }

  if (task !== "chat" && task !== "autocomplete" && !policy.allowAgentWrites && task.includes("agent")) {
    throw new AiPolicyAccessError("Las acciones de escritura del agente están bloqueadas por el workspace.");
  }
}

export function getAiPolicyCacheTag(workspaceId: string) {
  return `${AI_POLICY_CACHE_TAG}:${workspaceId}`;
}

export const getCachedAiPolicy = cache(getEffectiveAiPolicy);

export function isAiPolicyMode(value: string): value is AiPolicyMode {
  return ["PLATFORM", "WORKSPACE", "BYOK_ALLOWED", "BYOK_ONLY"].includes(value);
}
