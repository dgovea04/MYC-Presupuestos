import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getResourcesByUser } from "@/lib/data/resources";
import { decimalToNumber } from "@/lib/db/serializers";
import { ResourcesTable } from "@/components/resources/resources-table";
import { ResourceForm } from "@/components/resources/resource-form";
import { getUserCompanies } from "@/lib/data/projects";

export default async function ResourcesPage() {
  const session = await getAuthSession();
  const [resources, companies] = await Promise.all([getResourcesByUser(session!.user.id), getUserCompanies(session!.user.id)]);

  return (
    <AppShell>
      <Card>
        <CardHeader>
          <CardTitle>Catalogo de insumos</CardTitle>
          <CardDescription>Catalogo general precargado para buscar, reutilizar y ampliar insumos de obra.</CardDescription>
        </CardHeader>
        <CardContent>
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
