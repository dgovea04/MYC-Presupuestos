import { FileText } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PdfImporterPageContent } from "@/components/imports/pdf-importer-page-content";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getUserCompanies } from "@/lib/data/projects";

export default async function PdfImportsPage() {
  const session = await getAuthSession();
  const companies = session?.user?.id ? await getUserCompanies(session.user.id) : [];

  return (
    <AppShell currentUser={session?.user}>
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="rounded-2xl bg-[var(--app-surface-elevated)]">
          <PageHeaderCard
            icon={<FileText className="h-5 w-5" />}
            title="Importador PDF IA"
            description="Importa presupuestos, APUs y subpartidas desde paquetes PDF variados con previsualizacion, trazabilidad y revision asistida."
          />
        </CardHeader>
        <CardContent className="pt-6">
          <PdfImporterPageContent companies={companies.map((company) => ({ id: company.id, name: company.name }))} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
