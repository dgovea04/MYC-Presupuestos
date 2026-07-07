export type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export type WorkspaceSummary = {
  id: string;
  name: string;
  role: WorkspaceRole;
  logoUrl: string | null;
};

export type WorkspaceContextEnvelope = {
  workspace: WorkspaceSummary;
  featureFlags: string[];
  planSlug: "starter" | "pro" | "empresa";
};
