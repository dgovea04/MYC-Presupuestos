import { DatabaseZap } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { S10ImporterPageContent } from "@/components/imports/s10-importer-page-content";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getUserCompanies } from "@/lib/data/projects";

export default async function S10ImportsPage() {
  const session = await getAuthSession();
  const companies = await getUserCompanies(session!.user.id);

  return (
    <AppShell currentUser={session!.user}>
      <Card className="border-slate-200">
        <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <PageHeaderCard
            icon={<DatabaseZap className="h-5 w-5" />}
            title="Importador S10"
            description="Analiza respaldos .s2k y revisa el draft de presupuestos, partidas, APUs e insumos antes de crear datos en MYC."
          />
        </CardHeader>
        <CardContent className="pt-6">
          <S10ImporterPageContent companies={companies.map((company) => ({ id: company.id, name: company.name }))} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
