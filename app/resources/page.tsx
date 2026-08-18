import { AppShell } from "@/components/layout/app-shell";
import { ExportPanel } from "@/components/exports/export-panel";
import { Wrench } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getResourcesByUser } from "@/lib/data/resources";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { decimalToNumber } from "@/lib/db/serializers";
import { ResourcesPageContent } from "@/components/resources/resources-page-content";
import { getUserCompanies } from "@/lib/data/projects";
import { getUnifiedIndexDictionaryRows, getUnifiedIndexRelationRows } from "@/lib/data/unified-indices";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getExportDefinition } from "@/lib/exports/definitions";

export default async function ResourcesPage() {
  const session = await getAuthSession();
  const activeWorkspaceId = await getActiveWorkspaceId(session!.user.id);
  const [resources, companies, unifiedIndexDictionaryRows, unifiedIndexRows] = await Promise.all([
    getResourcesByUser(session!.user.id, activeWorkspaceId),
    getUserCompanies(session!.user.id),
    getUnifiedIndexDictionaryRows(),
    getUnifiedIndexRelationRows(session!.user.id),
  ]);

  return (
    <AppShell
      currentUser={session!.user}
      aiContext={{
        route: "/resources",
        module: "Recursos",
        activeTable: "Catalogo de insumos",
        viewSummary: "Catalogo general de insumos para buscar, reutilizar y ampliar recursos de obra.",
      }}
    >
      <Card className="theme-surface-card rounded-2xl">
        <CardHeader className="theme-surface-card-gradient flex flex-col gap-4 rounded-2xl md:flex-row md:items-start md:justify-between">
          <PageHeaderCard
            icon={<Wrench className="h-5 w-5" />}
            title="Catalogo de insumos"
            description="Catalogo general precargado para buscar, reutilizar y ampliar insumos de obra."
          />
          <ExportPanel
            buttonLabel="Exportar catalogo"
            defaultPreset="catalogo_insumos"
            definition={getExportDefinition("resources")}
            targetId="catalog"
          />
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <ResourcesPageContent
            companyId={companies[0]?.id}
            unifiedIndexDictionaryRows={unifiedIndexDictionaryRows}
            unifiedIndexRows={unifiedIndexRows}
            resources={resources.map((resource) => ({
              id: resource.id,
              companyId: resource.companyId,
              code: resource.code,
              description: resource.description,
              category: resource.category,
              iu: resource.iu,
              iuCurrent: resource.iuCurrent,
              iuCurrentReviewStatus: resource.iuCurrentReviewStatus,
              subcategory: resource.subcategory,
              unit: resource.unit,
              unitPrice: decimalToNumber(resource.unitPrice),
              currency: resource.currency,
              source: resource.source,
              priceUpdatedAt: resource.priceUpdatedAt,
              priceObservedAt: resource.priceObservedAt,
              priceSource: resource.priceSource,
              priceSyncStatus: resource.priceSyncStatus,
            }))}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
