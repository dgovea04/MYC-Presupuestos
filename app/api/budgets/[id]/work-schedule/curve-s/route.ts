import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { getWorkScheduleSection } from "@/lib/data/work-schedule";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const section = await getWorkScheduleSection(id, session.user.id);
    return NextResponse.json(section.curveSeries);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la curva S" },
      { status: 400 },
    );
  }
}
