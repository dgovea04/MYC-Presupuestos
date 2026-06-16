import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { AppShell } from "@/components/layout/app-shell";
import { RiskAnalysisDashboard } from "@/components/risk/risk-analysis-dashboard";
import { getAuthSession } from "@/lib/auth/session";
import { getEffectiveUserLicense, hasFeatureAccess } from "@/lib/billing/entitlements";
import { getUserSettings } from "@/lib/data/settings";
import { getBudgetById } from "@/lib/data/budgets";
import { getRiskAnalysisPayload, RiskBudgetAccessError } from "@/lib/risk/data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) return { title: "Riesgos | MYC Presupuestos" };

  const budget = await getBudgetById(id, session.user.id);

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

  const payload = await getRiskAnalysisPayload(id, session.user.id).catch((error: unknown) => {
    if (error instanceof RiskBudgetAccessError) {
      return null;
    }

    throw error;
  });

  if (!payload) {
    notFound();
  }

  return (
    <AppShell currentUser={session.user} settings={settings}>
      <RiskAnalysisDashboard payload={payload} currencyDecimals={settings.currencyDecimals} />
    </AppShell>
  );
}
