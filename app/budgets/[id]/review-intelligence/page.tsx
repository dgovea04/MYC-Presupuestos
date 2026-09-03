import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ReviewIntelligencePage } from "@/components/review-intelligence/review-intelligence-page";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetHeaderById } from "@/lib/data/budgets";
import { getUserSettings } from "@/lib/data/settings";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) return { title: "Revisión Inteligente | MC Presupuestos" };
  const budget = await getBudgetHeaderById(id, session.user.id);
  return { title: budget ? `Revisión Inteligente · ${budget.name} | MC Presupuestos` : "Revisión Inteligente | MC Presupuestos", description: "Compara partidas de presupuesto con evidencia documental y decisiones humanas auditables." };
}

export default async function BudgetReviewIntelligencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) notFound();
  const [budget, settings] = await Promise.all([getBudgetHeaderById(id, session.user.id), getUserSettings(session.user.id)]);
  if (!budget) notFound();
  return <AppShell currentUser={session.user} settings={settings}><ReviewIntelligencePage budgetId={budget.id} projectId={budget.projectId} budgetName={budget.name} /></AppShell>;
}
