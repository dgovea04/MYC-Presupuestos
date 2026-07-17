/**
 * Script independiente para sincronizar los WORKFLOW_TEMPLATES con la BD.
 *
 * Uso:
 *   npx tsx scripts/migrate-agent-workflows.ts
 *
 * Este script es idempotente y solo afecta la tabla `agent_workflows`.
 * No requiere ejecutar el seed completo de la aplicación.
 *
 * Se puede ejecutar:
 * - Después de cada `prisma migrate dev`
 * - En CI/CD como paso posterior a la migración
 * - Manualmente cuando se añadan nuevos templates
 */
import { createPrismaClient } from "@/lib/db/prisma-client";
import { seedAgentWorkflows } from "@/lib/data/seed-agent-workflows";

const prisma = createPrismaClient(["warn", "error"]);

async function main() {
  console.info("[migrate-agent-workflows] Iniciando sincronización...");

  const result = await seedAgentWorkflows(prisma);

  console.info(
    `[migrate-agent-workflows] ${result.upserted} workflows sincronizados.`,
  );

  if (result.errors.length > 0) {
    console.warn(
      `[migrate-agent-workflows] ${result.errors.length} errores:`,
    );
    for (const err of result.errors) {
      console.warn(`  - ${err}`);
    }
  }
}

main()
  .catch((error) => {
    console.error("[migrate-agent-workflows] Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
