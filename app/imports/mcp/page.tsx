import { PackageOpen } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { McpImporterPageContent } from "@/components/imports/mcp-importer-page-content";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getUserCompanies } from "@/lib/data/projects";

export default async function McpImportsPage() {
  const session = await getAuthSession();
  const companies = session?.user?.id ? await getUserCompanies(session.user.id) : [];

  return (
    <AppShell currentUser={session?.user}>
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="rounded-2xl bg-[var(--app-surface-elevated)]">
          <PageHeaderCard
            icon={<PackageOpen className="h-5 w-5" />}
            title="Importador .mcp"
            description="Analiza paquetes .mcp de MC Presupuestos y restaura proyectos completos con presupuestos, APUs, formulas y mas."
          />
        </CardHeader>
        <CardContent className="pt-6">
          <McpImporterPageContent companies={companies.map((company) => ({ id: company.id, name: company.name }))} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
