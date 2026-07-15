import Script from "next/script";
import { getGeneralBudgetSectionContext } from "@/app/budgets/[id]/section-context";
import { UpgradeCTA } from "@/components/billing/upgrade-cta";
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
  const hasAccess = hasFeatureAccess(license, "work_schedule.intelligent");
  const section = hasAccess ? await getWorkScheduleOverviewSection(id, session.user.id) : null;

  return (
    <>
      <Script
        id="work-schedule-overview-width-bootstrap"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(){var w=localStorage.getItem('work-schedule-overview-timeline-panel-width:${id}');if(w){document.documentElement.style.setProperty('--work-schedule-timeline-panel-width',w+'px');}})()`,
        }}
      />
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
      {section ? (
        <WorkSchedulePageContent initialData={section} />
      ) : (
        <UpgradeCTA
          title="Cronograma inteligente disponible en Pro"
          description="Activa programacion de obra, calendario valorizado, calendario de insumos y Curva S desde el presupuesto."
          benefits={[
            "Programacion por partidas",
            "Calendario valorizado e insumos por periodo",
            "Curva S y ruta critica",
          ]}
        />
      )}
    </GeneralBudgetSectionShell>
    </>
  );
}
