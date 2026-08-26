import { z } from "zod";
import { aiCredentialProviderSchema, aiPolicyModeSchema } from "@/lib/ai/credentials/types";

export const aiPolicyInputSchema = z.object({
  mode: aiPolicyModeSchema,
  defaultProvider: aiCredentialProviderSchema,
  allowedProviders: z.array(aiCredentialProviderSchema).max(10),
  allowedModels: z.array(z.string().trim().min(1).max(200)).max(100),
  allowUserKeys: z.boolean(),
  allowWorkspaceKey: z.boolean(),
  fallbackEnabled: z.boolean(),
  monthlyTokenLimit: z.number().int().nonnegative().nullable(),
  monthlyBudgetMinor: z.number().int().nonnegative().nullable(),
  hardLimit: z.boolean(),
  alertThresholds: z.array(z.number().int().min(1).max(100)).max(10),
  allowAgentWrites: z.boolean(),
});

export type AiPolicyInput = z.infer<typeof aiPolicyInputSchema>;

export type AiPolicyPlanCapabilities = {
  slug: string;
  allowByok: boolean;
  allowWorkspaceKey: boolean;
  allowKhipuChat: boolean;
  allowKhipuAgent: boolean;
  allowAgentWrites: boolean;
  allowedAiProviders: string[];
  allowedAiModels: string[];
  userAiTokenLimit?: number | null;
  workspaceAiTokenLimit?: number | null;
};

export type EffectiveAiPolicy = AiPolicyInput & {
  workspaceId: string;
  planSlug: string;
  canUseChat: boolean;
  canUseAgent: boolean;
  canUseByok: boolean;
  canUseWorkspaceCredential: boolean;
  userTokenLimit: number | null;
  workspaceTokenLimit: number | null;
};

export const defaultAiPolicyInput: AiPolicyInput = {
  mode: "PLATFORM",
  defaultProvider: "OPENAI",
  allowedProviders: ["OPENAI", "GEMINI", "OPENROUTER"],
  allowedModels: [],
  allowUserKeys: false,
  allowWorkspaceKey: false,
  fallbackEnabled: true,
  monthlyTokenLimit: null,
  monthlyBudgetMinor: null,
  hardLimit: true,
  alertThresholds: [80, 90, 100],
  allowAgentWrites: false,
};

export function normalizePolicyForPlan(input: AiPolicyInput, plan: AiPolicyPlanCapabilities): AiPolicyInput {
  const allowedProviders = input.allowedProviders.filter(
    (provider) => plan.allowedAiProviders.length === 0 || plan.allowedAiProviders.includes(provider),
  );
  const allowedModels = input.allowedModels.filter(
    (model) => plan.allowedAiModels.length === 0 || plan.allowedAiModels.includes(model),
  );
  const canByok = plan.allowByok;
  const canWorkspace = plan.allowWorkspaceKey;

  return {
    ...input,
    defaultProvider: allowedProviders.includes(input.defaultProvider)
      ? input.defaultProvider
      : allowedProviders[0] ?? "OPENAI",
    allowedProviders,
    allowedModels,
    allowUserKeys: canByok && input.allowUserKeys,
    allowWorkspaceKey: canWorkspace && input.allowWorkspaceKey,
    mode:
      input.mode === "BYOK_ONLY" && !canByok
        ? "PLATFORM"
        : input.mode === "WORKSPACE" && !canWorkspace
          ? "PLATFORM"
          : input.mode,
    allowAgentWrites: plan.allowAgentWrites && input.allowAgentWrites,
  };
}
