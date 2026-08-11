import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { BudgetCollaborationWrapper } from "@/components/budget/budget-collaboration-wrapper";
import { GeneralBudgetSectionTabs } from "@/components/budget/general-budget-section-tabs";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import type { UserSettingsRecord } from "@/types/settings";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getEffectiveWorkspaceLicense, hasFeatureAccess } from "@/lib/workspace/entitlements";

const sections = [
  { id: "resources", label: "Lista de insumos", href: "resources" },
  { id: "general-expenses", label: "Gastos generales", href: "general-expenses" },
  { id: "footer", label: "Pie de presupuesto", href: "footer" },
  { id: "polynomial-formula", label: "Formula polinomica", href: "polynomial-formula" },
  { id: "work-schedule", label: "Programacion de obra", href: "work-schedule" },
] as const;

export async function GeneralBudgetSectionShell({
  budgetId,
  projectId,
  budgetName,
  projectName,
  activeSection,
  title,
  description,
  currentUser,
  settings,
  children,
}: {
  budgetId: string;
  projectId: string;
  budgetName: string;
  projectName: string;
  activeSection: (typeof sections)[number]["id"];
  title: string;
  description: string;
  currentUser?: {
    id?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
    name?: string | null;
    role?: "ADMIN" | "USER" | null;
  };
  settings?: UserSettingsRecord;
  children: React.ReactNode;
}) {
  const activeWorkspaceId = currentUser?.id ? await getActiveWorkspaceId(currentUser.id) : null;
  const license = currentUser?.id
    ? await getEffectiveWorkspaceLicense({ userId: currentUser.id, companyId: activeWorkspaceId })
    : null;
  const canUseCollaboration = hasFeatureAccess(license, "collaboration.realtime");

  return (
    <AppShell currentUser={currentUser} settings={settings}>
      <div className="space-y-5">
        <Card className="theme-surface-card rounded-2xl">
          <CardContent className="space-y-4 p-6">
            <OperationalPanel
              title={title}
              description={description}
              metrics={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Presupuesto General</Badge>
                  <Badge className="theme-status-info">{projectName}</Badge>
                </div>
              }
              controls={
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="theme-filter-button-inactive rounded-full border px-4 py-2 text-sm font-medium">
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

        <BudgetCollaborationWrapper
          budgetId={budgetId}
          projectId={projectId}
          budgetName={budgetName}
          userId={currentUser?.id ?? ""}
          canUseCollaboration={canUseCollaboration}
        >
          {children}
        </BudgetCollaborationWrapper>
      </div>
    </AppShell>
  );
}
