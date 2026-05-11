import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { serializeUnifiedIndex } from "@/lib/db/serializers";

const unifiedIndexQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1979),
  code: z.string().trim().min(1).optional(),
  geographicArea: z.string().trim().min(1).optional(),
});

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = unifiedIndexQuerySchema.parse({
      month: searchParams.get("month"),
      year: searchParams.get("year"),
      code: searchParams.get("code") ?? undefined,
      geographicArea: searchParams.get("geographicArea") ?? undefined,
    });

    const indices = await prisma.unifiedIndex.findMany({
      where: {
        month: query.month,
        year: query.year,
        code: query.code,
        geographicArea: query.geographicArea,
      },
      orderBy: [{ code: "asc" }, { geographicArea: "asc" }],
    });

    return NextResponse.json(indices.map(serializeUnifiedIndex));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron consultar los indices unificados",
      },
      { status: 400 },
    );
  }
}
