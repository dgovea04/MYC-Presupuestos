import { FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Rw7ImporterPageContent } from "@/components/imports/rw7-importer-page-content";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getUserCompanies } from "@/lib/data/projects";

export default async function Rw7ImportsPage() {
  const session = await getAuthSession();
  const companies = session?.user?.id ? await getUserCompanies(session.user.id) : [];

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeaderCard
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="Importador RW7"
          description="Convierte archivos Excel de Sistemas RW7 en proyectos MYC con presupuesto, partidas, APUs e insumos."
        />
        <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
          <CardHeader />
          <CardContent>
            <Rw7ImporterPageContent companies={companies.map((company) => ({ id: company.id, name: company.name }))} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
