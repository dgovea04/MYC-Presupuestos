import { AppShell } from "@/components/layout/app-shell";
import { Wrench } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getResourcesByUser } from "@/lib/data/resources";
import { decimalToNumber } from "@/lib/db/serializers";
import { ResourcesTable } from "@/components/resources/resources-table";
import { ResourceForm } from "@/components/resources/resource-form";
import { getUserCompanies } from "@/lib/data/projects";
import { PageHeaderCard } from "@/components/ui/page-header-card";

export default async function ResourcesPage() {
  const session = await getAuthSession();
  const [resources, companies] = await Promise.all([getResourcesByUser(session!.user.id), getUserCompanies(session!.user.id)]);

  return (
    <AppShell>
      <Card className="border-slate-200">
        <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <PageHeaderCard
            icon={<Wrench className="h-5 w-5" />}
            title="Catalogo de insumos"
            description="Catalogo general precargado para buscar, reutilizar y ampliar insumos de obra."
          />
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="mb-6">
            <ResourceForm companyId={companies[0]?.id} />
          </div>
          <ResourcesTable
            companyId={companies[0]?.id}
            resources={resources.map((resource) => ({
              id: resource.id,
              companyId: resource.companyId,
              code: resource.code,
              description: resource.description,
              category: resource.category,
              iu: resource.iu,
              subcategory: resource.subcategory,
              unit: resource.unit,
              unitPrice: decimalToNumber(resource.unitPrice),
              currency: resource.currency,
              source: resource.source,
            }))}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
