import type { PrismaClient } from "@prisma/client";
import {
  WORKFLOW_TEMPLATES,
  getBundleBySlug,
} from "@/lib/ai/agent/workflows";

export type SeedWorkflowsResult = {
  upserted: number;
  errors: string[];
};

/**
 * Sincroniza los `WORKFLOW_TEMPLATES` definidos en `lib/ai/agent/workflows.ts`
 * con la base de datos usando `upsert` por slug.
 *
 * Es seguro llamarlo múltiples veces (idempotente).
 * No requiere que existan otros datos semilla.
 *
 * @returns Resumen con la cantidad de registros insertados/actualizados y errores.
 */
export async function seedAgentWorkflows(
  prisma: PrismaClient,
): Promise<SeedWorkflowsResult> {
  const errors: string[] = [];
  let upserted = 0;

  for (const template of WORKFLOW_TEMPLATES) {
    const bundle = getBundleBySlug(template.bundleSlug);
    if (!bundle) {
      errors.push(
        `Workflow "${template.slug}": bundle "${template.bundleSlug}" no encontrado.`,
      );
      continue;
    }

    try {
      await prisma.agentWorkflow.upsert({
        where: { slug: template.slug },
        update: {
          name: template.name,
          description: template.description,
          initialGoalTemplate: template.initialGoal,
          allowedToolsJson: bundle.toolNames,
          defaultMode: template.defaultMode,
          isActive: true,
        },
        create: {
          slug: template.slug,
          name: template.name,
          description: template.description,
          initialGoalTemplate: template.initialGoal,
          allowedToolsJson: bundle.toolNames,
          defaultMode: template.defaultMode,
          isActive: true,
        },
      });
      upserted++;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      errors.push(`Workflow "${template.slug}": ${message}`);
    }
  }

  return { upserted, errors };
}
