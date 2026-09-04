import { Database } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DbImporterPageContent } from "@/components/imports/db-importer-page-content";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getUserCompanies } from "@/lib/data/projects";
import { isLocalServerRuntimeEnabled } from "@/lib/runtime/local-capabilities";

export default async function DbImportsPage() {
  const session = await getAuthSession();
  const companies = session?.user?.id ? await getUserCompanies(session.user.id) : [];
  const localToolsEnabled = isLocalServerRuntimeEnabled();

  return (
    <AppShell currentUser={session?.user}>
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="rounded-2xl bg-[var(--app-surface-elevated)]">
          <PageHeaderCard
            icon={<Database className="h-5 w-5" />}
            title="Importador .db"
            description="Importa proyectos, partidas, recursos y APUs desde bases SQLite compatibles mediante archivo o ruta local."
          />
        </CardHeader>
        <CardContent className="pt-6">
          <DbImporterPageContent
            companies={companies.map((company) => ({ id: company.id, name: company.name }))}
            localToolsEnabled={localToolsEnabled}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
