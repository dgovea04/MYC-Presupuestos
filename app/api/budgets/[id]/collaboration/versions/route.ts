import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { createBudgetVersionSnapshot, listBudgetVersionSnapshots } from "@/lib/collaboration/versions";
import { versionCreateSchema, versionQuerySchema } from "@/lib/validations/collaboration";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId } = await params;
    const { searchParams } = new URL(request.url);

    const rawQuery: Record<string, unknown> = {};
    const cursor = searchParams.get("cursor");
    if (cursor) rawQuery.cursor = cursor;

    const limit = searchParams.get("limit");
    if (limit) rawQuery.limit = Number(limit);

    const parsed = versionQuerySchema.parse(rawQuery);
    const versions = await listBudgetVersionSnapshots(budgetId, session.user.id, parsed.cursor, parsed.limit);
    return NextResponse.json({ versions });
  } catch (error) {
    console.error("GET versions failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar las versiones" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: budgetId } = await params;
    const body = versionCreateSchema.parse(await request.json());
    const version = await createBudgetVersionSnapshot(budgetId, session.user.id, body.label, body.reason);
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    console.error("POST version failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la version" },
      { status: 400 },
    );
  }
}
