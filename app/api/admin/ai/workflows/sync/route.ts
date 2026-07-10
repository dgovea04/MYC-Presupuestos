import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { seedAgentWorkflows } from "@/lib/data/seed-agent-workflows";

/**
 * POST /api/admin/ai/workflows/sync
 *
 * Sincroniza bajo demanda los WORKFLOW_TEMPLATES con la base de datos.
 * Solo accesible por usuarios con rol ADMIN.
 *
 * Útil para:
 * - Desplegar nuevos templates sin reiniciar el servidor
 * - Reparar workflows después de una restauración de BD
 * - CI/CD pipelines
 */
export async function POST() {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await seedAgentWorkflows(prisma);

    revalidatePath("/admin/ai/workflows");

    return NextResponse.json({
      ok: true,
      upserted: result.upserted,
      errors: result.errors,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error inesperado";

    return NextResponse.json(
      { error: message, ok: false },
      { status: 500 },
    );
  }
}
