import { PrismaClient } from "@prisma/client";

import { normalizeResourceIuCode } from "../lib/resources/iu";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const resources = await prisma.resource.findMany({
    where: {
      iu: {
        not: null,
      },
    },
    select: {
      id: true,
      code: true,
      description: true,
      iu: true,
    },
    orderBy: {
      updatedAt: "asc",
    },
  });

  const updates = resources
    .map((resource) => {
      const nextIu = normalizeResourceIuCode(resource.iu);
      const currentIu = resource.iu?.trim() ?? null;

      if (nextIu === currentIu) {
        return null;
      }

      return {
        id: resource.id,
        code: resource.code,
        description: resource.description,
        previousIu: resource.iu,
        nextIu,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (updates.length === 0) {
    console.log("No se encontraron IU de insumos pendientes de normalizar.");
    return;
  }

  const invalidCount = updates.filter((entry) => entry.nextIu == null).length;
  const normalizedCount = updates.length - invalidCount;

  console.log(
    `Se detectaron ${updates.length} insumo(s) con IU para normalizar. ` +
      `${normalizedCount} quedaran con codigo numerico y ${invalidCount} quedaran sin IU.`,
  );

  for (const preview of updates.slice(0, 15)) {
    console.log(
      `- ${preview.code} | ${preview.description} | "${preview.previousIu}" -> "${preview.nextIu ?? ""}"`,
    );
  }

  if (dryRun) {
    console.log("Dry run completado. No se aplicaron cambios.");
    return;
  }

  for (const update of updates) {
    await prisma.resource.update({
      where: { id: update.id },
      data: { iu: update.nextIu },
    });
  }

  console.log(`Normalizacion completada. Se actualizaron ${updates.length} insumo(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
