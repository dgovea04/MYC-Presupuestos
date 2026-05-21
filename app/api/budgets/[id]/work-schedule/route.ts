import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { generateWorkScheduleBase, getWorkScheduleSection, saveWorkScheduleItem } from "@/lib/data/work-schedule";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const section = await getWorkScheduleSection(id, session.user.id);
    return NextResponse.json(section);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la programacion de obra" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const section = await saveWorkScheduleItem(id, session.user.id, body);
    revalidatePath(`/budgets/${id}`);
    revalidatePath(`/budgets/${id}/work-schedule`);
    return NextResponse.json(section);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la programacion de obra" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const section = await generateWorkScheduleBase(id, session.user.id, body);
    revalidatePath(`/budgets/${id}`);
    revalidatePath(`/budgets/${id}/work-schedule`);
    return NextResponse.json(section);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el cronograma inteligente" },
      { status: 400 },
    );
  }
}
