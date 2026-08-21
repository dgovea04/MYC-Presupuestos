import Link from "next/link";
import type { Metadata } from "next";
import { Building2, FolderKanban } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextBadge, ProjectStatusBadge } from "@/components/ui/context-badges";
import { InfoCard } from "@/components/ui/info-cards";
import { ExportPanel } from "@/components/exports/export-panel";
import { getExportDefinition } from "@/lib/exports/definitions";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { ProjectAttachmentUpload } from "@/components/projects/project-attachment-upload";
import { getAuthSession } from "@/lib/auth/session";
import { getProjectAttachments } from "@/lib/data/attachments";
import { listProjectActivityEvents } from "@/lib/data/activity-events";
import { getProjectOverviewById } from "@/lib/data/projects";
import { getUserSettings } from "@/lib/data/settings";
import { decimalToNumber } from "@/lib/db/serializers";
import { ProjectActivityHistory } from "@/components/projects/project-activity-history";
import { ProjectSharePanel } from "@/components/projects/project-share-panel";
import { ProjectBudgetSections } from "@/components/projects/project-budget-sections";
import { DemoProjectGuide } from "@/components/onboarding/demo-project-guide";
import { resolveProjectGeneralBudget } from "@/lib/projects/general-budget";
import { getProjectOtherSections } from "@/lib/projects/other-sections";
import { buildingSubtypeLabel, contractTypeLabel, projectCategoryLabel } from "@/lib/projects/labels";
import { formatWorkDaysLabel } from "@/lib/work-schedule/calendar";
import { ensureDate, formatDate } from "@/lib/utils";
import type { ProjectAttachmentCategory } from "@/types/project";

const projectSections = [
  {
    id: "presupuesto-general",
    title: "Presupuesto General",
    description: "Consolida el presupuesto padre del proyecto y su lectura ejecutiva.",
  },
  {
    id: "subpresupuestos",
    title: "Sub Presupuestos",
    description: "Organiza estructuras, arquitectura e instalaciones como paquetes de trabajo separados.",
  },
  {
    id: "otras-secciones",
    title: "Otras secciones",
    description: "APU, lista de insumos, gastos generales, pie de presupuesto y fórmula polinómica del proyecto.",
  },
  {
    id: "archivos",
    title: "Archivos",
    description: "Planos, especificaciones, contratos y documentos adjuntos del proyecto.",
  },
  {
    id: "historial",
    title: "Historial",
    description: "Actividad reciente registrada para auditoria tecnica.",
  },
] as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await getAuthSession();
  const project = await getProjectOverviewById(id, session!.user.id);

  return {
    title: project ? `${project.name} | MC Presupuestos` : "Proyecto | MC Presupuestos",
    description: project
      ? `${project.name} — ${project.clientName || "Sin cliente"}. ${project.location || "Ubicación no especificada"}. Estado: ${project.status}.`
      : "Detalle del proyecto de construcción con presupuestos, cronogramas y control de costos.",
    openGraph: {
      title: project ? `${project.name} | MC Presupuestos` : "Proyecto | MC Presupuestos",
      description: project
        ? `Gestión de presupuestos y costos para el proyecto ${project.name}.`
        : "Detalle del proyecto de construcción.",
    },
  };
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ demoTour?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await getAuthSession();
  const [project, settings] = await Promise.all([getProjectOverviewById(id, session!.user.id), getUserSettings(session!.user.id)]);

  if (!project) {
    notFound();
  }

  const generalBudget = resolveProjectGeneralBudget(project.budgets);
  const generalBudgetsCount = generalBudget ? 1 : 0;
  const subBudgets = project.budgets.filter((budget) => budget.kind === "SUB_BUDGET");
  const structuresBudget = subBudgets.find((budget) => budget.name === "Estructuras") ?? null;
  const otherSections = getProjectOtherSections(generalBudget?.id ?? null);
  const attachments = await getProjectAttachments(project.id);
  const activityEvents = await listProjectActivityEvents({
    userId: session!.user.id,
    projectId: project.id,
    budgetIds: project.budgets.map((budget) => budget.id),
  });

  return (
    <AppShell
      settings={settings}
      aiContext={{
        route: `/projects/${project.id}`,
        project: project.name,
        projectId: project.id,
        module: "Proyecto",
        selectionType: "project",
        selectionId: project.id,
        viewSummary: `Vista general del proyecto ${project.name}.`,
      }}
    >
      <div className="space-y-5">
        <Card className="theme-surface-card rounded-2xl">
          <CardHeader className="theme-surface-card-gradient gap-4 rounded-2xl">
            <PageHeaderCard
              icon={<FolderKanban className="h-5 w-5" />}
              title={project.name}
              description="Cada proyecto ahora funciona como contenedor de su presupuesto general, subpresupuestos y demás secciones técnicas."
              badges={
                <>
                  <ProjectStatusBadge status={project.status} />
                  <ContextBadge label={project.company.name} />
                </>
              }
              actions={
                <>
                  <ExportPanel
                    buttonLabel="Exportar"
                    defaultPreset="proyecto_completo_mcp"
                    definition={getExportDefinition("project_package")}
                    targetId={project.id}
                    tourTarget={project.isDemo ? "export-project" : undefined}
                  />
                  <Link href={`/projects/${project.id}/edit`}>
                    <ActionButton action="edit" label="Editar proyecto" variant="outline" />
                  </Link>
                  {generalBudget ? (
                    <Link href={`/budgets/${generalBudget.id}`}>
                      <ActionButton action="open" label="Abrir presupuesto general" />
                    </Link>
                  ) : null}
                </>
              }
            />
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <InfoCard label="Cliente" value={project.clientName || "Pendiente"} />
              <InfoCard label="Ubicación" value={project.location || "Pendiente"} />
              <InfoCard label="Categoría" value={projectCategoryLabel(project.projectCategory) || "Pendiente"} />
              <InfoCard
                label="Calendario laboral"
                value={
                  project.workCalendar
                    ? `${project.workCalendar.name} (${formatWorkDaysLabel(project.workCalendar.workDays)}, ${project.workCalendar.workHoursPerDay}h/dia)`
                    : "Por defecto (Lun-Vie, 8h/dia)"
                }
              />
              <InfoCard label="Presupuestos" value={String(generalBudgetsCount)} />
              <InfoCard label="Actualizado" value={formatDate(project.updatedAt, settings.dateFormat)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {projectSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="theme-filter-button-inactive rounded-full border px-4 py-2 text-sm transition"
                >
                  {section.title}
                </a>
              ))}
            </div>

            {hasAdvancedData(project) ? (
              <ProjectAdvancedOverview project={project} />
            ) : null}
          </CardContent>
        </Card>

        {project.isDemo ? (
          <DemoProjectGuide
            autoOpen={resolvedSearchParams.demoTour === "1"}
            config={{
              projectId: project.id,
              generalBudgetId: generalBudget?.id ?? null,
              structuresBudgetId: structuresBudget?.id ?? null,
            }}
          />
        ) : null}

        <ProjectBudgetSections
          projectId={project.id}
          generalBudget={
            generalBudget
              ? {
                  id: generalBudget.id,
                  projectId: project.id,
                  parentBudgetId: generalBudget.parentBudgetId,
                  name: generalBudget.name,
                  kind: generalBudget.kind,
                  currency: generalBudget.currency,
                  totalAmount: decimalToNumber(generalBudget.totalAmount),
                  updatedAt: ensureDate(generalBudget.updatedAt).toISOString(),
                }
              : null
          }
          subBudgets={subBudgets.map((budget) => ({
            id: budget.id,
            projectId: project.id,
            parentBudgetId: budget.parentBudgetId,
            name: budget.name,
            kind: budget.kind,
            currency: budget.currency,
            totalAmount: decimalToNumber(budget.totalAmount),
            updatedAt: ensureDate(budget.updatedAt).toISOString(),
          }))}
        />

        <section id="otras-secciones">
          <Card className="theme-surface-card rounded-2xl">
            <CardHeader>
              <CardTitle>Otras secciones del proyecto</CardTitle>
              <CardDescription>
                Accesos directos a las secciones funcionales del presupuesto general desde el contexto del proyecto.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {otherSections.length ? (
                otherSections.map((section) => (
                  <SectionCard key={section.href} title={section.title} detail={section.detail} href={section.href} />
                ))
              ) : (
                <div className="theme-dashed-panel rounded-2xl border border-dashed p-4 md:col-span-2 xl:col-span-4">
                  <p className="theme-strong-text font-medium">Presupuesto general pendiente</p>
                  <p className="theme-muted-text mt-2 text-sm">
                    Esta sección se habilitará cuando el proyecto tenga un presupuesto general disponible.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section id="archivos">
          <Card className="theme-surface-card rounded-2xl">
            <CardHeader>
              <CardTitle>Archivos adjuntos</CardTitle>
              <CardDescription>
                Planos, especificaciones, contratos, memorias y otros documentos del proyecto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectAttachmentUpload
                projectId={project.id}
                initialAttachments={attachments.map((a: Awaited<ReturnType<typeof getProjectAttachments>>[number]) => ({
                  id: a.id,
                  fileName: a.fileName,
                  fileType: a.fileType,
                  fileSize: a.fileSize,
                  filePath: a.filePath,
                  category: a.category as ProjectAttachmentCategory,
                  createdAt: a.createdAt.toISOString(),
                  user: a.user ? { name: a.user.name } : null,
                }))}
              />
            </CardContent>
          </Card>
        </section>

        <section id="compartir">
          <ProjectSharePanel projectId={project.id} companyId={project.companyId} />
        </section>

        <ProjectActivityHistory events={activityEvents} dateFormat={settings.dateFormat} />
      </div>
    </AppShell>
  );
}

function SectionCard({ title, detail, href }: { title: string; detail: string; href: string }) {
  return (
    <Link
      href={href}
      className="theme-dashed-panel rounded-2xl border border-dashed p-4 transition hover:border-sky-300 hover:bg-sky-50"
    >
      <p className="theme-strong-text font-medium">{title}</p>
      <p className="theme-muted-text mt-2 text-sm">{detail}</p>
    </Link>
  );
}

function hasAdvancedData(project: NonNullable<Awaited<ReturnType<typeof getProjectOverviewById>>>) {
  return !!(
    project.buildingSubtype ||
    project.contractType ||
    project.builtArea ||
    project.landArea ||
    project.floors ||
    project.basements ||
    project.buildingHeight ||
    project.contractAmount ||
    project.referenceBudget ||
    project.region ||
    project.province ||
    project.district ||
    project.projectManager ||
    project.ownerEntity ||
    project.supervisor ||
    project.executiveSummary
  );
}

function ProjectAdvancedOverview({
  project,
}: {
  project: NonNullable<Awaited<ReturnType<typeof getProjectOverviewById>>>;
}) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
        <Building2 className="h-3.5 w-3.5" />
        Datos avanzados
      </h4>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {project.buildingSubtype ? (
          <InfoCard label="Subtipo" value={buildingSubtypeLabel(project.buildingSubtype) ?? ""} />
        ) : null}
        {project.contractType ? (
          <InfoCard label="Contrato" value={contractTypeLabel(project.contractType) ?? ""} />
        ) : null}
        {project.builtArea ? (
          <InfoCard label="Área construida" value={`${formatNumber(project.builtArea)} m²`} />
        ) : null}
        {project.landArea ? (
          <InfoCard label="Área de terreno" value={`${formatNumber(project.landArea)} m²`} />
        ) : null}
        {project.floors != null ? (
          <InfoCard label="Pisos" value={String(project.floors)} />
        ) : null}
        {project.basements != null ? (
          <InfoCard label="Sótanos" value={String(project.basements)} />
        ) : null}
        {project.buildingHeight ? (
          <InfoCard label="Altura total" value={`${formatNumber(project.buildingHeight)} m`} />
        ) : null}
        {project.contractAmount ? (
          <InfoCard label="Monto contractual" value={`S/ ${formatNumber(project.contractAmount)}`} />
        ) : null}
        {project.referenceBudget ? (
          <InfoCard label="Presupuesto referencial" value={`S/ ${formatNumber(project.referenceBudget)}`} />
        ) : null}
        {project.region ? (
          <InfoCard label="Región" value={project.region} />
        ) : null}
        {project.province ? (
          <InfoCard label="Provincia" value={project.province} />
        ) : null}
        {project.district ? (
          <InfoCard label="Distrito" value={project.district} />
        ) : null}          {project.projectManager ? (
          <InfoCard label="Ing. Residente / PM" value={project.projectManager} />
        ) : null}
        {project.ownerEntity ? (
          <InfoCard label="Entidad contratante" value={project.ownerEntity} />
        ) : null}
        {project.supervisor ? (
          <InfoCard label="Supervisión" value={project.supervisor} />
        ) : null}
      </div>
      {project.executiveSummary ? (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
            Resumen ejecutivo
          </p>
          <p className="text-sm leading-relaxed text-[var(--app-text-strong)]">{project.executiveSummary}</p>
        </div>      ) : null}
    </div>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString("es-PE", { maximumFractionDigits: 2 });
}


