import { AppShell } from "@/components/layout/app-shell";
import { Rows3 } from "lucide-react";
import { PartidasTable } from "@/components/partidas/partidas-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getCatalogPartidas } from "@/lib/data/partidas";
import { getResourcesByUser } from "@/lib/data/resources";
import { decimalToNumber } from "@/lib/db/serializers";

export default async function PartidasPage() {
  const session = await getAuthSession();
  const [partidas, resources] = await Promise.all([getCatalogPartidas(), getResourcesByUser(session!.user.id)]);

  return (
    <AppShell>
      <Card className="border-slate-200">
        <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <PageHeaderCard
            icon={<Rows3 className="h-5 w-5" />}
            title="Catalogo de partidas"
            description="Catalogo general precargado para reutilizar partidas de obra, su rendimiento y su tabla de precios unitarios."
          />
        </CardHeader>
        <CardContent className="pt-6">
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
