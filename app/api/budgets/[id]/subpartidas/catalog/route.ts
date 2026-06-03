import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { serializeCatalogPartida } from "@/lib/db/serializers";
import { getAuthSession } from "@/lib/auth/session";
import { CATALOG_PARTIDAS_CACHE_TAG } from "@/lib/data/partidas";
import { isSubpartidaResourceType } from "@/lib/apu/subpartidas";

const createSubpartidaCatalogSchema = z.object({
  apuResourceId: z.string().min(1),
  description: z.string().trim().min(3),
  unit: z.string().trim().min(1),
  unitPrice: z.coerce.number().min(0),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId } = await params;
    const input = createSubpartidaCatalogSchema.parse(await request.json());

    const resource = await prisma.apuResource.findFirst({
      where: {
        id: input.apuResourceId,
        apu: {
          budgetItem: {
            budgetId,
            budget: {
              project: {
                company: {
                  userId: session.user.id,
                },
              },
            },
          },
        },
      },
      include: {
        apu: {
          include: {
            budgetItem: {
              include: {
                budget: true,
              },
            },
          },
        },
      },
    });

    if (!resource || !isSubpartidaResourceType(resource.resourceType)) {
      return NextResponse.json({ error: "No se encontro la subpartida del APU." }, { status: 404 });
    }

    if (resource.catalogPartidaId) {
      return NextResponse.json({ error: "La subpartida ya esta enlazada a una partida del catalogo." }, { status: 400 });
    }

    const partida = await prisma.$transaction(async (tx) => {
      const created = await tx.catalogPartida.create({
        data: {
          description: input.description,
          unit: input.unit,
          unitPrice: input.unitPrice,
          currency: resource.apu.budgetItem.budget.currency,
          source: "Creado desde Sub Presupuesto",
          performance: 1,
          performanceUnit: input.unit,
          performanceRate: `1.0000 ${input.unit}/DIA`,
          apuRows: {
            create: [],
          },
        },
        include: {
          apuRows: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      await tx.apuResource.update({
        where: { id: resource.id },
        data: {
          catalogPartidaId: created.id,
        },
      });

      return created;
    });

    revalidateTag(CATALOG_PARTIDAS_CACHE_TAG, "max");
    revalidatePath("/partidas");
    revalidatePath(`/budgets/${budgetId}`);

    return NextResponse.json({ partida: serializeCatalogPartida(partida) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la partida/APU de la subpartida." },
      { status: 400 },
    );
  }
}
