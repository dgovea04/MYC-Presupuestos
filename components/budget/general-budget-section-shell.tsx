import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { GeneralBudgetSectionTabs } from "@/components/budget/general-budget-section-tabs";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  { id: "resources", label: "Lista de insumos", href: "resources" },
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
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Presupuesto General</Badge>
                  <Badge className="bg-sky-100 text-sky-700">{projectName}</Badge>
                </div>
                <div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/budgets/${budgetId}`}>
                  <ActionButton action="open" label="Volver al presupuesto" variant="outline" />
                </Link>
                <Link href={`/projects/${projectId}`}>
                  <ActionButton action="open" label="Ver proyecto" variant="outline" />
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
              {budgetName}
            </span>
            <GeneralBudgetSectionTabs budgetId={budgetId} activeSection={activeSection} sections={sections} />
          </CardContent>
        </Card>

        {children}
      </div>
    </AppShell>
  );
}
