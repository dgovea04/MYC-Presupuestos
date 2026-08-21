"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type UsagePayload = {
  plan: {
    slug: string;
    name: string;
    billingMode: string;
    monthlyTokenLimit: number;
    seatLimit: number | null;
    projectLimit: number | null;
    budgetLimit: number | null;
    entitlements: string[];
  } | null;
  subscription: {
    provider: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    pastDueStartedAt: string | null;
    syncedAt: string | null;
    needsSync: boolean;
  } | null;
  seats: { used: number; limit: number | null };
  metrics: {
    members: { count: number };
    projects: { count: number };
    budgets: { count: number };
  };
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activa",
  TRIALING: "En prueba",
  PAST_DUE: "Pago vencido",
  CANCELED: "Cancelada",
  UNPAID: "Impaga",
  INCOMPLETE: "Incompleta",
  INCOMPLETE_EXPIRED: "Expirada",
};

export function WorkspaceBillingPanel({ workspaceId }: { workspaceId: string }) {
  const [usage, setUsage] = useState<UsagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    void fetch(`/api/workspaces/${workspaceId}/usage`, { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok || !isUsagePayload(payload)) throw new Error(readError(payload, "No se pudo cargar la facturación"));
        setUsage(payload);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo cargar la facturación"))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Facturación y uso
            </CardTitle>
            <CardDescription>Plan, suscripción y consumo del workspace. Solo lectura.</CardDescription>
          </div>
          <Button type="button" variant="outline" className="gap-2" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-[var(--app-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando facturación...</div>
        ) : error ? (
          <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800"><p>{error}</p><Button type="button" variant="outline" onClick={load}>Reintentar</Button></div>
        ) : usage ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Plan" value={usage.plan?.name ?? "Sin plan"} detail={usage.plan ? `Modo ${usage.plan.billingMode.toLowerCase()}` : undefined} />
              <Metric label="Asientos" value={`${usage.seats.used} / ${usage.seats.limit === null ? "∞" : usage.seats.limit}`} />
              <Metric label="Suscripción" value={usage.subscription ? (STATUS_LABELS[usage.subscription.status] ?? usage.subscription.status) : "Sin suscripción"} />
            </div>

            {usage.subscription?.needsSync ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>La suscripción está pendiente de sincronización con el proveedor de pago. Los datos pueden estar incompletos.</p>
              </div>
            ) : null}

            {usage.subscription ? (
              <div className="space-y-1 rounded-2xl border border-[var(--app-border)] p-4 text-sm">
                <Row label="Proveedor" value={usage.subscription.provider} />
                <Row label="Período" value={formatPeriod(usage.subscription.currentPeriodStart, usage.subscription.currentPeriodEnd)} />
                <Row label="Última sincronización" value={usage.subscription.syncedAt ? formatDate(usage.subscription.syncedAt) : "—"} />
              </div>
            ) : null}

            <div className="space-y-1 rounded-2xl border border-[var(--app-border)] p-4 text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Límites del plan</p>
              <Row label="Tokens IA mensuales" value={usage.plan ? formatNumber(usage.plan.monthlyTokenLimit) : "—"} />
              <Row label="Proyectos" value={usage.plan ? formatLimit(usage.plan.projectLimit) : "—"} />
              <Row label="Presupuestos" value={usage.plan ? formatLimit(usage.plan.budgetLimit) : "—"} />
            </div>

            <div className="space-y-1 rounded-2xl border border-[var(--app-border)] p-4 text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Uso actual</p>
              <Row label="Miembros" value={String(usage.metrics.members.count)} />
              <Row label="Proyectos" value={String(usage.metrics.projects.count)} />
              <Row label="Presupuestos" value={String(usage.metrics.budgets.count)} />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] p-4">
      <p className="text-xs text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--app-text-strong)]">{value}</p>
      {detail ? <p className="mt-0.5 text-xs text-[var(--app-text-subtle)]">{detail}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[var(--app-text-muted)]">{label}</span>
      <span className="font-medium text-[var(--app-text-strong)]">{value}</span>
    </div>
  );
}

function formatLimit(value: number | null) {
  return value === null ? "Ilimitado" : String(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-PE").format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatPeriod(start: string | null, end: string | null) {
  if (!start && !end) return "—";
  const parts = [start, end].filter(Boolean).map((v) => formatDate(v as string));
  return parts.join(" → ");
}

function readError(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : fallback;
}

function isUsagePayload(value: unknown): value is UsagePayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { plan?: unknown; seats?: unknown; metrics?: unknown; subscription?: unknown };
  return ("plan" in value) && ("seats" in value) && typeof candidate.seats === "object" && candidate.seats !== null && "used" in candidate.seats && ("metrics" in value) && typeof candidate.metrics === "object";
}
