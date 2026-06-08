import { FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Rw7ImporterPageContent } from "@/components/imports/rw7-importer-page-content";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getUserCompanies } from "@/lib/data/projects";

export default async function DelphinImportsPage() {
  const session = await getAuthSession();
  const companies = session?.user?.id ? await getUserCompanies(session.user.id) : [];

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeaderCard
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="Importador Delphin Express"
          description="Convierte archivos .dprj de Delphin Express en proyectos MYC con presupuesto, partidas, APUs e insumos."
        />
        <Card>
          <CardHeader />
          <CardContent>
            <Rw7ImporterPageContent
              companies={companies.map((company) => ({ id: company.id, name: company.name }))}
              copy={{
                accept: ".dprj",
                draftEndpoint: "/api/imports/delphin/draft",
                importEndpoint: "/api/imports/delphin/import",
                fileLabel: "Proyecto Delphin Express",
                missingFileMessage: "Selecciona el archivo .dprj exportado desde Delphin Express.",
                noCompaniesMessage: "Crea una empresa antes de importar proyectos Delphin.",
                projectLabel: "Delphin Express",
                sourceCodeLabel: "Presupuesto Delphin",
                uploadDescription: "Lee el contenedor DPRJ serializado de Delphin para generar el draft MYC.",
              }}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
