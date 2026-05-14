"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { broadcastAppDataChange } from "@/lib/client/live-updates";
import type { ProjectRecord } from "@/types/project";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-button";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { Input } from "@/components/ui/input";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

type ProjectRow = ProjectRecord & {
  budgetsCount: number;
};

export function ProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const { dateFormat } = useFormattingSettings();
  const [filter, setFilter] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(
    () =>
      projects.filter((project) =>
        `${project.name} ${project.clientName ?? ""} ${project.location ?? ""}`.toLowerCase().includes(filter.toLowerCase()),
      ),
    [filter, projects],
  );

  async function removeProject(id: string) {
    setPendingId(id);
    setError("");

    const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });

    setPendingId(null);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo eliminar el proyecto");
      return;
    }

    broadcastAppDataChange(["/dashboard", "/projects", "/budgets"]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <OperationalPanel
        title="Tabla operativa"
        description="Busca por obra, cliente o ubicación y entra rápido a editar o revisar presupuestos."
        metrics={
          <>
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600">
              {filtered.length} {filtered.length === 1 ? "proyecto" : "proyectos"}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600">
              {projects.length} total
            </span>
          </>
        }
        controls={
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Input
              placeholder="Buscar por obra, cliente o ubicación"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="lg:max-w-xl"
            />
            <p className="text-sm text-slate-500">
              {filter.trim() ? `Mostrando ${filtered.length} coincidencias para "${filter}"` : "Vista general del portafolio de obras"}
            </p>
          </div>
        }
      />

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Table>
          <THead className="[&_tr]:border-b-slate-200">
            <TR className="bg-slate-50 hover:bg-slate-50">
              <TH>Proyecto</TH>
              <TH>Cliente</TH>
              <TH>Ubicación</TH>
              <TH>Estado</TH>
              <TH>Presupuestos</TH>
              <TH>Actualizado</TH>
              <TH className="text-right">Acciones</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.length > 0 ? (
              filtered.map((project) => (
                <TR key={project.id} className="hover:bg-slate-50/80">
                  <TD className="font-medium text-slate-900">{project.name}</TD>
                  <TD>{project.clientName || "Pendiente"}</TD>
                  <TD>{project.location || "Pendiente"}</TD>
                  <TD>
                    <Badge>{project.status}</Badge>
                  </TD>
                  <TD>{project.budgetsCount}</TD>
                  <TD>{formatDate(project.updatedAt, dateFormat)}</TD>
                  <TD>
                    <div className="flex justify-end gap-2">
                      <Link href={`/projects/${project.id}`}>
                        <ActionButton action="open" label="Abrir" size="sm" variant="outline" />
                      </Link>
                      <Link href={`/projects/${project.id}/edit`}>
                        <ActionButton action="edit" label="Editar" size="sm" variant="ghost" />
                      </Link>
                      <ActionButton
                        action="delete"
                        label="Eliminar"
                        size="sm"
                        variant="ghost"
                        disabled={pendingId === project.id}
                        onClick={() => removeProject(project.id)}
                      />
                    </div>
                  </TD>
                </TR>
              ))
            ) : (
              <TR>
                <TD colSpan={7} className="px-6 py-10 text-center">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-900">No encontramos proyectos con ese filtro</p>
                    <p className="text-sm text-slate-500">Prueba otro término de búsqueda o crea una obra nueva para comenzar.</p>
                  </div>
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
