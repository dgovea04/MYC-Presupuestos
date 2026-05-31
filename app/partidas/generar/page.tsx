import { redirect } from "next/navigation";
import { GitCompareArrows } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { PartidaSimilarityGeneratorPageContent } from "@/components/partidas/partida-similarity-generator-page-content";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getEffectiveUserLicense, hasFeatureAccess } from "@/lib/billing/entitlements";
import { getCatalogPartidas } from "@/lib/data/partidas";
import { getResourcesByUser } from "@/lib/data/resources";
import { decimalToNumber } from "@/lib/db/serializers";

export default async function GeneratePartidaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const license = await getEffectiveUserLicense({ userId: session.user.id });

  if (!hasFeatureAccess(license, "partidas.similarity")) {
    return (
      <AppShell currentUser={session.user}>
        <Card className="border-slate-200">
          <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
            <PageHeaderCard
              icon={<GitCompareArrows className="h-5 w-5" />}
              title="Generar partida por similitud"
              description="Crea partidas desde referencias similares con asistencia revisable."
            />
          </CardHeader>
          <CardContent className="pt-6">
            <UpgradeCTA
              title="Generador de partidas disponible en Pro"
              description="Desbloquea busqueda por similitud, sugerencias de insumos y guardado asistido en tu catalogo."
              benefits={[
                "Busqueda por similitud",
                "Insumos sugeridos con trazabilidad",
                "Guardado revisado en catalogo",
              ]}
            />
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const [partidas, resources] = await Promise.all([getCatalogPartidas(), getResourcesByUser(session.user.id)]);

  return (
    <AppShell currentUser={session.user}>
      <Card className="border-slate-200">
        <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <PageHeaderCard
            icon={<GitCompareArrows className="h-5 w-5" />}
            title="Generar partida por similitud"
            description="Flujo semimanual para crear partidas desde fuentes similares, insumos historicos y precios del catalogo."
          />
        </CardHeader>
        <CardContent className="pt-6">
          <PartidaSimilarityGeneratorPageContent
            partidas={partidas}
            initialSourceText={readStringParam(resolvedSearchParams.sourceText) ?? ""}
            initialUnit={readStringParam(resolvedSearchParams.unit) ?? ""}
            initialGeneratedName={readStringParam(resolvedSearchParams.generatedName) ?? ""}
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

function readStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}
