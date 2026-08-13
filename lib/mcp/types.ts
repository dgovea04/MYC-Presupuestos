export type McpFormatVersion = "1.0.0";

export type McpModuleId =
  | "project"
  | "budgets"
  | "budget_items"
  | "apus"
  | "project_resources"
  | "general_expenses"
  | "budget_footer"
  | "polynomial_formula"
  | "takeoffs"
  | "work_schedule"
  | "risk_analysis";

export type McpCompatibility = "supported" | "supported_with_warnings" | "unsupported";

export type McpManifestSource = {
  app: string;
  appVersion: string;
  environment: string;
};

export type McpManifestPackage = {
  fileExtension: ".mcp";
  compression: "zip-store";
  checksumAlgorithm: "sha256";
};

export type McpManifestProject = {
  slug: string;
  name: string;
  currency: string;
};

export type McpManifestModule = {
  id: McpModuleId;
  path: string;
  required: boolean;
};

export type McpManifestCapabilities = {
  restoreAsNewProject: boolean;
  preview: boolean;
  merge: boolean;
};

export type McpManifestNamespace = "core" | "mc";

export type McpManifest = {
  format: "MC_PROJECT_PACKAGE";
  formatVersion: McpFormatVersion;
  schemaVersion: 1;
  exportedAt: string;
  source: McpManifestSource;
  package: McpManifestPackage;
  project: McpManifestProject;
  modules: McpManifestModule[];
  capabilities: McpManifestCapabilities;
  namespaces: McpManifestNamespace[];
  extensions: string[];
  checksums: Record<string, string>;
};

export type McpArchiveEntry = {
  fileName: string;
  content: string | Buffer | Uint8Array;
};

export type McpProjectPackageSnapshot = {
  manifest: McpManifest;
  files: McpArchiveEntry[];
};

export type McpImportPreview = {
  compatibility: McpCompatibility;
  projectName: string;
  formatVersion: string;
  sourceApp: string;
  sourceAppVersion: string;
  modules: Array<{ id: string; present: boolean; required: boolean }>;
  warnings: string[];
  errors: string[];
};

export type McpImportPayload = {
  manifest: McpManifest;
  extractedModulePaths: Set<string>;
  readModuleContent: (modulePath: string) => string;
};

export type McpImportPersistenceResult = {
  projectId: string;
  projectName: string;
  generalBudgetId: string;
  subBudgetIds: string[];
  budgetCount: number;
  itemCount: number;
  apuCount: number;
  resourceCount: number;
  warnings: string[];
};

export type McpImportPersistenceOptions = {
  companyId: string;
  mode: "restore_as_new_project";
  projectOverrides?: {
    name?: string;
    clientName?: string | null;
    location?: string | null;
    projectType?: string | null;
    isDemo?: boolean;
    demoKey?: string | null;
  };
};
