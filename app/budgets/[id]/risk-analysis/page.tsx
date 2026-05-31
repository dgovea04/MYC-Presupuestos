import { notFound } from "next/navigation";

import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { AppShell } from "@/components/layout/app-shell";
import { RiskAnalysisDashboard } from "@/components/risk/risk-analysis-dashboard";
import { getAuthSession } from "@/lib/auth/session";
import { getEffectiveUserLicense, hasFeatureAccess } from "@/lib/billing/entitlements";
import { getUserSettings } from "@/lib/data/settings";
import { getRiskAnalysisPayload, RiskBudgetAccessError } from "@/lib/risk/data";

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
