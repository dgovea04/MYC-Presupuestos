import { getGeneralBudgetSectionContext } from "@/app/budgets/[id]/section-context";
import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { GeneralBudgetSectionShell } from "@/components/budget/general-budget-section-shell";
import { WorkSchedulePageContent } from "@/components/budget/work-schedule-page-content";
import { getEffectiveUserLicense, hasFeatureAccess } from "@/lib/billing/entitlements";
import { getWorkScheduleOverviewSection } from "@/lib/data/work-schedule";

export default async function WorkSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { budget, currentUser, project, session, settings } = await getGeneralBudgetSectionContext(id);
  const license = await getEffectiveUserLicense({ userId: session.user.id });
  const hasAccess = hasFeatureAccess(license, "work_schedule.intelligent");
  const section = hasAccess ? await getWorkScheduleOverviewSection(id, session.user.id) : null;

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
  );
}
