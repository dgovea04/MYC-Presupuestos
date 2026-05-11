import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { getUserSettings, updateUserSettings } from "@/lib/data/settings";

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const settings = await getUserSettings(session.user.id);
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const settings = await updateUserSettings(session.user.id, body);

    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath("/budgets");
    revalidatePath("/resources");
    revalidatePath("/settings");

    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar la configuracion" }, { status: 400 });
  }
}
