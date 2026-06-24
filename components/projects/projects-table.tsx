"use client";

import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";

import { broadcastAppDataChange } from "@/lib/client/live-updates";
import type { ProjectRecord } from "@/types/project";
import { ActionButton } from "@/components/ui/action-button";
import { ProjectStatusBadge } from "@/components/ui/context-badges";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { Input } from "@/components/ui/input";
import { OperationalFilterSummary, OperationalMetricBadge, OperationalPanel } from "@/components/ui/operational-surfaces";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StaticTableFrame } from "@/components/ui/virtualized-table-frame";
import { formatDate } from "@/lib/utils";
import type { DateFormatOption } from "@/types/settings";

type ProjectRow = ProjectRecord & {
  budgetsCount: number;
};

async function readErrorMessage(response: Response, fallbackMessage: string) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export function ProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const { dateFormat } = useFormattingSettings();
  const [rows, setRows] = useState(projects);
  const [filter, setFilter] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const deferredFilter = useDeferredValue(filter);

  const filtered = useMemo(
    () =>
      rows.filter((project) =>
        `${project.name} ${project.clientName ?? ""} ${project.location ?? ""}`.toLowerCase().includes(deferredFilter.toLowerCase()),
      ),
    [deferredFilter, rows],
  );

  const removeProject = useCallback(async (id: string) => {
    setPendingId(id);
    setError("");

    try {
      const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });

      if (!response.ok) {
        setError(await readErrorMessage(response, "No se pudo eliminar el proyecto"));
        return;
      }

      setRows((current) => current.filter((project) => project.id !== id));
      broadcastAppDataChange(["/dashboard", "/projects", "/budgets"], undefined, { locallyHandledPaths: ["/projects"] });
    } catch {
      setError("No se pudo eliminar el proyecto");
    } finally {
      setPendingId(null);
    }
  }, []);

  const duplicateProject = useCallback(async (id: string) => {
    const sourceProject = rows.find((project) => project.id === id);
    if (!sourceProject) return;

    setPendingId(id);
    setError("");

    try {
      const response = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });

      if (!response.ok) {
        setError(await readErrorMessage(response, "No se pudo duplicar el proyecto"));
        return;
      }

      const duplicatedProject = (await response.json()) as ProjectRecord;

      setRows((current) => [{ ...duplicatedProject, budgetsCount: sourceProject.budgetsCount }, ...current]);
      broadcastAppDataChange(["/dashboard", "/projects", "/budgets"], undefined, { locallyHandledPaths: ["/projects"] });
    } catch {
      setError("No se pudo duplicar el proyecto");
    } finally {
      setPendingId(null);
    }
  }, [rows]);

  return (
    <div className="space-y-4">
      <OperationalPanel
        title="Tabla operativa"
        description="Busca por obra, cliente o ubicacion y entra rapido a editar o revisar presupuestos."
        metrics={
          <div className="flex flex-wrap items-center gap-2">
            <OperationalMetricBadge tone="accent">
              {filtered.length} {filtered.length === 1 ? "proyecto" : "proyectos"}
            </OperationalMetricBadge>
            <OperationalMetricBadge>{rows.length} total</OperationalMetricBadge>
          </div>
        }
        controls={
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Input placeholder="Buscar por obra, cliente o ubicacion" value={filter} onChange={(event) => setFilter(event.target.value)} />
            <OperationalFilterSummary className="flex items-center" data-testid="projects-filter-summary">
              {filter.trim() ? `Mostrando ${filtered.length} coincidencias para "${filter}"` : "Vista general del portafolio de obras"}
            </OperationalFilterSummary>
          </div>
        }
      />

      {error ? (
        <p className="theme-status-error rounded-2xl border px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}
      <StaticTableFrame>
        <Table>
          <THead className="[&_tr]:border-b-[var(--app-border)]">
            <TR className="bg-[var(--app-surface-elevated)] hover:bg-[var(--app-surface-elevated)]">
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
            {filtered.length > 0 ? (
              filtered.map((project) => (
                <ProjectTableRow
                  key={project.id}
                  project={project}
                  dateFormat={dateFormat}
                  isPending={pendingId === project.id}
                  onDuplicateProject={duplicateProject}
                  onRemoveProject={removeProject}
                />
              ))
            ) : (
              <TR>
                <TD colSpan={7} className="px-6 py-10 text-center">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[var(--app-text-strong)]">No encontramos proyectos con ese filtro</p>
                    <p className="text-sm text-[var(--app-text-muted)]">Prueba otro termino de busqueda o crea una obra nueva para comenzar.</p>
                  </div>
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </StaticTableFrame>
    </div>
  );
}

const ProjectTableRow = memo(function ProjectTableRow({
  project,
  dateFormat,
  isPending,
  onDuplicateProject,
  onRemoveProject,
}: {
  project: ProjectRow;
  dateFormat: DateFormatOption;
  isPending: boolean;
  onDuplicateProject: (id: string) => Promise<void>;
  onRemoveProject: (id: string) => Promise<void>;
}) {
  return (
    <TR className="hover:bg-[var(--app-surface-muted)]/80">
      <TD className="font-medium text-[var(--app-text-strong)]">{project.name}</TD>
      <TD>{project.clientName || "Pendiente"}</TD>
      <TD>{project.location || "Pendiente"}</TD>
      <TD>
        <ProjectStatusBadge status={project.status} />
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
            action="duplicate"
            label="Duplicar"
            size="sm"
            variant="ghost"
            disabled={isPending}
            data-project-action="duplicate"
            data-project-id={project.id}
            onClick={() => void onDuplicateProject(project.id)}
          />
          <ActionButton
            action="delete"
            label="Eliminar"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => void onRemoveProject(project.id)}
          />
        </div>
      </TD>
    </TR>
  );
});
