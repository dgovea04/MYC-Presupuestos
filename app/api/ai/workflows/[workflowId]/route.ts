import { withAiRoute } from "@/lib/ai/route-handler";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { getWorkflowById } from "@/lib/data/agent-workflows";

/**
 * GET /api/ai/workflows/[workflowId]
 *
 * Obtiene el detalle de una plantilla de workflow agéntico por su ID.
 *
 * Params:
 *   workflowId — ID del workflow a consultar
 *
 * Respuesta:
 *   { workflow: { id, slug, name, description, initialGoalTemplate, allowedTools, defaultMode, isActive, createdAt, updatedAt } }
 *
 * Errores:
 *   404 — Workflow no encontrado
 *   500 — Error interno al consultar
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  return withAiRoute(async (session) => {
    await assertFeatureAccess({ userId: session.user.id, feature: "khipu.agent" });
    const { workflowId } = await params;

    try {
      const workflow = await getWorkflowById(workflowId);

      if (!workflow) {
        return Response.json(
          { error: `Workflow "${workflowId}" no encontrado.` },
          { status: 404 },
        );
      }

      return Response.json(
        {
          workflow: {
            id: workflow.id,
            slug: workflow.slug,
            name: workflow.name,
            description: workflow.description,
            initialGoalTemplate: workflow.initialGoalTemplate,
            allowedTools: workflow.allowedToolsJson ?? [],
            defaultMode: workflow.defaultMode,
            isActive: workflow.isActive,
            createdAt: workflow.createdAt.toISOString(),
            updatedAt: workflow.updatedAt.toISOString(),
          },
        },
        { status: 200 },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido al consultar el workflow.";

      return Response.json({ error: message }, { status: 500 });
    }
  });
}
