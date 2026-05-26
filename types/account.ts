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
  monthlyTokenLimit: number;
  extraTokens: number;
  consumedTokens: number;
  reservedTokens: number;
  allowance: number;
  availableTokens: number;
};
