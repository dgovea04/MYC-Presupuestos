import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { AppShell } from "@/components/layout/app-shell";
import { RiskAnalysisDashboard } from "@/components/risk/risk-analysis-dashboard";
import { getAuthSession } from "@/lib/auth/session";
import { getEffectiveUserLicense, hasFeatureAccess } from "@/lib/billing/entitlements";
import { getUserSettings } from "@/lib/data/settings";
import { getWorkScheduleSection } from "@/lib/data/work-schedule";
import { getBudgetById, getBudgetHeaderById, getProjectSubBudgetDetails } from "@/lib/data/budgets";
import { getRiskAnalysisPayload, RiskBudgetAccessError } from "@/lib/risk/data";
import type { RiskAnalysisPayload, RiskWorkScheduleSummary } from "@/types/risk";

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
      if (error instanceof RiskBudgetAccessError) {
        return buildFallbackRiskAnalysisPayload({
          budgetId: id,
          budgetKind: budgetHeader.kind,
          budgetName: budgetHeader.name,
          currency: budgetHeader.currency,
          projectId: budgetHeader.projectId,
          userId: session.user.id,
        });
      }

      throw error;
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

async function buildFallbackRiskAnalysisPayload(input: {
  budgetId: string;
  budgetKind: "GENERAL" | "SUB_BUDGET";
  budgetName: string;
  currency: string;
  projectId: string;
  userId: string;
}): Promise<RiskAnalysisPayload | null> {
  const items =
    input.budgetKind === "GENERAL"
      ? (await getProjectSubBudgetDetails(input.projectId, input.userId)).flatMap((budget) =>
          budget.items.map((item) => ({
            itemId: item.id,
            budgetId: budget.id,
            sourceBudgetName: budget.name,
            code: item.code,
            description: item.description,
            unit: item.unit,
            baseQuantity: item.quantity,
            unitPrice: item.unitPrice,
            baseTotal: item.partial,
            updatedAt: new Date(0).toISOString(),
          })),
        )
      : ((await getBudgetById(input.budgetId, input.userId))?.items.map((item) => ({
          itemId: item.id,
          budgetId: input.budgetId,
          sourceBudgetName: input.budgetName,
          code: item.code,
          description: item.description,
          unit: item.unit,
          baseQuantity: item.quantity,
          unitPrice: item.unitPrice,
          baseTotal: item.partial,
          updatedAt: new Date(0).toISOString(),
        })) ?? []);

  return {
    budget: {
      id: input.budgetId,
      projectId: input.projectId,
      name: input.budgetName,
      kind: input.budgetKind,
      currency: input.currency,
      baseTotal: items.reduce((total, item) => total + item.baseTotal, 0),
    },
    items,
    variables: [],
    correlations: [],
    latestRun: null,
  };
}

function buildRiskWorkScheduleSummary(
  section: Awaited<ReturnType<typeof getWorkScheduleSection>>,
): RiskWorkScheduleSummary {
  return {
    budgetId: section.budgetId,
    budgetName: section.budgetName,
    currency: section.currency,
    timeline: section.timeline,
    criticalPath: section.criticalPath ?? null,
    generationSummary: section.generationSummary
      ? {
          generatedCount: section.generationSummary.generatedCount,
          pendingCount: section.generationSummary.pendingCount,
        }
      : null,
    criticalItems: section.groups.flatMap((group) =>
      group.lines
        .filter((line) => line.criticalPath?.isCritical)
        .map((line) => ({
          budgetItemId: line.budgetItemId,
          itemCode: line.itemCode,
          description: line.description,
          subBudgetName: line.subBudgetName,
          partial: line.partial,
          durationDays: line.durationDays ?? null,
          startDate: line.startDate ?? null,
          endDate: line.endDate ?? null,
        })),
    ),
    simulationLines: section.groups.flatMap((group) =>
      group.lines.flatMap((line) =>
        line.durationDays && line.durationDays > 0
          ? [
              {
                budgetItemId: line.budgetItemId,
                itemCode: line.itemCode,
                description: line.description,
                durationDays: line.durationDays,
                predecessor: line.predecessor ?? null,
                subBudgetName: line.subBudgetName,
              },
            ]
          : [],
      ),
    ),
  };
}
