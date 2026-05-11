import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { createBudget } from "@/lib/data/budgets";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const budget = await createBudget(body);
    revalidatePath("/dashboard");
    revalidatePath("/budgets");
    revalidatePath("/projects");
    revalidatePath(`/projects/${budget.projectId}`);
    revalidatePath(`/budgets/${budget.id}`);
    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el presupuesto" }, { status: 400 });
  }
}
