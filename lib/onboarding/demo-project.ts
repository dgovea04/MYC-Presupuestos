import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/db/prisma";
import {
  trackServerEvent,
  type AnalyticsEventName,
  type AnalyticsEventPayload,
} from "@/lib/analytics/events";
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

const findExistingDemoProject = (companyId: string) =>
  prisma.project.findFirst({
    where: {
      companyId,
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

function existingDemoProjectResult(existingDemo: { id: string; budgets: { id: string }[] }) {
  return {
    status: "already_exists" as const,
    projectId: existingDemo.id,
    generalBudgetId: existingDemo.budgets[0]?.id ?? null,
    warnings: [],
  };
}

function failedDemoProjectResult(error: unknown): DemoProjectCreationResult {
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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

async function trackDemoProjectEvent(
  name: AnalyticsEventName,
  payload: AnalyticsEventPayload,
): Promise<void> {
  try {
    await trackServerEvent(name, payload);
  } catch (error) {
    console.error("Analytics event failed", error);
  }
}

function analyticsPayload(
  userId: string,
  companyId: string,
  result: DemoProjectCreationResult,
): AnalyticsEventPayload {
  return {
    userId,
    companyId,
    projectId: result.projectId,
    generalBudgetId: result.generalBudgetId,
    warnings: result.warnings,
  };
}

export async function ensureDemoProjectForCompany(params: {
  userId: string;
  companyId: string;
  enabled?: boolean;
}): Promise<DemoProjectCreationResult> {
  if (params.enabled === false) {
    return { status: "skipped", projectId: null, generalBudgetId: null, warnings: [] };
  }

  try {
    const existingDemo = await findExistingDemoProject(params.companyId);
    if (existingDemo) {
      const result = existingDemoProjectResult(existingDemo);
      await trackDemoProjectEvent(
        "demo_project_already_exists",
        analyticsPayload(params.userId, params.companyId, result),
      );
      return result;
    }

    const buffer = await readFile(demoTemplatePath);
    const analysis = analyzeProjectPackageBuffer(buffer);

    if (analysis.preview.compatibility === "unsupported") {
      const result: DemoProjectCreationResult = {
        status: "failed",
        projectId: null,
        generalBudgetId: null,
        warnings: [`No se pudo crear el proyecto demo: ${analysis.preview.errors.join(", ")}`],
      };
      await trackDemoProjectEvent(
        "demo_project_creation_failed",
        analyticsPayload(params.userId, params.companyId, result),
      );
      return result;
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

    const demoProjectResult: DemoProjectCreationResult = {
      status: "created",
      projectId: result.projectId,
      generalBudgetId: result.generalBudgetId,
      warnings: result.warnings,
    };
    await trackDemoProjectEvent(
      "demo_project_created",
      analyticsPayload(params.userId, params.companyId, demoProjectResult),
    );
    return demoProjectResult;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      try {
        const existingDemo = await findExistingDemoProject(params.companyId);
        if (existingDemo) {
          const result = existingDemoProjectResult(existingDemo);
          await trackDemoProjectEvent(
            "demo_project_already_exists",
            analyticsPayload(params.userId, params.companyId, result),
          );
          return result;
        }
      } catch (lookupError) {
        console.error("Demo project lookup after unique conflict failed", lookupError);
        const result = failedDemoProjectResult(lookupError);
        await trackDemoProjectEvent(
          "demo_project_creation_failed",
          analyticsPayload(params.userId, params.companyId, result),
        );
        return result;
      }
    }

    console.error("Demo project creation failed", error);
    const result = failedDemoProjectResult(error);
    await trackDemoProjectEvent(
      "demo_project_creation_failed",
      analyticsPayload(params.userId, params.companyId, result),
    );
    return result;
  }
}
