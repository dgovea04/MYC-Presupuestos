import { BookOpen } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { TemplateLibraryPageContent } from "@/components/templates/template-library-page-content";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getEffectiveWorkspaceLicense, hasFeatureAccess } from "@/lib/workspace/entitlements";
import { listTemplateLibraryActivityEvents } from "@/lib/data/activity-events";
import { listUserBudgetTemplates } from "@/lib/data/budget-templates";
import { getTemplateLibrarySummary, listTemplateLibraryItems } from "@/lib/templates/template-library";
import type { TemplateLibraryModule, TemplateLibrarySource } from "@/lib/templates/template-library";

type TemplateSortOption = "DEFAULT" | "NAME_ASC" | "UPDATED_DESC";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ module?: string; source?: string; q?: string; sort?: string }>;
}) {
  const session = await getAuthSession();
  const resolvedSearchParams = (await searchParams) ?? {};
  const activeWorkspaceId = await getActiveWorkspaceId(session!.user.id);
  const license = await getEffectiveWorkspaceLicense({ userId: session!.user.id, companyId: activeWorkspaceId });
  if (!hasFeatureAccess(license, "templates.budget")) {
    return (
      <AppShell currentUser={session!.user}>
        <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
          <CardHeader className="rounded-2xl bg-[var(--app-surface-elevated)]">
            <PageHeaderCard
              icon={<BookOpen className="h-5 w-5" />}
              title="Plantillas"
              description="Biblioteca base para reutilizar estructuras tecnicas de presupuestos, APU, gastos generales, metrados y cierre documental."
            />
          </CardHeader>
          <CardContent className="pt-6">
            <UpgradeCTA
              title="Plantillas disponibles en Pro"
              description="Guarda y reutiliza estructuras técnicas, partidas, APU y criterios documentales sin reconstruir tu flujo."
              benefits={["Biblioteca de presupuestos", "Reutilización de estructuras y APU", "Aplicación rápida en nuevos proyectos"]}
            />
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const [userTemplates, activityEvents] = await Promise.all([
    listUserBudgetTemplates(session!.user.id),
    listTemplateLibraryActivityEvents({ userId: session!.user.id }),
  ]);
  const items = listTemplateLibraryItems(userTemplates.map((template) => template.libraryItem));
  const summary = getTemplateLibrarySummary(items);
  const initialFilters = {
    module: readTemplateModuleFilter(resolvedSearchParams.module),
    source: readTemplateSourceFilter(resolvedSearchParams.source),
    query: resolvedSearchParams.q ?? "",
    sort: readTemplateSortOption(resolvedSearchParams.sort),
  };

  return (
    <AppShell currentUser={session!.user}>
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="flex flex-col gap-4 rounded-2xl bg-[var(--app-surface-elevated)] md:flex-row md:items-start md:justify-between">
          <PageHeaderCard
            icon={<BookOpen className="h-5 w-5" />}
            title="Plantillas"
            description="Biblioteca base para reutilizar estructuras tecnicas de presupuestos, APU, gastos generales, metrados y cierre documental."
          />
        </CardHeader>
        <CardContent className="pt-6">
          <TemplateLibraryPageContent
            items={items}
            summary={summary}
            activityEvents={activityEvents}
            initialFilters={initialFilters}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}

function readTemplateModuleFilter(value: string | undefined): TemplateLibraryModule | "ALL" {
  if (
    value === "BUDGET" ||
    value === "APU" ||
    value === "GENERAL_EXPENSES" ||
    value === "METRADOS" ||
    value === "FOOTER"
  ) {
    return value;
  }

  return "ALL";
}

function readTemplateSourceFilter(value: string | undefined): TemplateLibrarySource | "ALL" {
  if (value === "SYSTEM" || value === "WORKBOOK" || value === "USER") {
    return value;
  }

  return "ALL";
}

function readTemplateSortOption(value: string | undefined): TemplateSortOption {
  if (value === "NAME_ASC" || value === "UPDATED_DESC") {
    return value;
  }

  return "DEFAULT";
}
