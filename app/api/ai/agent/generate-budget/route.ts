import { NextResponse } from "next/server";
import crypto from "crypto";
import { withAiRoute } from "@/lib/ai/route-handler";
import { generateBudgetTool } from "@/lib/ai/agent/tools/budgets";
import { assertFeatureAccess } from "@/lib/billing/entitlements";

/**
 * POST /api/ai/agent/generate-budget
 *
 * Ejecuta generateBudget DIRECTAMENTE sin pasar por el modelo.
 * Usado como FALLBACK cuando el modelo no llama a la herramienta generateBudget
 * después de que el usuario confirma la generación del presupuesto.
 *
 * Body:
 *   projectId: string (obligatorio)
 *   description: string (obligatorio, mínimo 10 caracteres)
 *   templateType?: "edificio" | "carretera" | "hospital" | "colegio" | "vivienda" | "industrial"
 *   templateSource?: "auto" | "mcp" | "project" | "catalog"
 *   mcpPackageId?: string
 *   workspaceId?: string
 */
export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    await assertFeatureAccess({ userId: session.user.id, feature: "khipu.agent" });
    const body = await request.json();
    const {
      projectId,
      description,
      templateType,
      templateSource,
      mcpPackageId,
      workspaceId,
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId es requerido" },
        { status: 400 },
      );
    }
    if (!description || description.length < 10) {
      return NextResponse.json(
        { error: "description es requerida (mínimo 10 caracteres)" },
        { status: 400 },
      );
    }

    const result = await generateBudgetTool.execute(
      {
        projectId,
        description,
        templateType: templateType ?? undefined,
        templateSource: templateSource ?? "auto",
        mcpPackageId: mcpPackageId ?? undefined,
        previewOnly: false,
      },
      {
        userId: session.user.id,
        projectId,
        workspaceId: workspaceId ?? undefined,
        executionId: `fallback-${crypto.randomUUID().slice(0, 8)}`,
        lastUserMessage: description,
        messages: [],
      },
    );

    return NextResponse.json(result);
  });
}
