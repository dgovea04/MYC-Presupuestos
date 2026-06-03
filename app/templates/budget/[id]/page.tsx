import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ApplyBudgetTemplateButton } from "@/components/templates/apply-budget-template-button";
import { BudgetTemplateDetail } from "@/components/templates/budget-template-detail";
import { CopyBudgetTemplateLinkButton } from "@/components/templates/copy-budget-template-link-button";
import { DeleteBudgetTemplateButton } from "@/components/templates/delete-budget-template-button";
import { DuplicateBudgetTemplateButton } from "@/components/templates/duplicate-budget-template-button";
import { EditBudgetTemplateButton } from "@/components/templates/edit-budget-template-button";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { getAuthSession } from "@/lib/auth/session";
import { getUserBudgetTemplateById } from "@/lib/data/budget-templates";
import { getProjectsListByUser } from "@/lib/data/projects";
import { getUserSettings } from "@/lib/data/settings";

export default async function BudgetTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthSession();
  if (!session) {
    notFound();
  }

  const [template, settings, projects] = await Promise.all([
    getUserBudgetTemplateById(id, session.user.id),
    getUserSettings(session.user.id),
    getProjectsListByUser(session.user.id),
  ]);

  if (!template) {
    notFound();
  }

  const sourceProjectName = projects.find((project) => project.id === template.sourceProjectId)?.name ?? null;

  return (
    <AppShell currentUser={session.user} settings={settings}>
      <Card className="border-slate-200">
        <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <PageHeaderCard
            icon={<BookOpenCheck className="h-5 w-5" />}
            title={template.name}
            description={template.description || "Plantilla capturada desde un presupuesto guardado."}
            actions={
              <>
                <ApplyBudgetTemplateButton
                  templateId={template.id}
                  defaultBudgetName={template.name}
                  projects={projects.map((project) => ({ id: project.id, name: project.name }))}
                />
                <EditBudgetTemplateButton
                  templateId={template.id}
                  initialName={template.name}
                  initialDescription={template.description}
                />
                <DuplicateBudgetTemplateButton
                  templateId={template.id}
                  templateName={template.name}
                  templateDescription={template.description}
                />
                <CopyBudgetTemplateLinkButton templateId={template.id} />
                <DeleteBudgetTemplateButton templateId={template.id} templateName={template.name} />
                <Link href="/templates">
                  <ActionButton action="open" label="Volver a plantillas" variant="outline" />
                </Link>
              </>
            }
          />
        </CardHeader>
        <CardContent className="pt-6">
          <BudgetTemplateDetail
            template={template}
            currencyDecimals={settings.currencyDecimals}
            sourceProjectName={sourceProjectName}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
