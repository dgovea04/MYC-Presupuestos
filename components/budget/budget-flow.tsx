import { BudgetEditor } from "@/components/budget/budget-editor";
import { BudgetViewModeProvider } from "@/components/budget/view-mode-provider";
import { BudgetCollaborationWrapper } from "@/components/budget/budget-collaboration-wrapper";

type BudgetFlowProps = React.ComponentProps<typeof BudgetEditor>;

export function BudgetFlow(props: BudgetFlowProps) {
  return (
    <BudgetViewModeProvider>
      <BudgetCollaborationWrapper
        budgetId={props.budget.id}
        projectId={props.budget.projectId}
        budgetName={props.budget.name}
      >
        <BudgetEditor {...props} />
      </BudgetCollaborationWrapper>
    </BudgetViewModeProvider>
  );
}
