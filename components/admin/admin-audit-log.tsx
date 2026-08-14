import Link from "next/link";
import { Activity, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";

export type AdminAuditLogEntry = {
  id: string;
  action: string;
  detail: string | null;
  targetEmail: string;
  actorEmail: string | null;
  createdAt: string;
};

type AdminAuditPagination = {
  page: number;
  pageSize: number;
  totalEntries: number;
  totalPages: number;
};

type AdminAuditFilters = {
  query: string;
  action: string;
};

type PreservedAdminFilters = {
  q?: string;
  plan?: string;
  role?: "ADMIN" | "USER";
  status?: "ACTIVE" | "SUSPENDED";
  page?: number;
};

export function AdminAuditLog({
  actions,
  entries,
  filters,
  pagination,
  preservedFilters,
}: {
  actions: string[];
  entries: AdminAuditLogEntry[];
  filters: AdminAuditFilters;
  pagination: AdminAuditPagination;
  preservedFilters?: PreservedAdminFilters;
}) {
  return (
    <Card className="theme-surface-card">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <OperationalSectionHeader
            title="Auditoria administrativa"
            description="Filtra, revisa y exporta acciones ejecutadas sobre cuentas y configuración sensible."
          />
          <Link
            href={buildAuditExportHref(filters)}
            className="theme-filter-button inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Link>
        </div>

        <form action="/admin" method="get" className="grid gap-2 md:grid-cols-[1fr_0.7fr_auto_auto]">
          <input
            name="auditQ"
            defaultValue={filters.query}
            placeholder="Buscar objetivo, administrador o detalle..."
            aria-label="Buscar en auditoría administrativa"
            className="theme-surface-card theme-strong-text min-h-10 rounded-xl border px-3 text-sm outline-none transition placeholder:text-[var(--app-text-muted)] focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
          <select
            name="auditAction"
            defaultValue={filters.action}
            aria-label="Filtrar auditoría por acción"
            className="theme-surface-card theme-strong-text min-h-10 rounded-xl border px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            <option value="">Todas las acciones</option>
            {actions.map((action) => <option key={action} value={action}>{formatAuditAction(action)}</option>)}
          </select>
          {renderPreservedFilterInputs(preservedFilters)}
          <button type="submit" className="theme-filter-button-active min-h-10 rounded-xl border px-4 text-sm font-medium transition hover:brightness-95">
            Filtrar
          </button>
          {filters.query || filters.action ? (
            <Link href={buildAuditHref({ ...filters, query: "", action: "", page: 1 }, preservedFilters)} className="theme-filter-button min-h-10 rounded-xl border px-4 py-2 text-center text-sm font-medium">
              Limpiar
            </Link>
          ) : null}
        </form>

        {entries.length === 0 ? (
          <p className="theme-dashed-panel theme-muted-text rounded-2xl border px-4 py-6 text-sm">
            No hay eventos de auditoría que coincidan con estos filtros.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="theme-muted-panel flex items-start gap-3 rounded-2xl border px-4 py-3">
                <span className="theme-filter-button-active mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                  <Activity className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="theme-strong-text text-sm font-medium">{formatAuditAction(entry.action)}</p>
                    <time className="theme-subtle-text text-xs" dateTime={entry.createdAt}>
                      {formatAuditDate(entry.createdAt)}
                    </time>
                  </div>
                  <p className="theme-muted-text mt-1 text-xs">
                    Objetivo: {entry.targetEmail} · Por: {entry.actorEmail ?? "Sistema"}
                  </p>
                  {entry.detail ? <p className="theme-muted-text mt-1 text-sm">{entry.detail}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="theme-muted-text">
            Página {pagination.page} de {pagination.totalPages} · {pagination.totalEntries} eventos
          </p>
          {pagination.totalPages > 1 ? (
            <nav aria-label="Paginación de auditoría" className="flex items-center gap-2">
              {pagination.page > 1 ? (
                <Link href={buildAuditHref({ ...filters, page: pagination.page - 1 }, preservedFilters)} className="theme-filter-button rounded-xl border px-3 py-1.5 font-medium">
                  Anterior
                </Link>
              ) : null}
              {pagination.page < pagination.totalPages ? (
                <Link href={buildAuditHref({ ...filters, page: pagination.page + 1 }, preservedFilters)} className="theme-filter-button-active rounded-xl border px-3 py-1.5 font-medium">
                  Siguiente
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function buildAuditHref(filters: AdminAuditFilters & { page?: number }, preservedFilters?: PreservedAdminFilters) {
  const params = new URLSearchParams();
  setAuditParams(params, filters);
  setPreservedParams(params, preservedFilters);
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

function buildAuditExportHref(filters: AdminAuditFilters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.action) params.set("action", filters.action);
  const query = params.toString();
  return query ? `/api/admin/audit/export?${query}` : "/api/admin/audit/export";
}

function setAuditParams(params: URLSearchParams, filters: AdminAuditFilters & { page?: number }) {
  if (filters.query) params.set("auditQ", filters.query);
  if (filters.action) params.set("auditAction", filters.action);
  if (filters.page && filters.page > 1) params.set("auditPage", String(filters.page));
}

function setPreservedParams(params: URLSearchParams, filters?: PreservedAdminFilters) {
  if (!filters) return;
  if (filters.q) params.set("q", filters.q);
  if (filters.plan) params.set("plan", filters.plan);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
}

function renderPreservedFilterInputs(filters?: PreservedAdminFilters) {
  if (!filters) return null;

  return (
    <>
      {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
      {filters.plan ? <input type="hidden" name="plan" value={filters.plan} /> : null}
      {filters.role ? <input type="hidden" name="role" value={filters.role} /> : null}
      {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
      {filters.page && filters.page > 1 ? <input type="hidden" name="page" value={filters.page} /> : null}
    </>
  );
}

function formatAuditAction(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
