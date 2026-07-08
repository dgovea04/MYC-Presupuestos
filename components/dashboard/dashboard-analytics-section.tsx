import { getAuthSession } from "@/lib/auth/session";
import { getUserSettings } from "@/lib/data/settings";
import {
  getCostByPhaseAnalytics,
  getBudgetComparison,
  getCostTrends,
  getDeviationAlerts,
} from "@/lib/dashboard/analytics";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";
import { CostByPhaseChart } from "@/components/dashboard/analytics/cost-by-phase-chart";
import { BudgetComparisonChart } from "@/components/dashboard/analytics/budget-comparison-chart";
import { CostTrendsChart } from "@/components/dashboard/analytics/cost-trends-chart";
import { DeviationAlertPanel } from "@/components/dashboard/analytics/deviation-alert-panel";

export async function DashboardAnalyticsSection() {
  const session = await getAuthSession();
  if (!session?.user?.id) return null;

  const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
  const [settings, costByPhase, budgetComparison, costTrends, deviationAlerts] = await Promise.all([
    getUserSettings(session.user.id),
    getCostByPhaseAnalytics(session.user.id, activeWorkspaceId),
    getBudgetComparison(session.user.id, activeWorkspaceId),
    getCostTrends(session.user.id, activeWorkspaceId),
    getDeviationAlerts(session.user.id, activeWorkspaceId),
  ]);

  return (
    <section className="space-y-4">
      <OperationalSectionHeader
        title="Analitica y KPIs"
        description="Metricas avanzadas de presupuestos, tendencias y alertas de desviacion para la toma de decisiones."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <CostByPhaseChart data={costByPhase} currencyDecimals={settings.currencyDecimals} />
        <BudgetComparisonChart data={budgetComparison} currencyDecimals={settings.currencyDecimals} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <CostTrendsChart data={costTrends} />
        <DeviationAlertPanel data={deviationAlerts} currencyDecimals={settings.currencyDecimals} />
      </div>
    </section>
  );
}
