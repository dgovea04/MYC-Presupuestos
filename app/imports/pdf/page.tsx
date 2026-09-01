import { FileText } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { PdfImporterPageContent } from "@/components/imports/pdf-importer-page-content";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getUserCompanies } from "@/lib/data/projects";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getEffectiveWorkspaceLicense, hasFeatureAccess } from "@/lib/workspace/entitlements";

export default async function PdfImportsPage() {
  const session = await getAuthSession();
  const activeWorkspaceId = session?.user?.id ? await getActiveWorkspaceId(session.user.id) : null;
  const license = session?.user?.id
    ? await getEffectiveWorkspaceLicense({ userId: session.user.id, companyId: activeWorkspaceId })
    : null;
  const companies = session?.user?.id ? await getUserCompanies(session.user.id) : [];

  const pageHeader = (
    <PageHeaderCard
      icon={<FileText className="h-5 w-5" />}
      title="Importador PDF IA"
      description="Importa presupuestos, APUs y subpartidas desde paquetes PDF variados con previsualizacion, trazabilidad y revision asistida."
    />
  );

  return (
    <AppShell currentUser={session?.user}>
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="rounded-2xl bg-[var(--app-surface-elevated)]">
          {pageHeader}
        </CardHeader>
        <CardContent className="pt-6">
          {hasFeatureAccess(license, "ai.pdf") ? (
            <PdfImporterPageContent companies={companies.map((company) => ({ id: company.id, name: company.name }))} />
          ) : (
            <UpgradeCTA
              title="Importador PDF IA disponible en Pro"
              description="Desbloquea la extracción asistida de presupuestos, APUs y subpartidas desde archivos PDF, con revisión y trazabilidad antes de importar."
              benefits={["Extracción de presupuestos desde PDF", "Lectura asistida de APUs y subpartidas", "Draft revisable antes de importar"]}
            />
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
