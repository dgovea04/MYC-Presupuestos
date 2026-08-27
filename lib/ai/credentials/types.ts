import { z } from "zod";
import type { AiProviderId, KhipuAiTask } from "@/lib/ai/gateway/types";

export const aiCredentialScopeSchema = z.enum(["PLATFORM", "WORKSPACE", "TEAM", "PROJECT", "USER"]);
export const aiCredentialStatusSchema = z.enum(["ACTIVE", "INVALID", "REVOKED"]);
export const aiPolicyModeSchema = z.enum(["PLATFORM", "WORKSPACE", "BYOK_ALLOWED", "BYOK_ONLY"]);
export const aiCredentialProviderSchema = z.enum(["OPENAI", "GEMINI", "OPENROUTER"]);
export const aiCredentialSourceSchema = z.enum(["PLATFORM", "WORKSPACE", "USER", "ENVIRONMENT"]);
export const aiBillingScopeSchema = z.enum(["PLATFORM", "WORKSPACE", "USER"]);

export type AiCredentialScope = z.infer<typeof aiCredentialScopeSchema>;
export type AiGovernanceScope = AiCredentialScope;
export type AiCredentialStatus = z.infer<typeof aiCredentialStatusSchema>;
export type AiPolicyMode = z.infer<typeof aiPolicyModeSchema>;
export type AiCredentialProvider = z.infer<typeof aiCredentialProviderSchema>;
export type AiCredentialSource = z.infer<typeof aiCredentialSourceSchema>;
export type AiBillingScope = z.infer<typeof aiBillingScopeSchema>;

export type ResolvedAiCredential = {
  provider: Exclude<AiProviderId, "auto">; credentialSource: AiCredentialSource; credentialId: string | null; apiKey: string | null; model: string;
  billingScope: AiBillingScope; tokenLimit?: number | null; budgetLimitMinor?: number | null; hardLimit: boolean; alertThresholds: number[];
  allowAgentWrites: boolean; fallbackAllowed: boolean; workspaceId: string | null; task: KhipuAiTask;
};

export const aiCredentialInputSchema = z.object({
  scope: aiCredentialScopeSchema,
  workspaceId: z.string().min(1).nullable().optional(), teamId: z.string().min(1).nullable().optional(), projectId: z.string().min(1).nullable().optional(), userId: z.string().min(1).nullable().optional(),
  provider: aiCredentialProviderSchema, apiKey: z.string().trim().min(1).max(1000), isFallback: z.boolean().optional().default(false),
}).superRefine((value, context) => {
  const valid = value.scope === "PLATFORM" ? !value.workspaceId && !value.teamId && !value.projectId && !value.userId : value.scope === "WORKSPACE" ? Boolean(value.workspaceId) && !value.teamId && !value.projectId && !value.userId : value.scope === "TEAM" ? Boolean(value.workspaceId && value.teamId) && !value.projectId && !value.userId : value.scope === "PROJECT" ? Boolean(value.workspaceId && value.projectId) && !value.teamId && !value.userId : !value.workspaceId && !value.teamId && !value.projectId && Boolean(value.userId);
  if (!valid) context.addIssue({ code: "custom", path: ["scope"], message: "El scope y su propietario no coinciden." });
});
export type AiCredentialInput = z.infer<typeof aiCredentialInputSchema>;

export function providerToCredentialProvider(provider: AiProviderId | AiCredentialProvider): AiCredentialProvider | null { if (provider === "agent") return "OPENROUTER"; if (provider === "openai" || provider === "gemini" || provider === "openrouter") return provider.toUpperCase() as AiCredentialProvider; if (provider === "OPENAI" || provider === "GEMINI" || provider === "OPENROUTER") return provider; return null; }
