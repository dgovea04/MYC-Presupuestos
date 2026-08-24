import { redirect } from "next/navigation";
import { Ruler } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { MetradosDashboard } from "@/components/metrados/MetradosDashboard";
import { parseMetradoTemplateTypeParam } from "@/components/metrados/metrado-view-model";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getEffectiveWorkspaceLicense, hasFeatureAccess } from "@/lib/workspace/entitlements";
import {
  listCustomMetradoFormulas,
  listMetradoCreationOptions,
  listMetradoSheetsByUser,
  listMetradoTemplates,
} from "@/lib/data/metrados";

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function MetradosAvanzadosPage({
  searchParams,
}: {
  searchParams?: Promise<{ template?: string | string[]; projectId?: string | string[]; budgetId?: string | string[]; itemId?: string | string[] }>;
}) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
  const license = await getEffectiveWorkspaceLicense({ userId: session.user.id, companyId: activeWorkspaceId });
  if (!hasFeatureAccess(license, "metrados.advanced")) {
    return (
      <AppShell currentUser={session.user}>
        <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
          <CardHeader className="rounded-2xl bg-[var(--app-surface-elevated)]">
            <PageHeaderCard
              icon={<Ruler className="h-5 w-5" />}
              title="Metrados avanzados"
              description="Crea hojas de quantity takeoff con formulas, validaciones y vinculo directo a partidas del presupuesto."
            />
          </CardHeader>
          <CardContent className="pt-6">
            <UpgradeCTA
              title="Metrados avanzados disponibles en Pro"
              description="Desbloquea hojas de quantity takeoff, formulas, validaciones e integración directa con tus partidas."
              benefits={["Hojas de metrados vinculadas", "Formulas y validaciones", "Exportación y envío a partidas"]}
            />
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const resolvedSearchParams = await searchParams;
  const templateParam = Array.isArray(resolvedSearchParams?.template)
    ? resolvedSearchParams?.template[0]
    : resolvedSearchParams?.template;
  const initialTemplateType = parseMetradoTemplateTypeParam(templateParam);
  const initialContext = {
    projectId: readSearchParam(resolvedSearchParams?.projectId),
    budgetId: readSearchParam(resolvedSearchParams?.budgetId),
    itemId: readSearchParam(resolvedSearchParams?.itemId),
  };

  const [initialSheets, creationOptions, customFormulas, templates] = await Promise.all([
    listMetradoSheetsByUser(session.user.id, { includeInactive: true }),
    listMetradoCreationOptions(session.user.id),
    listCustomMetradoFormulas(session.user.id),
    listMetradoTemplates(),
  ]);

  return (
    <AppShell currentUser={session.user}>
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="flex flex-col gap-4 rounded-2xl bg-[var(--app-surface-elevated)] md:flex-row md:items-start md:justify-between">
          <PageHeaderCard
            className="w-full"
            icon={<Ruler className="h-5 w-5" />}
            title="Metrados avanzados"
            description="Crea hojas de quantity takeoff con formulas, validaciones y vinculo directo a partidas del presupuesto."
          />
        </CardHeader>
        <CardContent className="pt-6">
          <MetradosDashboard
            initialSheets={initialSheets}
            projects={creationOptions.projects}
            budgets={creationOptions.budgets}
            partidas={creationOptions.partidas}
            customFormulas={customFormulas}
            initialTemplateType={initialTemplateType}
            templates={templates}
            initialContext={initialContext}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
