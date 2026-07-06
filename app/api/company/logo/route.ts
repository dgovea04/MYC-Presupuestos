import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { clearPrimaryCompanyLogo, getPrimaryCompany, updatePrimaryCompanyLogo } from "@/lib/data/company";
import { USER_COMPANIES_CACHE_TAG } from "@/lib/data/projects";
import { deleteStoredCompanyLogo, storeCompanyLogoFile } from "@/lib/company/logo-storage";
import { companyLogoUploadSchema } from "@/lib/validations/company";

const COMPANY_LOGO_VALIDATION_ERROR = "Revisa el logo seleccionado e intenta nuevamente.";
const COMPANY_LOGO_SAVE_ERROR = "No se pudo guardar el logo de la empresa.";

function revalidateCompanyPaths() {
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  revalidateTag(USER_COMPANIES_CACHE_TAG, "max");
  revalidatePath("/projects");
  revalidatePath("/budgets");
  revalidatePath("/resources");
  revalidatePath("/settings");
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let storedLogoUrl: string | null = null;

  try {
    const currentCompany = await getPrimaryCompany(session.user.id);

    if (!currentCompany) {
      return NextResponse.json({ error: "Primero crea tu empresa principal." }, { status: 400 });
    }

    const formData = await request.formData();
    const payload = companyLogoUploadSchema.parse({
      logo: formData.get("logo"),
    });
    const logoFile = payload.logo as File;

    storedLogoUrl = await storeCompanyLogoFile(currentCompany.id, logoFile);
    const company = await updatePrimaryCompanyLogo(session.user.id, storedLogoUrl);

    if (currentCompany.logoUrl && currentCompany.logoUrl !== storedLogoUrl) {
      await deleteStoredCompanyLogo(currentCompany.logoUrl);
    }

    revalidateCompanyPaths();

    return NextResponse.json(company);
  } catch (error) {
    if (storedLogoUrl) {
      await deleteStoredCompanyLogo(storedLogoUrl);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: COMPANY_LOGO_VALIDATION_ERROR }, { status: 400 });
    }

    return NextResponse.json({ error: COMPANY_LOGO_SAVE_ERROR }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const currentCompany = await getPrimaryCompany(session.user.id);

    if (!currentCompany) {
      return NextResponse.json({ error: "Primero crea tu empresa principal." }, { status: 400 });
    }

    if (currentCompany.logoUrl) {
      await deleteStoredCompanyLogo(currentCompany.logoUrl);
    }

    const company = await clearPrimaryCompanyLogo(session.user.id);

    revalidateCompanyPaths();

    return NextResponse.json(company);
  } catch {
    return NextResponse.json({ error: COMPANY_LOGO_SAVE_ERROR }, { status: 400 });
  }
}
