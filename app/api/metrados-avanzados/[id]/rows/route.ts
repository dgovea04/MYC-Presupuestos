import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import { replaceMetradoRows } from "@/lib/data/metrados";
import type {
  MetradoFormulaInputKey,
  MetradoFormulaKey,
  MetradoRowRecord,
  MetradoUnit,
} from "@/types/metrado";

const units = ["m", "m2", "m3", "kg", "und", "glb"] as const satisfies MetradoUnit[];
const formulaKeys = [
  "volume",
  "area",
  "linear",
  "rebarWeight",
  "formworkArea",
  "factorArea",
  "manual",
] as const satisfies MetradoFormulaKey[];
const inputKeys = [
  "largo",
  "ancho",
  "alto",
  "cantidad",
  "longitud",
  "pesoUnitario",
  "perimetro",
  "altura",
  "area",
  "factor",
  "manual",
] as const satisfies MetradoFormulaInputKey[];

const inputsSchema = z
  .object(
    Object.fromEntries(inputKeys.map((key) => [key, z.number().finite().optional()])) as Record<
      MetradoFormulaInputKey,
      z.ZodOptional<z.ZodNumber>
    >,
  )
  .partial()
  .default({});

const rowSchema = z.object({
  id: z.string().trim().min(1).optional(),
  sheetId: z.string().optional(),
  sector: z.string().default(""),
  eje: z.string().default(""),
  nivel: z.string().default(""),
  description: z.string().default(""),
  unit: z.enum(units),
  formulaKey: z.enum(formulaKeys),
  inputs: inputsSchema,
  partial: z.number().finite().default(0),
  sortOrder: z.number().int().positive().optional(),
});

const rowsBodySchema = z.object({
  rows: z.array(rowSchema),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = rowsBodySchema.parse(await request.json());
    const rows = body.rows.map(
      (row, index): MetradoRowRecord => ({
        id: row.id ?? `row-${index + 1}`,
        sheetId: id,
        sector: row.sector.trim(),
        eje: row.eje.trim(),
        nivel: row.nivel.trim(),
        description: row.description.trim(),
        unit: row.unit,
        formulaKey: row.formulaKey,
        inputs: row.inputs,
        partial: row.partial,
        sortOrder: row.sortOrder ?? index + 1,
      }),
    );
    const sheet = await replaceMetradoRows(id, session.user.id, rows);

    if (!sheet) {
      return NextResponse.json({ error: "Metrado no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ sheet });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Revisa las filas del metrado." }, { status: 400 });
    }

    if (isRowsDomainError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Metrado rows PUT failed", error);
    return NextResponse.json({ error: "No se pudieron guardar las filas." }, { status: 500 });
  }
}

function isRowsDomainError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.message === "No se pueden guardar filas de metrado con errores de validacion."
  );
}
