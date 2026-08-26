"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Policy = {
  mode: "PLATFORM" | "WORKSPACE" | "BYOK_ALLOWED" | "BYOK_ONLY";
  defaultProvider: "OPENAI" | "GEMINI" | "OPENROUTER";
  allowUserKeys: boolean;
  allowWorkspaceKey: boolean;
  fallbackEnabled: boolean;
  monthlyTokenLimit: number | null;
  monthlyBudgetMinor: number | null;
  hardLimit: boolean;
  allowAgentWrites: boolean;
};

const DEFAULT_POLICY: Policy = {
  mode: "PLATFORM",
  defaultProvider: "OPENAI",
  allowUserKeys: false,
  allowWorkspaceKey: false,
  fallbackEnabled: true,
  monthlyTokenLimit: null,
  monthlyBudgetMinor: null,
  hardLimit: true,
  allowAgentWrites: false,
};

export function WorkspaceAiPolicyCard({ workspaceId, canManage }: { workspaceId: string; canManage: boolean }) {
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/workspaces/${workspaceId}/ai-policy`, { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(readError(payload, "No se pudo cargar la política de IA."));
        if (!cancelled && isPolicy(payload)) setPolicy(payload);
      })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar la política de IA."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/ai-policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...policy,
          allowedProviders: ["OPENAI", "GEMINI", "OPENROUTER"],
          allowedModels: [],
          alertThresholds: [80, 90, 100],
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(readError(payload, "No se pudo guardar la política de IA."));
      setNotice("Política de IA guardada.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la política de IA.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Política de IA del Workspace</CardTitle>
        <CardDescription>Define quién aporta la credencial, quién asume el costo y qué fallback está permitido.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <div className="flex items-center gap-2 py-6 text-sm text-[var(--app-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando política...</div> : (
          <>
            <label className="block space-y-2 text-sm font-medium">Modo
              <select disabled={!canManage} className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5" value={policy.mode} onChange={(event) => setPolicy({ ...policy, mode: event.target.value as Policy["mode"] })}>
                <option value="PLATFORM">IA incluida por la plataforma</option>
                <option value="WORKSPACE">Credencial del Workspace</option>
                <option value="BYOK_ALLOWED">BYOK permitido con fallback</option>
                <option value="BYOK_ONLY">BYOK obligatorio</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm"><input disabled={!canManage} type="checkbox" checked={policy.allowUserKeys} onChange={(event) => setPolicy({ ...policy, allowUserKeys: event.target.checked })} />Permitir API keys propias de los usuarios</label>
            <label className="flex items-center gap-2 text-sm"><input disabled={!canManage} type="checkbox" checked={policy.allowWorkspaceKey} onChange={(event) => setPolicy({ ...policy, allowWorkspaceKey: event.target.checked })} />Permitir credencial empresarial del Workspace</label>
            <label className="flex items-center gap-2 text-sm"><input disabled={!canManage} type="checkbox" checked={policy.fallbackEnabled} onChange={(event) => setPolicy({ ...policy, fallbackEnabled: event.target.checked })} />Permitir fallback controlado</label>
            <label className="flex items-center gap-2 text-sm"><input disabled={!canManage} type="checkbox" checked={policy.hardLimit} onChange={(event) => setPolicy({ ...policy, hardLimit: event.target.checked })} />Bloquear solicitudes al alcanzar el límite</label>
            {canManage ? <Button type="button" className="gap-2" onClick={() => void save()} disabled={saving}><Save className="h-4 w-4" />{saving ? "Guardando..." : "Guardar política"}</Button> : <p className="text-xs text-[var(--app-text-muted)]">Solo Owner/Admin puede cambiar esta política.</p>}
          </>
        )}
        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function isPolicy(value: unknown): value is Policy {
  return typeof value === "object" && value !== null && "mode" in value && typeof value.mode === "string";
}
function readError(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : fallback;
}
