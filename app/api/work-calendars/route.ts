import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import {
  getWorkCalendars,
  createWorkCalendar,
  updateWorkCalendar,
  deleteWorkCalendar,
} from "@/lib/data/work-calendars";

const createCalendarSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  workDays: z.number().int().min(0).max(127).optional(),
  workHoursPerDay: z.number().min(0.5).max(24).optional(),
});

const updateCalendarSchema = z.object({
  name: z.string().min(1).optional(),
  workDays: z.number().int().min(0).max(127).optional(),
  workHoursPerDay: z.number().min(0.5).max(24).optional(),
});

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const calendars = await getWorkCalendars();
    return NextResponse.json(calendars);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los calendarios" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createCalendarSchema.parse(body);
    const calendar = await createWorkCalendar(data);

    revalidatePath("/settings");
    revalidatePath("/projects");

    return NextResponse.json(calendar, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Datos invalidos" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el calendario" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID de calendario requerido" }, { status: 400 });
    }

    const body = await request.json();
    const data = updateCalendarSchema.parse(body);
    const calendar = await updateWorkCalendar(id, data);

    revalidatePath("/settings");
    revalidatePath("/projects");

    return NextResponse.json(calendar);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Datos invalidos" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el calendario" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID de calendario requerido" }, { status: 400 });
    }

    await deleteWorkCalendar(id);

    revalidatePath("/settings");
    revalidatePath("/projects");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el calendario" },
      { status: 400 },
    );
  }
}
