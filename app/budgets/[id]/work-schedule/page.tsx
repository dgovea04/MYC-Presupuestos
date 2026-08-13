import { getGeneralBudgetSectionContext } from "@/app/budgets/[id]/section-context";
import { GeneralBudgetSectionShell } from "@/components/budget/general-budget-section-shell";
import { WorkSchedulePageContent } from "@/components/budget/work-schedule-page-content";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getEffectiveWorkspaceLicense, hasFeatureAccess } from "@/lib/workspace/entitlements";
import { getWorkScheduleOverviewSection } from "@/lib/data/work-schedule";

export default async function WorkSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { budget, currentUser, project, session, settings } = await getGeneralBudgetSectionContext(id);
  const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
  const license = await getEffectiveWorkspaceLicense({ userId: session.user.id, companyId: activeWorkspaceId });
  const canUseIntelligentSchedule = hasFeatureAccess(license, "work_schedule.intelligent");
  const section = await getWorkScheduleOverviewSection(id, session.user.id);

  return (
    <GeneralBudgetSectionShell
      budgetId={budget.id}
      projectId={project.id}
      budgetName={budget.name}
      projectName={project.name}
      activeSection="work-schedule"
      title="Programacion de obra"
      description="Cronograma consolidado del proyecto con calendario valorizado, insumos por periodo y curva S basica."
      currentUser={currentUser}
      settings={settings}
    >
      <WorkSchedulePageContent
        initialData={section}
        canUseIntelligentSchedule={canUseIntelligentSchedule}
      />
    </GeneralBudgetSectionShell>
  );
}
