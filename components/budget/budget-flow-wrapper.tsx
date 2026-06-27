import { BudgetFlow } from "@/components/budget/budget-flow";
import type { BudgetTemplateCreationTraceability } from "@/lib/data/activity-events";
import type { BudgetRecord } from "@/types/budget";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

export function BudgetFlowWrapper({
  budget,
  projectName,
  templateTraceability,
  partidasCatalog,
  resourcesCatalog,
}: {
  budget: BudgetRecord;
  projectName?: string;
  templateTraceability?: BudgetTemplateCreationTraceability | null;
  partidasCatalog: CatalogPartidaRecord[];
  resourcesCatalog: ResourceRecord[];
}) {
  return (
    <BudgetFlow
      budget={budget}
      projectName={projectName}
      templateTraceability={templateTraceability}
      partidasCatalog={partidasCatalog}
      resourcesCatalog={resourcesCatalog}
    />
  );
}
