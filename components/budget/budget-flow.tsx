import { BudgetEditor } from "@/components/budget/budget-editor";
import { BudgetViewModeProvider } from "@/components/budget/view-mode-provider";

type BudgetFlowProps = React.ComponentProps<typeof BudgetEditor>;

export function BudgetFlow(props: BudgetFlowProps) {
  return (
    <BudgetViewModeProvider>
      <BudgetEditor {...props} />
    </BudgetViewModeProvider>
  );
}
