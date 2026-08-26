import type { ResolvedAiCredential } from "@/lib/ai/credentials/types";

export type AiExecutionAttribution = {
  workspaceId: string | null;
  credentialSource: ResolvedAiCredential["credentialSource"];
  credentialId: string | null;
  billingScope: ResolvedAiCredential["billingScope"];
  requestId: string;
};

export function buildAiExecutionAttribution(
  resolved: ResolvedAiCredential,
  requestId: string,
): AiExecutionAttribution {
  return {
    workspaceId: resolved.workspaceId,
    credentialSource: resolved.credentialSource,
    credentialId: resolved.credentialId,
    billingScope: resolved.billingScope,
    requestId,
  };
}

export function shouldConsumePlatformTokens(resolved: Pick<ResolvedAiCredential, "billingScope">): boolean {
  return resolved.billingScope === "PLATFORM";
}
