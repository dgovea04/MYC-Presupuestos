import { PolynomialFormulaEditor } from "@/components/budget/polynomial-formula-editor";
import { GeneralBudgetSectionShell } from "@/components/budget/general-budget-section-shell";
import { getGeneralBudgetSectionContext } from "@/app/budgets/[id]/section-context";
import { getEffectiveUserLicense, hasFeatureAccess } from "@/lib/billing/entitlements";
import {
  getBudgetPolynomialFormulaSectionsData,
  getPolynomialFormulaReadOptionsForEnvironment,
  listPolynomialFormulaAdjustments,
} from "@/lib/data/polynomial-formulas";

export default async function GeneralBudgetPolynomialFormulaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { budget, currentUser, project, session, settings } = await getGeneralBudgetSectionContext(id);
  const license = await getEffectiveUserLicense({ userId: session.user.id });
  const canUsePolynomialAdjustments = hasFeatureAccess(license, "polynomial_formula.adjustments");
  const formulaReadOptions = getPolynomialFormulaReadOptionsForEnvironment();
  const showCompositionDetail = Boolean(formulaReadOptions.includeCompositionDetail);

  const sectionsData = await getBudgetPolynomialFormulaSectionsData(id, session.user.id, formulaReadOptions);
  const sectionAdjustments = await Promise.all(
    sectionsData.sections.map(async (section) => ({
      budgetId: section.budgetId,
      adjustments: section.formula && canUsePolynomialAdjustments
        ? await listPolynomialFormulaAdjustments(section.formula.id, session.user.id)
        : [],
    })),
  );
  const adjustmentsByBudgetId = new Map(
    sectionAdjustments.map((entry) => [entry.budgetId, entry.adjustments]),
  );

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
      <div className="space-y-6">
        {sectionsData.hasSubBudgetSections ? (
          <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-sky-900">
            {sectionsData.notes.join(" ")}
          </div>
        ) : null}
        {sectionsData.sections.map((section) => (
          <PolynomialFormulaEditor
            key={section.budgetId ?? section.title}
            section={section}
            adjustments={adjustmentsByBudgetId.get(section.budgetId) ?? []}
            canUsePolynomialAdjustments={canUsePolynomialAdjustments}
            showCompositionDetail={showCompositionDetail}
          />
        ))}
      </div>
    </GeneralBudgetSectionShell>
  );
}
