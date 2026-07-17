/**
 * Instrumentación de Next.js — se ejecuta una vez al iniciar el servidor.
 *
 * Sincroniza automáticamente los WORKFLOW_TEMPLATES con la base de datos
 * sin necesidad de ejecutar el seed manual ni scripts adicionales.
 *
 * Referencia: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import { createPrismaClient } from "@/lib/db/prisma-client";
import { seedAgentWorkflows } from "@/lib/data/seed-agent-workflows";

export async function register() {
  // Solo sincronizar en desarrollo o si la variable está explícitamente habilitada
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.AUTO_MIGRATE_WORKFLOWS !== "true"
  ) {
    return;
  }

  const prisma = createPrismaClient(
    process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  );

  try {
    const result = await seedAgentWorkflows(prisma);

    if (result.errors.length > 0) {
      console.warn(
        `[instrumentation] AgentWorkflows: ${result.upserted} sincronizados, ${result.errors.length} errores.`,
        result.errors,
      );
    } else if (result.upserted > 0) {
      console.info(
        `[instrumentation] AgentWorkflows: ${result.upserted} templates sincronizados.`,
      );
    }
  } catch (err) {
    console.error("[instrumentation] Error syncing agent workflows:", err);
  } finally {
    await prisma.$disconnect();
  }
}
