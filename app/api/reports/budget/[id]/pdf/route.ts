import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { getUserAccount } from "@/lib/data/account";
import { getBudgetById } from "@/lib/data/budgets";
import { getUserCompanies } from "@/lib/data/projects";
import { createBudgetPdf } from "@/lib/exports/pdf";
import { getUserSettings } from "@/lib/data/settings";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const budget = await getBudgetById(id, session.user.id);

  if (!budget) {
    return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  }

  const settings = await getUserSettings(session.user.id);
  const [account, companies] = await Promise.all([getUserAccount(session.user.id), getUserCompanies(session.user.id)]);
  const file = await createBudgetPdf(budget, budget.project, settings.currencyDecimals, {
    companyName: companies[0]?.name ?? null,
    companyLogoUrl: companies[0]?.logoUrl ?? null,
    name: account.name,
    avatarUrl: account.avatarUrl,
    jobTitle: account.jobTitle,
    phone: account.phone,
  });

  return new NextResponse(file, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"presupuesto-${budget.id}.pdf\"`,
    },
  });
}
