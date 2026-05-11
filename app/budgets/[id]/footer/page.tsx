import { GeneralBudgetPlaceholderSection } from "@/components/budget/general-budget-placeholder-section";
import { GeneralBudgetFooterTable } from "@/components/budget/general-budget-footer-table";
import { GeneralBudgetSectionShell } from "@/components/budget/general-budget-section-shell";
import { getGeneralBudgetSectionContext } from "@/app/budgets/[id]/section-context";
import { getBudgetFooterStructure } from "@/lib/data/budgets";
import type { BudgetFooterDraft } from "@/types/budget-sections";

const budgetFooterDraft: BudgetFooterDraft = {
  title: "Siguientes ampliaciones",
  sections: [
    {
      title: "Plantillas reutilizables",
      detail: "Espacio reservado para guardar y reutilizar configuraciones de pie de presupuesto entre proyectos similares.",
    },
    {
      title: "Firmas y aprobaciones",
      detail: "Bloque previsto para futuras firmas, responsables, vigencia y metadatos de cierre documental.",
    },
    {
      title: "Exportacion enriquecida",
      detail: "Zona preparada para conectar reglas de formato, resaltados y salida final a Excel o PDF.",
    },
  ],
};

export default async function GeneralBudgetFooterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { budget, project, session } = await getGeneralBudgetSectionContext(id);
  const structure = await getBudgetFooterStructure(id, session.user.id);

  return (
    <GeneralBudgetSectionShell
      budgetId={budget.id}
      projectId={project.id}
      budgetName={budget.name}
      projectName={project.name}
      activeSection="footer"
      title="Pie de presupuesto"
      description="Constructor libre del pie de presupuesto general, conectado a variables y formulas editables."
    >
      <GeneralBudgetFooterTable
        budgetId={budget.id}
        initialStructure={structure}
      />
      <GeneralBudgetPlaceholderSection
        title={budgetFooterDraft.title}
        description="Estas tarjetas mantienen visible el roadmap cercano del modulo mientras el constructor principal ya queda operativo."
        highlights={budgetFooterDraft.sections}
      />
    </GeneralBudgetSectionShell>
  );
}
