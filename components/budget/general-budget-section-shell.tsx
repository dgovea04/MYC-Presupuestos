import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { GeneralBudgetSectionTabs } from "@/components/budget/general-budget-section-tabs";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { OperationalPanel } from "@/components/ui/operational-surfaces";

const sections = [
  { id: "resources", label: "Lista de insumos", href: "resources" },
  { id: "work-schedule", label: "Programacion de obra", href: "work-schedule" },
  { id: "general-expenses", label: "Gastos generales", href: "general-expenses" },
  { id: "footer", label: "Pie de presupuesto", href: "footer" },
  { id: "polynomial-formula", label: "Formula polinomica", href: "polynomial-formula" },
] as const;

export function GeneralBudgetSectionShell({
  budgetId,
  projectId,
  budgetName,
  projectName,
  activeSection,
  title,
  description,
  children,
}: {
  budgetId: string;
  projectId: string;
  budgetName: string;
  projectName: string;
  activeSection: (typeof sections)[number]["id"];
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <div className="space-y-5">
        <Card>
          <CardContent className="space-y-4 p-6">
            <OperationalPanel
              title={title}
              description={description}
              metrics={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Presupuesto General</Badge>
                  <Badge className="bg-sky-100 text-sky-700">{projectName}</Badge>
                </div>
              }
              controls={
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                    {budgetName}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/budgets/${budgetId}`}>
                      <ActionButton action="open" label="Volver al presupuesto" variant="outline" />
                    </Link>
                    <Link href={`/projects/${projectId}`}>
                      <ActionButton action="open" label="Ver proyecto" variant="outline" />
                    </Link>
                  </div>
                </div>
              }
            />

            <div className="flex flex-wrap gap-2">
              <GeneralBudgetSectionTabs budgetId={budgetId} activeSection={activeSection} sections={sections} />
            </div>
          </CardContent>
        </Card>

        {children}
      </div>
    </AppShell>
  );
}
