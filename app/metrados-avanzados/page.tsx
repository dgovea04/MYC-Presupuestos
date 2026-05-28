import { redirect } from "next/navigation";
import { Ruler } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { MetradosDashboard } from "@/components/metrados/MetradosDashboard";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import {
  listMetradoCreationOptions,
  listMetradoSheetsByUser,
} from "@/lib/data/metrados";

export default async function MetradosAvanzadosPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  const [initialSheets, creationOptions] = await Promise.all([
    listMetradoSheetsByUser(session.user.id),
    listMetradoCreationOptions(session.user.id),
  ]);

  return (
    <AppShell currentUser={session.user}>
      <Card className="border-slate-200">
        <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <PageHeaderCard
            className="w-full"
            icon={<Ruler className="h-5 w-5" />}
            title="Metrados avanzados"
            description="Crea hojas de quantity takeoff con formulas, validaciones y vinculo directo a partidas del presupuesto."
          />
        </CardHeader>
        <CardContent className="pt-6">
          <MetradosDashboard
            initialSheets={initialSheets}
            projects={creationOptions.projects}
            budgets={creationOptions.budgets}
            partidas={creationOptions.partidas}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
