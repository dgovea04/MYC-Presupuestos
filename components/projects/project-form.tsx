"use client";

import { useState } from "react";
import { CalendarDays, MapPin, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatWorkDaysLabel } from "@/lib/work-schedule/calendar";
import { broadcastAppDataChange } from "@/lib/client/live-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormActionBar, FormSectionPanel } from "@/components/ui/operational-surfaces";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
  project?: {
    id: string;
    companyId: string;
    name: string;
    clientName?: string | null;
    location?: string | null;
    projectType?: string | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    status: string;
    workCalendarId?: string | null;
  };
};

export function ProjectForm({ companies, workCalendars, project, selectedTemplate }: ProjectFormProps) {
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
          <Select id="companyId" name="companyId" defaultValue={project?.companyId ?? companies[0]?.id}>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="name" label="Nombre de obra" defaultValue={project?.name} required />
          <Field id="projectType" label="Tipo de obra" defaultValue={project?.projectType ?? ""} />
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


