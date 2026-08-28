export type AccountRecord = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  phone: string;
  jobTitle: string;
  bio: string;
  createdAt: string;
};

export type AccountMembershipRecord = {
  planName: string;
  planSlug: string;
  effectivePlanSlug: "starter" | "pro" | "empresa";
  billingProvider: "STRIPE" | "MANUAL" | null;
  billingStatus: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  canManageBilling: boolean;
  canUpgrade: boolean;
  accessSource: "PLAN" | "COMPANY_SUBSCRIPTION" | "BETA" | "STRIPE";
  betaGrantId: string | null;
  betaCampaignName: string | null;
  betaExpiresAt: string | null;
  betaDaysRemaining: number | null;
  betaAiTokenLimit: number | null;
  monthlyTokenLimit: number;
  extraTokens: number;
  consumedTokens: number;
  reservedTokens: number;
  allowance: number;
  availableTokens: number;
};
