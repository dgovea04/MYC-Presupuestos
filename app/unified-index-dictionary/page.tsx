import { BookOpen } from "lucide-react";

import { UnifiedIndexDictionaryPageContent } from "@/components/unified-indices/unified-index-dictionary-page-content";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getUnifiedIndexDictionaryRows } from "@/lib/data/unified-indices";

export default async function UnifiedIndexDictionaryPage() {
  const rows = await getUnifiedIndexDictionaryRows();

  return (
    <AppShell>
      <Card className="border-slate-200">
        <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <PageHeaderCard
            icon={<BookOpen className="h-5 w-5" />}
            title="Diccionario alfabetico de indices unificados"
            description="Lectura alfabetica oficial de elementos e indices IU para consulta transversal dentro del flujo tecnico del sistema."
          />
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <UnifiedIndexDictionaryPageContent rows={rows} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
