import { PolynomialFormulaEditor } from "@/components/budget/polynomial-formula-editor";
import { DemoProjectTour } from "@/components/onboarding/demo-project-tour";
import { PolynomialFormulaSectionTabs } from "@/components/budget/polynomial-formula-section-tabs";
import { GeneralBudgetSectionShell } from "@/components/budget/general-budget-section-shell";
import { getGeneralBudgetSectionContext } from "@/app/budgets/[id]/section-context";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getEffectiveWorkspaceLicense, hasFeatureAccess } from "@/lib/workspace/entitlements";
import {
  getBudgetPolynomialFormulaSectionsData,
  getPolynomialFormulaReadOptionsForEnvironment,
  type PolynomialFormulaReadOptions,
} from "@/lib/data/polynomial-formulas";

export default async function GeneralBudgetPolynomialFormulaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const { budget, currentUser, project, session, settings, structuresBudgetId } = await getGeneralBudgetSectionContext(id);
  const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
  const license = await getEffectiveWorkspaceLicense({ userId: session.user.id, companyId: activeWorkspaceId });
  const canUsePolynomialAdjustments = hasFeatureAccess(license, "polynomial_formula.adjustments");
  const showCompositionDetail = Boolean(getPolynomialFormulaReadOptionsForEnvironment().includeCompositionDetail);
  const formulaReadOptions = {
    includeCompositionDetail: true,
  } satisfies PolynomialFormulaReadOptions;

  const sectionsData = await getBudgetPolynomialFormulaSectionsData(
    id,
    session.user.id,
    formulaReadOptions,
    resolvedSearchParams.section,
  );
  const activeSection = sectionsData.activeSection;

  return (
    <GeneralBudgetSectionShell
      budgetId={budget.id}
      projectId={project.id}
      budgetName={budget.name}
      projectName={project.name}
      activeSection="polynomial-formula"
      title={sectionsData.title}
      description={
        sectionsData.hasSubBudgetSections
          ? "Gestiona expresiones K y cuadros de monomios independientes por cada subpresupuesto."
          : "Gestiona monomios, indices INEI, coeficiente K y el historial de valorizaciones reajustadas del presupuesto general."
      }
      currentUser={currentUser}
      settings={settings}
    >
      {project.isDemo ? (
        <DemoProjectTour
          config={{
            projectId: project.id,
            generalBudgetId: budget.id,
            structuresBudgetId: structuresBudgetId,
          }}
        />
      ) : null}
      <div className="space-y-6" data-demo-tour-target="open-formula">
        {sectionsData.hasSubBudgetSections ? (
          <>
            <div className="theme-status-info theme-status-info-strong rounded-2xl border px-4 py-3 text-sm leading-6">
              {sectionsData.notes.join(" ")}
            </div>
            <section className="theme-surface-card rounded-2xl border p-4">
              <PolynomialFormulaSectionTabs
                budgetId={budget.id}
                activeSection={activeSection}
                sections={sectionsData.sections}
              />
            </section>
          </>
        ) : null}
        {activeSection ? (
          <PolynomialFormulaEditor
            key={activeSection.budgetId ?? activeSection.title}
            section={activeSection}
            canUsePolynomialAdjustments={canUsePolynomialAdjustments}
            showCompositionDetail={showCompositionDetail}
          />
        ) : null}
      </div>
    </GeneralBudgetSectionShell>
  );
}
