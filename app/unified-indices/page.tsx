import { Network } from "lucide-react";

import { UnifiedIndexRelationsPageContent } from "@/components/unified-indices/unified-index-relations-page-content";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getUnifiedIndexRelationRows } from "@/lib/data/unified-indices";

export default async function UnifiedIndicesPage() {
  const session = await getAuthSession();
  const rows = await getUnifiedIndexRelationRows(session!.user.id);

  return (
    <AppShell>
      <Card className="border-[var(--app-border-soft)] bg-[var(--app-surface)]">
        <CardHeader className="flex flex-col gap-4 rounded-2xl bg-[var(--app-surface-elevated)] md:flex-row md:items-start md:justify-between">
          <PageHeaderCard
            icon={<Network className="h-5 w-5" />}
            title="Relacion Indices Unificados (IU)"
            description="Relacion oficial de codigos IU disponibles en la base de formula polinomica, enriquecida con el conteo de insumos visibles en el catalogo."
          />
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <UnifiedIndexRelationsPageContent rows={rows} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
