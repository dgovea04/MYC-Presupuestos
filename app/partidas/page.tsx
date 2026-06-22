import { AppShell } from "@/components/layout/app-shell";
import { Rows3 } from "lucide-react";
import { PartidasTable } from "@/components/partidas/partidas-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getCatalogPartidas } from "@/lib/data/partidas";
import { getResourcesByUser } from "@/lib/data/resources";
import { decimalToNumber } from "@/lib/db/serializers";

export default async function PartidasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  const resolvedSearchParams = await searchParams;
  const initialFilter = readSearchParam(resolvedSearchParams.q);
  const [partidas, resources] = await Promise.all([getCatalogPartidas(), getResourcesByUser(session!.user.id)]);

  return (
    <AppShell
      aiContext={{
        route: "/partidas",
        module: "Partidas",
        activeTable: "Catalogo de partidas",
        viewSummary: "Catalogo general de partidas de obra con rendimiento y precios unitarios referenciales.",
      }}
    >
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="flex flex-col gap-4 rounded-2xl bg-[var(--app-surface-elevated)] md:flex-row md:items-start md:justify-between">
          <PageHeaderCard
            icon={<Rows3 className="h-5 w-5" />}
            title="Catalogo de partidas"
            description="Catalogo general precargado para reutilizar partidas de obra, su rendimiento y su tabla de precios unitarios."
          />
        </CardHeader>
        <CardContent className="pt-6">
          <PartidasTable
            partidas={partidas}
            initialFilter={initialFilter}
            resourcesCatalog={resources.map((resource) => ({
              id: resource.id,
              companyId: resource.companyId,
              code: resource.code,
              description: resource.description,
              category: resource.category,
              iu: resource.iu,
              iuCurrent: resource.iuCurrent,
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

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
