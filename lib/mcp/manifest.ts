import type { McpManifest, McpManifestModule, McpModuleId } from "./types";

export function createMcpManifest(input: {
  projectId: string;
  projectName: string;
  appVersion: string;
  currency: string;
  modules: Array<{ id: McpModuleId; path: string; required: boolean }>;
  checksums: Record<string, string>;
}): McpManifest {
  const now = new Date().toISOString();

  return {
    format: "MC_PROJECT_PACKAGE",
    formatVersion: "1.0.0",
    schemaVersion: 1,
    exportedAt: now,
    source: {
      app: "MC Presupuestos",
      appVersion: input.appVersion,
      environment: process.env.NODE_ENV ?? "development",
    },
    package: {
      fileExtension: ".mcp",
      compression: "zip-store",
      checksumAlgorithm: "sha256",
    },
    project: {
      slug: createProjectSlug(input.projectName),
      name: input.projectName,
      currency: input.currency,
    },
    modules: input.modules.map((module) => ({
      id: module.id,
      path: module.path,
      required: module.required,
    })),
    capabilities: {
      restoreAsNewProject: true,
      preview: true,
      merge: false,
    },
    namespaces: ["core", "mc"],
    extensions: [],
    checksums: input.checksums,
  };
}

export function getRequiredModules(modules: McpManifestModule[]): McpManifestModule[] {
  return modules.filter((module) => module.required);
}

export function getModuleById(modules: McpManifestModule[], id: McpModuleId): McpManifestModule | undefined {
  return modules.find((module) => module.id === id);
}

export function validateManifestVersion(manifest: McpManifest): void {
  const [major] = manifest.formatVersion.split(".");
  const supportedMajor = "1";

  if (major !== supportedMajor) {
    throw new Error(
      `La version ${manifest.formatVersion} del formato .mcp no es compatible. Solo se soporta la version ${supportedMajor}.x.`,
    );
  }
}

export function buildMcpFileName(projectName: string): string {
  const slug = createProjectSlug(projectName);
  return `${slug}.mcp`;
}

function createProjectSlug(projectName: string): string {
  return projectName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80) || "proyecto";
}
