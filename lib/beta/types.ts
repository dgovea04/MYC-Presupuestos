export const BETA_DURATION_DAYS = [60, 90] as const;
export type BetaDurationDays = (typeof BETA_DURATION_DAYS)[number];

export type BetaCampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "FINISHED";
export type BetaAssignmentMode = "AUTOMATIC" | "ADMIN" | "CODE" | "MIXED";
export type BetaGrantStatus = "SCHEDULED" | "ACTIVE" | "EXPIRED" | "REVOKED";
export type BetaGrantSource = "AUTOMATIC" | "ADMIN" | "CODE" | "IMPORT";

export type BetaEligibilityRules = {
  requireVerifiedEmail: boolean;
  newUsersOnly: boolean;
  allowedUtmSources: string[];
  allowedUtmCampaigns: string[];
  allowedEmailDomains: string[];
  requiresCode: boolean;
  excludePaidSubscribers: boolean;
  excludePreviousBetaUsers: boolean;
};

export type BetaCampaignInput = {
  name: string;
  code?: string | null;
  durationDays: BetaDurationDays;
  assignmentMode: BetaAssignmentMode;
  startsAt: Date;
  endsAt?: Date | null;
  maxAssignments?: number | null;
  eligibilityRules: BetaEligibilityRules;
};

export type BetaEligibilityResult = {
  eligible: boolean;
  reasons: string[];
  existingActiveGrantId: string | null;
  hasPaidSubscription: boolean;
};

export type ActiveBetaAccess = {
  grantId: string;
  campaignId: string;
  campaignName: string;
  planSlug: "pro";
  grantSource: BetaGrantSource;
  startsAt: Date;
  expiresAt: Date;
  daysRemaining: number;
};
