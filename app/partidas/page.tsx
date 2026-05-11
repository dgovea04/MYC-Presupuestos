import { AppShell } from "@/components/layout/app-shell";
import { PartidasTable } from "@/components/partidas/partidas-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getCatalogPartidas } from "@/lib/data/partidas";
import { getResourcesByUser } from "@/lib/data/resources";
import { decimalToNumber } from "@/lib/db/serializers";

export default async function PartidasPage() {
  const session = await getAuthSession();
  const [partidas, resources] = await Promise.all([getCatalogPartidas(), getResourcesByUser(session!.user.id)]);

  return (
    <AppShell>
      <Card>
        <CardHeader>
          <CardTitle>Catalogo de partidas</CardTitle>
          <CardDescription>
            Catalogo general precargado para reutilizar partidas de obra, su rendimiento y su tabla de precios unitarios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PartidasTable
            partidas={partidas}
            resourcesCatalog={resources.map((resource) => ({
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
