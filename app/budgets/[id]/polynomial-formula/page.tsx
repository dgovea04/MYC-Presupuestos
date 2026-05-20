import { PolynomialFormulaEditor } from "@/components/budget/polynomial-formula-editor";
import { GeneralBudgetSectionShell } from "@/components/budget/general-budget-section-shell";
import { getGeneralBudgetSectionContext } from "@/app/budgets/[id]/section-context";
import {
  getBudgetPolynomialFormulaSectionData,
  listPolynomialFormulaAdjustments,
} from "@/lib/data/polynomial-formulas";

export default async function GeneralBudgetPolynomialFormulaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { budget, currentUser, project, session, settings } = await getGeneralBudgetSectionContext(id);
  const section = await getBudgetPolynomialFormulaSectionData(id, session.user.id);
  const adjustments = section.formula
    ? await listPolynomialFormulaAdjustments(section.formula.id, session.user.id)
    : [];

  return (
    <GeneralBudgetSectionShell
      budgetId={budget.id}
      projectId={project.id}
      budgetName={budget.name}
      projectName={project.name}
      activeSection="polynomial-formula"
      title="Formula polinomica"
      description="Gestiona monomios, indices INEI, coeficiente K y el historial de valorizaciones reajustadas del presupuesto general."
      currentUser={currentUser}
      settings={settings}
    >
      <PolynomialFormulaEditor section={section} adjustments={adjustments} />
    </GeneralBudgetSectionShell>
  );
}
