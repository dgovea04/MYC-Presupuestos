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
      <Input placeholder="Buscar por obra, cliente o ubicacion" value={filter} onChange={(event) => setFilter(event.target.value)} />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <Table>
          <THead>
            <TR className="bg-slate-50 hover:bg-slate-50">
              <TH>Proyecto</TH>
              <TH>Cliente</TH>
              <TH>Ubicacion</TH>
              <TH>Estado</TH>
              <TH>Presupuestos</TH>
              <TH>Actualizado</TH>
              <TH className="text-right">Acciones</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((project) => (
              <TR key={project.id}>
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
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
