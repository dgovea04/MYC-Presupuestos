import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { upsertPrimaryCompany } from "@/lib/data/company";
import { USER_COMPANIES_CACHE_TAG } from "@/lib/data/projects";
import { companySchema } from "@/lib/validations/company";

const VALIDATION_ERROR_MESSAGE = "Revisa los datos de la empresa e intenta nuevamente.";
const SAVE_ERROR_MESSAGE = "No se pudo guardar la empresa.";

export async function PATCH(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = companySchema.parse(body);
    const company = await upsertPrimaryCompany(session.user.id, payload);

    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    revalidateTag(USER_COMPANIES_CACHE_TAG, "max");
    revalidatePath("/projects");
    revalidatePath("/budgets");
    revalidatePath("/resources");
    revalidatePath("/settings");

    return NextResponse.json(company);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: VALIDATION_ERROR_MESSAGE }, { status: 400 });
    }

    return NextResponse.json({ error: SAVE_ERROR_MESSAGE }, { status: 400 });
  }
}
