"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Save, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ResourcePriceProviderConfigPublic, ResourcePriceProviderStatus } from "@/types/resource-pricing";

const defaultConfig: ResourcePriceProviderConfigPublic = {
  provider: "mc-presupuestos-price-api",
  status: "DISABLED",
  baseUrl: null,
  apiVersion: "v1",
  credentialConfigured: false,
  credentialMasked: "",
  timeoutMs: 8000,
  maxBatchSize: 50,
  defaultTtlHours: 24,
  allowFallback: false,
  lastHealthCheckAt: null,
  lastHealthStatus: null,
};

export function ResourcePriceProviderAdminPanel({ canManage }: { canManage: boolean }) {
  const [config, setConfig] = useState<ResourcePriceProviderConfigPublic>(defaultConfig);
  const [credential, setCredential] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/resource-price-provider-config", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as ResourcePriceProviderConfigPublic | { error?: string };
        if (!response.ok) throw new Error("error" in payload ? payload.error ?? "No se pudo cargar la configuración." : "No se pudo cargar la configuración.");
        if (active) setConfig(payload as ResourcePriceProviderConfigPublic);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la configuración.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function updateConfig(patch: Partial<ResourcePriceProviderConfigPublic>) {
    setConfig((current) => ({ ...current, ...patch }));
  }

  async function saveConfig() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/resource-price-provider-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "mc-presupuestos-price-api",
          status: config.status,
          baseUrl: config.baseUrl || null,
          apiVersion: config.apiVersion,
          ...(credential.trim() ? { credential: credential.trim() } : {}),
          timeoutMs: config.timeoutMs,
          maxBatchSize: config.maxBatchSize,
          defaultTtlHours: config.defaultTtlHours,
          allowFallback: config.allowFallback,
        }),
      });
      const payload = (await response.json()) as ResourcePriceProviderConfigPublic | { error?: string };
      if (!response.ok) throw new Error("error" in payload ? payload.error ?? "No se pudo guardar la configuración." : "No se pudo guardar la configuración.");
      setConfig(payload as ResourcePriceProviderConfigPublic);
      setCredential("");
      setMessage("Configuración guardada. El proveedor no se habilita hasta que su estado sea HEALTHY.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  async function testProvider() {
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/resource-price-providers/${config.provider}/test`, { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; latencyMs?: number; message?: string; error?: string };
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.error ?? payload.message ?? "Health check no disponible.");
      }
      setMessage(`Health check correcto${payload.latencyMs === undefined ? "" : ` · ${payload.latencyMs} ms`}.`);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "No se pudo probar el proveedor.");
    } finally {
      setTesting(false);
    }
  }

  if (!canManage) {
    return (
      <section className="theme-surface-card rounded-2xl border p-6">
        <p className="theme-strong-text font-semibold">Proveedor de precios</p>
        <p className="theme-muted-text mt-2 text-sm">Esta configuración está reservada a administradores de MC Presupuestos.</p>
      </section>
    );
  }

  return (
    <section className="theme-surface-card rounded-2xl border p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sky-600" aria-hidden="true" />
            <h2 className="theme-strong-text text-lg font-semibold">Proveedor principal de precios</h2>
          </div>
          <p className="theme-muted-text mt-1 max-w-2xl text-sm">Administra exclusivamente el servicio propio `mc-presupuestos-price-api`. Las credenciales se cifran y nunca se devuelven completas.</p>
        </div>
        <StatusBadge status={config.status} />
      </div>

      {loading ? <p className="theme-muted-text mt-6 text-sm">Cargando configuración...</p> : (
        <div className="mt-6 space-y-5">
          <div className="theme-muted-panel grid gap-4 rounded-2xl border p-4 md:grid-cols-2">
            <div>
              <p className="theme-muted-text text-xs uppercase tracking-wide">Proveedor</p>
              <p className="theme-strong-text mt-1 font-medium">MC Presupuestos Price API</p>
              <p className="theme-subtle-text mt-1 text-xs">Identificador fijo: {config.provider}</p>
            </div>
            <div>
              <p className="theme-muted-text text-xs uppercase tracking-wide">Credencial</p>
              <p className="theme-strong-text mt-1 font-medium">{config.credentialConfigured ? config.credentialMasked : "No configurada"}</p>
              {config.lastHealthCheckAt ? <p className="theme-subtle-text mt-1 text-xs">Último health check: {new Date(config.lastHealthCheckAt).toLocaleString("es-PE")}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="resource-price-base-url">Base URL</Label>
              <Input id="resource-price-base-url" value={config.baseUrl ?? ""} onChange={(event) => updateConfig({ baseUrl: event.target.value || null })} placeholder="https://price-api.example.com" />
              <p className="theme-subtle-text text-xs">Solo se usa desde el servidor. Nunca se acepta desde requests de usuarios.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-price-api-version">Versión API</Label>
              <Input id="resource-price-api-version" value={config.apiVersion} onChange={(event) => updateConfig({ apiVersion: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-price-status">Estado</Label>
              <Select id="resource-price-status" value={config.status} onChange={(event) => updateConfig({ status: event.target.value as ResourcePriceProviderStatus })}>
                <option value="DISABLED">Deshabilitado</option>
                <option value="HEALTHY">Activo / saludable</option>
                <option value="DEGRADED">Degradado</option>
                <option value="SUSPENDED">Suspendido</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-price-timeout">Timeout (ms)</Label>
              <Input id="resource-price-timeout" type="number" min={1000} max={60000} step={1000} value={config.timeoutMs} onChange={(event) => updateConfig({ timeoutMs: Number(event.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-price-batch">Lote máximo</Label>
              <Input id="resource-price-batch" type="number" min={1} max={1000} step={1} value={config.maxBatchSize} onChange={(event) => updateConfig({ maxBatchSize: Number(event.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-price-ttl">TTL (horas)</Label>
              <Input id="resource-price-ttl" type="number" min={1} max={8760} step={1} value={config.defaultTtlHours} onChange={(event) => updateConfig({ defaultTtlHours: Number(event.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-price-credential">Nueva credencial</Label>
              <Input id="resource-price-credential" type="password" autoComplete="new-password" value={credential} onChange={(event) => setCredential(event.target.value)} placeholder={config.credentialConfigured ? "Dejar vacío para conservar la actual" : "Token servicio-a-servicio"} />
            </div>
          </div>

          <div className="theme-muted-panel flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm">
            <input id="resource-price-fallback" type="checkbox" checked={config.allowFallback} onChange={(event) => updateConfig({ allowFallback: event.target.checked })} className="mt-1 h-4 w-4 accent-sky-600" />
            <div>
              <Label htmlFor="resource-price-fallback" className="theme-strong-text cursor-pointer">Permitir fallback</Label>
              <p className="theme-muted-text mt-1 text-xs">Desactivado por defecto. Solo habilítalo con una política de contingencia aprobada.</p>
            </div>
          </div>

          {error ? <p className="theme-status-error rounded-xl border px-3 py-2 text-sm"><XCircle className="mr-2 inline h-4 w-4" aria-hidden="true" />{error}</p> : null}
          {message ? <p className="theme-status-success rounded-xl border px-3 py-2 text-sm"><CheckCircle2 className="mr-2 inline h-4 w-4" aria-hidden="true" />{message}</p> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => void testProvider()} disabled={loading || saving || testing} className="gap-2">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Probar conexión
            </Button>
            <Button type="button" onClick={() => void saveConfig()} disabled={loading || saving || testing} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar configuración
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: ResourcePriceProviderStatus }) {
  const styles: Record<ResourcePriceProviderStatus, string> = {
    DISABLED: "border-slate-200 bg-slate-50 text-slate-600",
    HEALTHY: "border-emerald-200 bg-emerald-50 text-emerald-700",
    DEGRADED: "border-amber-200 bg-amber-50 text-amber-700",
    SUSPENDED: "border-rose-200 bg-rose-50 text-rose-700",
  };
  const labels: Record<ResourcePriceProviderStatus, string> = { DISABLED: "Deshabilitado", HEALTHY: "Saludable", DEGRADED: "Degradado", SUSPENDED: "Suspendido" };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${styles[status]}`}>{labels[status]}</span>;
}
