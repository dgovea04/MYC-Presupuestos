"use client";
import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Report = {
  summary: { requests: number; tokens: number; actualCostMinor: number };
  byProvider: Array<{ provider: string; model: string; requests: number; tokens: number; actualCostMinor: number }>;
  bySource: Array<{ credentialSource: string | null; billingScope: string | null; requests: number; tokens: number; actualCostMinor: number }>;
  byUser: Array<{ userId: string | null; name: string | null; email: string | null; requests: number; tokens: number; actualCostMinor: number }>;
};

type UserOption = { userId: string; name: string | null; email: string | null };

function toIsoRange(fromDate: string, toDate: string): { from?: string; to?: string } {
  const range: { from?: string; to?: string } = {};
  if (fromDate) range.from = new Date(`${fromDate}T00:00:00.000Z`).toISOString();
  if (toDate) range.to = new Date(`${toDate}T23:59:59.999Z`).toISOString();
  return range;
}

export function WorkspaceAiUsageDashboard({ workspaceId }: { workspaceId: string }) {
  const [provider, setProvider] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ workspaceId });
    if (provider) params.set("provider", provider);
    if (selectedUserId) params.set("userId", selectedUserId);
    const range = toIsoRange(fromDate, toDate);
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    void fetch(`/api/admin/ai-usage?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error("No se pudo cargar el desglose de uso.");
        if (!cancelled) {
          setReport(payload as Report);
          // Mantener estables las opciones del filtro de usuario: se alimentan de
          // la vista sin filtro de usuario (todos los consumidores del workspace).
          if (!selectedUserId) {
            setUsers(
              ((payload as Report).byUser ?? [])
                .filter((row): row is Report["byUser"][number] & { userId: string } => Boolean(row.userId))
                .map((row) => ({ userId: row.userId, name: row.name, email: row.email })),
            );
          }
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar el uso.");
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, provider, selectedUserId, fromDate, toDate]);

  const selectedUser = users.find((user) => user.userId === selectedUserId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Desglose avanzado de IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block text-xs font-medium">
            Proveedor
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="OPENAI">OpenAI</option>
              <option value="GEMINI">Gemini</option>
              <option value="OPENROUTER">OpenRouter</option>
            </select>
          </label>
          <label className="block text-xs font-medium">
            Usuario
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2"
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
              className="mt-1 w-full rounded-xl border px-3 py-2"
            />
          </label>
          <label className="block text-xs font-medium">
            Hasta
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2"
            />
          </label>
        </div>
        {!report ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {selectedUser ? (
              <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                Mostrando consumo de {selectedUser.name ?? "Usuario desconocido"}
                {selectedUser.email ? ` (${selectedUser.email})` : ""}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Solicitudes" value={report.summary.requests} />
              <Metric label="Tokens" value={report.summary.tokens} />
              <Metric label="Costo" value={`${(report.summary.actualCostMinor / 100).toFixed(2)}`} />
            </div>
            <div className="space-y-2">
              {report.byProvider.map((row) => (
                <div key={`${row.provider}-${row.model}`} className="flex justify-between rounded-xl border p-3 text-xs">
                  <span>{row.provider} · {row.model}</span>
                  <span>{row.tokens} tokens · {row.requests} solicitudes</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                Consumo por usuario
              </p>
              {report.byUser.length === 0 ? (
                <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-[var(--app-text-muted)]">
                  Sin consumo registrado para este filtro en el periodo.
                </p>
              ) : (
                <div className="space-y-2">
                  {report.byUser.map((row) => (
                    <div key={row.userId ?? "desconocido"} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--app-text-strong)]">{row.name ?? "Usuario desconocido"}</p>
                        {row.email ? <p className="truncate text-[var(--app-text-muted)]">{row.email}</p> : null}
                      </div>
                      <span className="shrink-0">
                        {row.tokens} tokens · {row.requests} solicitudes
                      </span>
                    </div>
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

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-[var(--app-text-muted)]">{label}</p>
      <strong className="text-lg">{value}</strong>
    </div>
  );
}
