import { withAiRoute } from "@/lib/ai/route-handler";
import { listActiveWorkflows } from "@/lib/data/agent-workflows";

/**
 * GET /api/ai/workflows
 *
 * Lista las plantillas de workflow agéntico disponibles.
 * Cada workflow incluye su slug, nombre, descripción, objetivo inicial
 * y herramientas permitidas asociadas.
 */
export async function GET() {
  return withAiRoute(async () => {
    const workflows = await listActiveWorkflows();

    const result = workflows.map((w) => ({
      id: w.id,
      slug: w.slug,
      name: w.name,
      description: w.description,
      initialGoalTemplate: w.initialGoalTemplate,
      allowedTools: w.allowedToolsJson ?? [],
      defaultMode: w.defaultMode,
    }));

    return Response.json({ workflows: result }, { status: 200 });
  });
}
