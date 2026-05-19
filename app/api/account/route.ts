import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { getUserAccount, updateUserAccountProfile } from "@/lib/data/account";
import { accountProfileSchema } from "@/lib/validations/account";

const PROFILE_VALIDATION_ERROR = "Revisa los datos de tu perfil e intenta nuevamente.";
const PROFILE_SAVE_ERROR = "No se pudo guardar tu perfil.";

function revalidateAccountPaths() {
  revalidatePath("/account");
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/budgets");
  revalidatePath("/resources");
  revalidatePath("/settings");
}

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const account = await getUserAccount(session.user.id);
  return NextResponse.json(account);
}

export async function PATCH(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = accountProfileSchema.parse(body);
    const account = await updateUserAccountProfile(session.user.id, payload);

    revalidateAccountPaths();

    return NextResponse.json(account);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: PROFILE_VALIDATION_ERROR }, { status: 400 });
    }

    return NextResponse.json({ error: PROFILE_SAVE_ERROR }, { status: 400 });
  }
}
