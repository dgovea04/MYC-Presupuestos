import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import {
  getCalendarExceptions,
  createCalendarException,
  updateCalendarException,
  deleteCalendarException,
} from "@/lib/data/work-calendars";

const createExceptionSchema = z.object({
  workCalendarId: z.string().min(1, "ID de calendario requerido"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha invalido (YYYY-MM-DD)"),
  type: z.enum(["HOLIDAY", "WORK_DAY"]).optional(),
  description: z.string().optional(),
});

const updateExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha invalido (YYYY-MM-DD)").optional(),
  type: z.enum(["HOLIDAY", "WORK_DAY"]).optional(),
  description: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const workCalendarId = url.searchParams.get("workCalendarId");
    if (!workCalendarId) {
      return NextResponse.json({ error: "workCalendarId es requerido" }, { status: 400 });
    }

    const exceptions = await getCalendarExceptions(workCalendarId);
    return NextResponse.json(exceptions);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las excepciones" },
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
    const data = createExceptionSchema.parse(body);
    const exception = await createCalendarException(data);

    return NextResponse.json(exception, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Datos invalidos" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la excepcion" },
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
      return NextResponse.json({ error: "ID de excepcion requerido" }, { status: 400 });
    }

    const body = await request.json();
    const data = updateExceptionSchema.parse(body);
    const exception = await updateCalendarException(id, data);

    return NextResponse.json(exception);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Datos invalidos" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la excepcion" },
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
      return NextResponse.json({ error: "ID de excepcion requerido" }, { status: 400 });
    }

    await deleteCalendarException(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar la excepcion" },
      { status: 400 },
    );
  }
}
