import { BudgetFooterDocumentSignatureCard } from "@/components/budget/budget-footer-document-signature-card";
import { GeneralBudgetFooterTable } from "@/components/budget/general-budget-footer-table";
import { GeneralBudgetSectionShell } from "@/components/budget/general-budget-section-shell";
import { getGeneralBudgetSectionContext } from "@/app/budgets/[id]/section-context";
import { getBudgetFooterStructure } from "@/lib/data/budgets";
import { getUserAccount } from "@/lib/data/account";
import { getUserCompanies } from "@/lib/data/projects";

export default async function GeneralBudgetFooterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { budget, currentUser, project, session, settings } = await getGeneralBudgetSectionContext(id);
  const [structure, account, companies] = await Promise.all([
    getBudgetFooterStructure(id, session.user.id, settings.currencyDecimals),
    getUserAccount(session.user.id),
    getUserCompanies(session.user.id),
  ]);

  return (
    <GeneralBudgetSectionShell
      budgetId={budget.id}
      projectId={project.id}
      budgetName={budget.name}
      projectName={project.name}
      activeSection="footer"
      title="Pie de presupuesto"
      description="Constructor libre del pie de presupuesto general, conectado a variables y formulas editables."
      currentUser={currentUser}
      settings={settings}
    >
      <GeneralBudgetFooterTable
        budgetId={budget.id}
        currency={budget.currency}
        currencyDecimals={settings.currencyDecimals}
        generalExpensesRate={budget.generalExpensesRate}
        utilityRate={budget.utilityRate}
        igvRate={budget.igvRate}
        initialStructure={structure}
      />
      <BudgetFooterDocumentSignatureCard
        budgetName={budget.name}
        projectName={project.name}
        clientName={project.clientName}
        location={project.location}
        responsible={{
          companyName: companies[0]?.name ?? null,
          name: account.name,
          jobTitle: account.jobTitle,
          phone: account.phone,
          email: account.email,
        }}
      />
    </GeneralBudgetSectionShell>
  );
}
