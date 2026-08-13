import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/db/prisma";
import { importProjectPackageToMyc } from "@/lib/mcp/import-persistence";
import { analyzeProjectPackageBuffer } from "@/lib/mcp/import-preview";

const demoProjectName = "Edificio Multifamiliar - Demo";
const demoProjectKey = "edificio-multifamiliar";
const demoTemplatePath = join(
  process.cwd(),
  "data-for-seed",
  "demo-projects",
  "edificio-multifamiliar-demo.mcp",
);

export type DemoProjectCreationStatus = "created" | "already_exists" | "skipped" | "failed";

export type DemoProjectCreationResult = {
  status: DemoProjectCreationStatus;
  projectId: string | null;
  generalBudgetId: string | null;
  warnings: string[];
};

export async function ensureDemoProjectForCompany(params: {
  userId: string;
  companyId: string;
  enabled?: boolean;
}): Promise<DemoProjectCreationResult> {
  if (params.enabled === false) {
    return { status: "skipped", projectId: null, generalBudgetId: null, warnings: [] };
  }

  const existingDemo = await prisma.project.findFirst({
    where: {
      companyId: params.companyId,
      OR: [{ demoKey: demoProjectKey }, { name: demoProjectName }],
    },
    select: {
      id: true,
      budgets: {
        where: { kind: "GENERAL" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (existingDemo) {
    return {
      status: "already_exists",
      projectId: existingDemo.id,
      generalBudgetId: existingDemo.budgets[0]?.id ?? null,
      warnings: [],
    };
  }

  try {
    const buffer = await readFile(demoTemplatePath);
    const analysis = analyzeProjectPackageBuffer(buffer);

    if (analysis.preview.compatibility === "unsupported") {
      return {
        status: "failed",
        projectId: null,
        generalBudgetId: null,
        warnings: [`No se pudo crear el proyecto demo: ${analysis.preview.errors.join(", ")}`],
      };
    }

    const readModule = (path: string): unknown => {
      const content = analysis.fileContents.get(path);

      if (!content) {
        throw new Error(`Modulo no encontrado en el paquete demo: ${path}`);
      }

      return JSON.parse(content);
    };

    const result = await importProjectPackageToMyc(params.userId, analysis.manifest, readModule, {
      companyId: params.companyId,
      mode: "restore_as_new_project",
      projectOverrides: {
        name: demoProjectName,
        clientName: "Cliente Demo",
        location: "Lima, Peru",
        projectType: "Edificacion",
        isDemo: true,
        demoKey: demoProjectKey,
      },
    });

    return {
      status: "created",
      projectId: result.projectId,
      generalBudgetId: result.generalBudgetId,
      warnings: result.warnings,
    };
  } catch (error) {
    console.error("Demo project creation failed", error);

    return {
      status: "failed",
      projectId: null,
      generalBudgetId: null,
      warnings: [
        `No se pudo crear el proyecto demo: ${
          error instanceof Error ? error.message : "error inesperado"
        }`,
      ],
    };
  }
}
