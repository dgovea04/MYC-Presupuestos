import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { AppShell } from "@/components/layout/app-shell";
import { RiskAnalysisDashboard } from "@/components/risk/risk-analysis-dashboard";
import { getAuthSession } from "@/lib/auth/session";
import { getEffectiveUserLicense, hasFeatureAccess } from "@/lib/billing/entitlements";
import { getUserSettings } from "@/lib/data/settings";
import { getWorkScheduleSection } from "@/lib/data/work-schedule";
import { getBudgetHeaderById } from "@/lib/data/budgets";
import { getRiskAnalysisPayload } from "@/lib/risk/data";
import { buildFallbackRiskAnalysisPayload, buildRiskWorkScheduleSummary } from "@/lib/risk/fallback";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) return { title: "Riesgos | MYC Presupuestos" };

  const budget = await getBudgetHeaderById(id, session.user.id);

  return {
    title: budget ? `Riesgos — ${budget.name} | MYC Presupuestos` : "Riesgos | MYC Presupuestos",
    description: budget
      ? `Análisis de riesgo Monte Carlo para ${budget.name}. Simulación probabilística con percentiles, histograma y curva S.`
      : "Análisis de riesgo, simulación Monte Carlo y percentiles para presupuestos de obra.",
    openGraph: {
      title: budget ? `Riesgos — ${budget.name} | MYC Presupuestos` : "Riesgos | MYC Presupuestos",
      description: budget
        ? `Simulación de riesgo probabilística para el presupuesto ${budget.name}.`
        : "Evaluación de riesgos y contingencias en presupuestos de construcción.",
    },
  };
}

export default async function BudgetRiskAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();

  if (!session) {
    notFound();
  }

  const settings = await getUserSettings(session.user.id);
  const license = await getEffectiveUserLicense({ userId: session.user.id });
  if (!hasFeatureAccess(license, "risk_analysis")) {
    return (
      <AppShell currentUser={session.user} settings={settings}>
        <UpgradeCTA
          title="Analisis de riesgo disponible en Pro"
          description="Evalua variables, escenarios y simulaciones con controles trazables para revisar el presupuesto."
          benefits={[
            "Distribucion triangular por partida",
            "Percentiles P10 a P95",
            "Histograma y curva acumulada",
          ]}
        />
      </AppShell>
    );
  }

  const budgetHeader = await getBudgetHeaderById(id, session.user.id);
  if (!budgetHeader) {
    notFound();
  }

  const payload =
    (await getRiskAnalysisPayload(id, session.user.id).catch(async (error: unknown) => {
      // Fall back for any error: RiskBudgetAccessError, Prisma query limits
      // on large budgets, or instanceof failures in Next.js Server Components.
      // The fallback builds items from getBudgetById/getProjectSubBudgetDetails
      // and risk data from getRiskAnalysisFallbackData (which has its own
      // .catch returning empty arrays if the risk tables themselves fail).
      if (process.env.NODE_ENV !== "production") {
        console.warn("[risk-analysis] Fallback activado:", error instanceof Error ? error.message : String(error));
      }

      return buildFallbackRiskAnalysisPayload({
        budgetId: id,
        budgetKind: budgetHeader.kind,
        budgetName: budgetHeader.name,
        currency: budgetHeader.currency,
        projectId: budgetHeader.projectId,
        userId: session.user.id,
      });
    })) ?? null;

  if (!payload) {
    notFound();
  }

  const workScheduleSummary =
    payload.budget.kind === "GENERAL" && hasFeatureAccess(license, "work_schedule.intelligent")
      ? await getWorkScheduleSection(id, session.user.id)
          .then((section) => buildRiskWorkScheduleSummary(section))
          .catch(() => null)
      : null;

  return (
    <AppShell currentUser={session.user} settings={settings}>
      <RiskAnalysisDashboard
        payload={payload}
        currencyDecimals={settings.currencyDecimals}
        workScheduleSummary={workScheduleSummary}
      />
    </AppShell>
  );
}
