"use client";

import { useEffect, useState } from "react";
import { CalendarRange, Filter, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";

type UsageReport = {
  summary: { requests: number; tokens: number; actualCostMinor: number };
  byTask: Array<{ task: string; requests: number; tokens: number; actualCostMinor: number }>;
  byProvider: Array<{ provider: string; model: string; requests: number; tokens: number; actualCostMinor: number }>;
  bySource: Array<{ credentialSource: string | null; billingScope: string | null; requests: number; tokens: number; actualCostMinor: number }>;
};

type AdminAiUsageUser = { userId: string; name: string | null; email: string | null };

function toIsoRange(fromDate: string, toDate: string): { from?: string; to?: string } {
  const range: { from?: string; to?: string } = {};
  if (fromDate) range.from = new Date(`${fromDate}T00:00:00.000Z`).toISOString();
  if (toDate) range.to = new Date(`${toDate}T23:59:59.999Z`).toISOString();
  return range;
}

export function AdminAiUsageDrilldown({ users }: { users: AdminAiUsageUser[] }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [report, setReport] = useState<UsageReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (selectedUserId) params.set("userId", selectedUserId);
    const range = toIsoRange(fromDate, toDate);
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    const query = params.toString();
    void fetch(`/api/admin/ai-usage${query ? `?${query}` : ""}`, { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error("No se pudo cargar el consumo de IA.");
        if (!cancelled) setReport(payload as UsageReport);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar el consumo de IA.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUserId, fromDate, toDate]);

  const selectedUser = users.find((user) => user.userId === selectedUserId);
  const hasDateFilter = Boolean(fromDate || toDate);

  return (
    <Card className="theme-surface-card">
      <CardHeader>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Detalle de consumo IA
            </CardTitle>
            <p className="theme-muted-text mt-1 text-sm">
              Filtra el consumo por usuario y rango de fechas para ver a qué corresponde cada solicitud (incluye uso con la key del sistema).
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[auto_auto_auto]">
            <label className="block text-xs font-medium">
              Usuario
              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                className="theme-muted-panel theme-strong-text mt-1 w-full min-w-[14rem] rounded-xl border px-3 py-2 text-sm"
              >
                <option value="">Todos los usuarios</option>
                {users.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.name ?? "Usuario desconocido"}{user.email ? ` · ${user.email}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Desde
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => setFromDate(event.target.value)}
                className="theme-muted-panel theme-strong-text mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium">
              Hasta
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => setToDate(event.target.value)}
                className="theme-muted-panel theme-strong-text mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="theme-status-error rounded-2xl border px-4 py-3 text-sm">{error}</p> : null}
        {!report ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {(selectedUser || hasDateFilter) ? (
              <p className="theme-status-info rounded-2xl border px-4 py-3 text-sm">
                <CalendarRange className="mr-1 inline h-4 w-4" />
                {selectedUser ? (
                  <>
                    Mostrando consumo de <strong>{selectedUser.name ?? "Usuario desconocido"}</strong>
                    {selectedUser.email ? ` (${selectedUser.email})` : ""}
                  </>
                ) : null}
                {selectedUser && hasDateFilter ? " · " : null}
                {hasDateFilter ? (
                  <>
                    periodo{" "}
                    <strong>
                      {fromDate || "inicio de mes"} → {toDate || "hoy"}
                    </strong>
                  </>
                ) : null}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Solicitudes" value={report.summary.requests} />
              <Stat label="Tokens" value={report.summary.tokens.toLocaleString("es-PE")} />
              <Stat label="Costo" value={`${(report.summary.actualCostMinor / 100).toFixed(2)}`} />
            </div>

            <div>
              <OperationalSectionHeader title="Por accion" description="Solicitudes y tokens agrupados por tarea (chat, APU, revision, etc.)." />
              {report.byTask.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {report.byTask.map((row) => (
                    <div key={row.task} className="theme-surface-card rounded-2xl border p-3 text-xs">
                      <p className="theme-strong-text font-semibold">{row.task}</p>
                      <p className="theme-muted-text mt-1">{row.tokens.toLocaleString("es-PE")} tokens · {row.requests} solicitudes</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <OperationalSectionHeader title="Por proveedor" description="Desglose por proveedor y modelo utilizado." />
              {report.byProvider.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-2">
                  {report.byProvider.map((row) => (
                    <div key={`${row.provider}-${row.model}`} className="theme-surface-card flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs">
                      <span className="theme-strong-text font-medium">{row.provider} · {row.model}</span>
                      <span className="theme-muted-text shrink-0">{row.tokens.toLocaleString("es-PE")} tokens · {row.requests} solicitudes</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <OperationalSectionHeader title="Origen de la credencial" description="Plataforma (key del sistema), workspace o usuario." />
              {report.bySource.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {report.bySource.map((row) => (
                    <span key={`${row.credentialSource ?? "?"}-${row.billingScope ?? "?"}`} className="theme-muted-panel theme-muted-text rounded-full px-3 py-1.5 text-xs">
                      {row.credentialSource ?? "?"} · {row.billingScope ?? "?"} — {row.tokens.toLocaleString("es-PE")} tokens
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="theme-surface-card rounded-2xl border p-4">
      <p className="theme-muted-text text-xs font-medium">{label}</p>
      <strong className="theme-strong-text text-xl">{value}</strong>
    </div>
  );
}

function EmptyState() {
  return (
    <p className="theme-dashed-panel theme-muted-text rounded-2xl border px-4 py-6 text-sm">
      Sin consumo registrado para este filtro en el periodo.
    </p>
  );
}
