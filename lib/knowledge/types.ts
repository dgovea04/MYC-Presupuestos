export type KnowledgeScope = "GLOBAL" | "COMPANY" | "PROJECT" | "USER";

export interface KnowledgeActor {
  userId?: string;
  companyId?: string;
  projectIds?: readonly string[];
}

export interface KnowledgeScopeContext {
  scope: KnowledgeScope;
  companyId?: string;
  projectId?: string;
  userId?: string;
}

