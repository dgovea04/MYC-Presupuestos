"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { broadcastAppDataChange } from "@/lib/client/live-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type CompanyOption = {
  id: string;
  name: string;
};

type ProjectFormProps = {
  companies: CompanyOption[];
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
  };
};

export function ProjectForm({ companies, project }: ProjectFormProps) {
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
    router.push(project ? `/projects/${project.id}` : `/projects/${savedProject.id}`);
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="companyId">Empresa</Label>
        <Select id="companyId" name="companyId" defaultValue={project?.companyId ?? companies[0]?.id}>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </Select>
      </div>
      <Field id="name" label="Nombre de obra" defaultValue={project?.name} required />
      <Field id="clientName" label="Cliente" defaultValue={project?.clientName ?? ""} />
      <Field id="location" label="Ubicación" defaultValue={project?.location ?? ""} />
      <Field id="projectType" label="Tipo de obra" defaultValue={project?.projectType ?? ""} />
      <Field id="startDate" type="date" label="Fecha inicio" defaultValue={normalizeDate(project?.startDate)} />
      <Field id="endDate" type="date" label="Fecha fin" defaultValue={normalizeDate(project?.endDate)} />
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="status">Estado</Label>
        <Select id="status" name="status" defaultValue={project?.status ?? "PLANNING"}>
          <option value="PLANNING">Planificación</option>
          <option value="IN_PROGRESS">En ejecución</option>
          <option value="COMPLETED">Completado</option>
          <option value="ON_HOLD">En pausa</option>
        </Select>
      </div>
      {error ? <p className="md:col-span-2 text-sm text-rose-600">{error}</p> : null}
      <div className="md:col-span-2 flex justify-end">
        <Button disabled={loading}>{loading ? "Guardando..." : project ? "Actualizar proyecto" : "Crear proyecto"}</Button>
      </div>
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
