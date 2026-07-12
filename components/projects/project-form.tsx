"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, MapPin, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatWorkDaysLabel } from "@/lib/work-schedule/calendar";
import { broadcastAppDataChange } from "@/lib/client/live-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormActionBar, FormSectionPanel } from "@/components/ui/operational-surfaces";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildingSubtypeValues,
  contractTypeValues,
  projectCategoryValues,
} from "@/lib/validations/project";
import { buildingSubtypeLabel, contractTypeLabel, projectCategoryLabel } from "@/lib/projects/labels";
import { LocationSelects } from "@/components/ui/location-selects";
import type { ProjectCategory, BuildingSubtype, ContractType } from "@/types/project";
import type { TemplateLibraryItem } from "@/lib/templates/template-library";

type CompanyOption = {
  id: string;
  name: string;
};

type WorkCalendarOption = {
  id: string;
  name: string;
  workDays: number;
  workHoursPerDay: number;
};

type ProjectFormProps = {
  companies: CompanyOption[];
  workCalendars?: WorkCalendarOption[];
  selectedTemplate?: TemplateLibraryItem | null;
  activeWorkspaceId?: string;
  project?: {
    id: string;
    companyId: string;
    name: string;
    clientName?: string | null;
    location?: string | null;
    projectType?: string | null;
    projectCategory?: ProjectCategory | null;
    buildingSubtype?: BuildingSubtype | null;
    contractType?: ContractType | null;
    builtArea?: number | null;
    landArea?: number | null;
    floors?: number | null;
    basements?: number | null;
    buildingHeight?: number | null;
    contractAmount?: number | null;
    referenceBudget?: number | null;
    region?: string | null;
    province?: string | null;
    district?: string | null;
    executiveSummary?: string | null;
    projectManager?: string | null;
    ownerEntity?: string | null;
    supervisor?: string | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    status: string;
    workCalendarId?: string | null;
  };
};

export function ProjectForm({ companies, workCalendars, project, selectedTemplate, activeWorkspaceId }: ProjectFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const endpoint = project ? `/api/projects/${project.id}` : "/api/projects";
    const method = project ? "PATCH" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo guardar el proyecto");
      return;
    }

    const savedProject = await response.json();
    broadcastAppDataChange(["/dashboard", "/projects", "/budgets"]);
    if (project) {
      router.push(`/projects/${project.id}`);
      return;
    }

    window.location.assign(`/projects/${savedProject.id}`);
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {project ? (
        <div className="grid gap-3 md:grid-cols-3">
          <ProjectInfoCard label="Proyecto" value={project.name} />
          <ProjectInfoCard label="Cliente" value={project.clientName || "Pendiente"} />
          <ProjectInfoCard label="Estado" value={getProjectStatusLabel(project.status)} />
        </div>
      ) : null}

      {!project && selectedTemplate ? (
        <div className="theme-status-info rounded-2xl border p-4">
          <input name="templateId" type="hidden" value={selectedTemplate.id} />
          <p className="theme-status-info-strong text-sm font-semibold">Plantilla seleccionada: {selectedTemplate.name}</p>
          <p className="mt-1 text-sm leading-6">
            Se creara el presupuesto general y los Sub Presupuestos iniciales configurados para tu cuenta. La plantilla queda como origen del flujo de creacion.
          </p>
        </div>
      ) : null}

      <FormSectionPanel
        title="Identidad del proyecto"
        description="Define la empresa, el nombre base de la obra y su clasificacion principal."
      >
        <div className="space-y-2">
          <Label htmlFor="companyId">Empresa</Label>
          {companies.length > 1 ? (
            <Select id="companyId" name="companyId" defaultValue={project?.companyId ?? activeWorkspaceId ?? companies[0]?.id}>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>
          ) : (
            <>
              <input type="hidden" name="companyId" value={companies[0]?.id} />
              <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text-strong)]">
                {companies[0]?.name}
              </div>
            </>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="name" label="Nombre de obra" defaultValue={project?.name} required />
          <div className="space-y-2">
            <Label htmlFor="projectCategory">Tipo de obra</Label>
            <Select id="projectCategory" name="projectCategory" defaultValue={project?.projectCategory ?? ""}>
              <option value="">Seleccionar tipo...</option>
              {projectCategoryValues.map((category) => (
                <option key={category} value={category}>
                  {projectCategoryLabel(category)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </FormSectionPanel>

      <FormSectionPanel
        title="Cliente y ubicación"
        description="Ubica la obra dentro del contexto comercial y geográfico del proyecto."
        icon={<MapPin className="h-4 w-4" />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="clientName" label="Cliente" defaultValue={project?.clientName ?? ""} />
          <Field id="location" label="Ubicación" defaultValue={project?.location ?? ""} />
        </div>
      </FormSectionPanel>

      <FormSectionPanel
        title="Fechas y estado"
        description="Controla la vigencia prevista y el momento operativo actual del proyecto."
        icon={<CalendarDays className="h-4 w-4" />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="startDate" type="date" label="Fecha inicio" defaultValue={normalizeDate(project?.startDate)} />
          <Field id="endDate" type="date" label="Fecha fin" defaultValue={normalizeDate(project?.endDate)} />
        </div>
        {workCalendars && workCalendars.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="workCalendarId">Calendario laboral</Label>
            <Select id="workCalendarId" name="workCalendarId" defaultValue={project?.workCalendarId ?? ""}>
              <option value="">Calendario por defecto (Lun-Vie, 8h)</option>
              {workCalendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name} ({formatWorkDaysLabel(calendar.workDays)}, {calendar.workHoursPerDay}h/dia)
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <Select id="status" name="status" defaultValue={project?.status ?? "PLANNING"}>
            <option value="PLANNING">Planificación</option>
            <option value="IN_PROGRESS">En ejecución</option>
            <option value="COMPLETED">Completado</option>
            <option value="ON_HOLD">En pausa</option>
          </Select>
        </div>
      </FormSectionPanel>

      {error ? <p className="theme-status-error rounded-2xl border px-4 py-3 text-sm">{error}</p> : null}

      <ProjectAdvancedSection
        projectCategory={project?.projectCategory ?? null}
        buildingSubtype={project?.buildingSubtype ?? null}
        contractType={project?.contractType ?? null}
        builtArea={project?.builtArea ?? null}
        landArea={project?.landArea ?? null}
        floors={project?.floors ?? null}
        basements={project?.basements ?? null}
        buildingHeight={project?.buildingHeight ?? null}
        contractAmount={project?.contractAmount ?? null}
        referenceBudget={project?.referenceBudget ?? null}
        region={project?.region ?? null}
        province={project?.province ?? null}
        district={project?.district ?? null}
        executiveSummary={project?.executiveSummary ?? null}
        projectManager={project?.projectManager ?? null}
        ownerEntity={project?.ownerEntity ?? null}
        supervisor={project?.supervisor ?? null}
      />

      <FormActionBar>
        <Button type="submit" disabled={loading} className="gap-2 shadow-sm shadow-sky-950/10">
          <Save className="h-4 w-4" />
          {loading ? "Guardando..." : project ? "Actualizar proyecto" : "Crear proyecto"}
        </Button>
      </FormActionBar>
    </form>
  );
}

function normalizeDate(value?: string | Date | null) {
  if (!value) return "";
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function Field({
  id,
  label,
  defaultValue,
  required,
  type = "text",
}: {
  id: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} defaultValue={defaultValue} required={required} />
    </div>
  );
}

function ProjectInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-muted-panel rounded-2xl border px-4 py-3">
      <p className="theme-muted-text text-sm">{label}</p>
      <p className="theme-strong-text mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function getProjectStatusLabel(status: string) {
  switch (status) {
    case "IN_PROGRESS":
      return "En ejecución";
    case "COMPLETED":
      return "Completado";
    case "ON_HOLD":
      return "En pausa";
    case "PLANNING":
    default:
      return "Planificación";
  }
}



type AdvancedSectionProps = {
  projectCategory: ProjectCategory | null;
  buildingSubtype: BuildingSubtype | null;
  contractType: ContractType | null;
  builtArea: number | null;
  landArea: number | null;
  floors: number | null;
  basements: number | null;
  buildingHeight: number | null;
  contractAmount: number | null;
  referenceBudget: number | null;
  region: string | null;
  province: string | null;
  district: string | null;
  executiveSummary: string | null;
  projectManager: string | null;
  ownerEntity: string | null;
  supervisor: string | null;
};

export function ProjectAdvancedSection(props: AdvancedSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-[var(--app-text-strong)]">Configuración avanzada</h3>
          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
            Datos técnicos, contractuales y resumen ejecutivo del proyecto.
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[var(--app-text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* LocationSelects always rendered — hidden inputs persist when collapsed */}
      <div className={expanded ? "border-t border-[var(--app-border)] px-5 pt-4" : "px-5"}>
        <LocationSelects
          initialDepartment={props.region}
          initialProvince={props.province}
          initialDistrict={props.district}
          compact={!expanded}
        />
      </div>

      {expanded ? (
        <div className="space-y-5 border-t border-[var(--app-border)] px-5 pb-5 pt-4">
          {/* Clasificación técnica */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="buildingSubtype">Subtipo de edificación</Label>
              <Select id="buildingSubtype" name="buildingSubtype" defaultValue={props.buildingSubtype ?? ""}>
                <option value="">No especificado</option>
                {buildingSubtypeValues.map((subtype) => (
                  <option key={subtype} value={subtype}>
                    {buildingSubtypeLabel(subtype)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractType">Tipo de contrato</Label>
              <Select id="contractType" name="contractType" defaultValue={props.contractType ?? ""}>
                <option value="">No especificado</option>
                {contractTypeValues.map((contractType) => (
                  <option key={contractType} value={contractType}>
                    {contractTypeLabel(contractType)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Parámetros físicos */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
              Parámetros físicos
            </Label>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field id="builtArea" label="Área construida (m²)" type="number" defaultValue={numberOrEmpty(props.builtArea)} />
              <Field id="landArea" label="Área de terreno (m²)" type="number" defaultValue={numberOrEmpty(props.landArea)} />
              <Field id="floors" label="N° de pisos" type="number" defaultValue={numberOrEmpty(props.floors)} />
              <Field id="basements" label="N° de sótanos" type="number" defaultValue={numberOrEmpty(props.basements)} />
              <Field id="buildingHeight" label="Altura total (m)" type="number" defaultValue={numberOrEmpty(props.buildingHeight)} />
            </div>
          </div>

          {/* Información contractual */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
              Información contractual
            </Label>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="contractAmount" label="Monto contractual" type="number" defaultValue={numberOrEmpty(props.contractAmount)} />
              <Field id="referenceBudget" label="Presupuesto referencial" type="number" defaultValue={numberOrEmpty(props.referenceBudget)} />
            </div>
          </div>

          {/* Contactos / Stakeholders */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
              Stakeholders
            </Label>
            <div className="grid gap-4 md:grid-cols-3">
              <Field id="projectManager" label="Ing. Residente / PM" defaultValue={props.projectManager ?? ""} />
              <Field id="ownerEntity" label="Entidad contratante" defaultValue={props.ownerEntity ?? ""} />
              <Field id="supervisor" label="Supervisión" defaultValue={props.supervisor ?? ""} />
            </div>
          </div>

          {/* Resumen ejecutivo */}
          <div className="space-y-2">
            <Label htmlFor="executiveSummary">Resumen ejecutivo</Label>
            <Textarea
              id="executiveSummary"
              name="executiveSummary"
              defaultValue={props.executiveSummary ?? ""}
              placeholder="Describe el alcance, objetivos y características principales del proyecto..."
              rows={4}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function numberOrEmpty(value: number | null | undefined) {
  if (value == null) return "";
  return String(value);
}


