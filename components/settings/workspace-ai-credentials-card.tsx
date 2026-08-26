"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Credential = { id: string; provider: string; maskedValue: string; status: string; isFallback: boolean; lastError: string | null };

type CredentialsPayload = { credentials: Credential[] };

export function WorkspaceAiCredentialsCard({ workspaceId, canManage }: { workspaceId: string; canManage: boolean }) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [provider, setProvider] = useState("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchCredentials() {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/ai-credentials`, { cache: "no-store" });
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(readError(payload, "No se pudieron cargar las credenciales."));
        if (!cancelled && isCredentials(payload)) setCredentials(payload.credentials);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudieron cargar las credenciales.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchCredentials();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function refreshCredentials() {
    const response = await fetch(`/api/workspaces/${workspaceId}/ai-credentials`, { cache: "no-store" });
    const payload: unknown = await response.json();
    if (!response.ok) throw new Error(readError(payload, "No se pudieron cargar las credenciales."));
    if (!isCredentials(payload)) throw new Error("Respuesta inválida al cargar las credenciales.");
    setCredentials(payload.credentials);
  }

  async function create() {
    setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/ai-credentials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, apiKey }) });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(readError(payload, "No se pudo guardar la credencial."));
      setApiKey(""); setNotice("Credencial guardada de forma segura."); await refreshCredentials();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la credencial."); }
    finally { setPending(false); }
  }

  async function revoke(id: string) {
    if (!window.confirm("¿Revocar esta credencial? Las nuevas ejecuciones dejarán de usarla.")) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/ai-credentials`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credentialId: id }) });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(readError(payload, "No se pudo revocar la credencial."));
      await refreshCredentials();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo revocar la credencial."); }
    finally { setPending(false); }
  }

  return <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
    <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Credenciales del Workspace</CardTitle><CardDescription>La empresa paga directamente al proveedor. Las claves completas nunca se muestran ni se envían al navegador.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {loading ? <div className="flex items-center gap-2 py-6 text-sm text-[var(--app-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando credenciales...</div> : null}
      {!loading && credentials.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-[var(--app-text-muted)]">No hay credenciales empresariales configuradas.</p> : null}
      {credentials.map((credential) => <div key={credential.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-medium">{credential.provider}</p><p className="text-xs text-[var(--app-text-muted)]">{credential.maskedValue} · {credential.status}</p>{credential.lastError ? <p className="text-xs text-rose-700">{credential.lastError}</p> : null}</div>{canManage ? <Button type="button" variant="ghost" disabled={pending} onClick={() => void revoke(credential.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button> : null}</div>)}
      {canManage ? <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]"><select className="rounded-xl border bg-[var(--app-surface)] px-3 py-2" value={provider} onChange={(event) => setProvider(event.target.value)}><option value="OPENAI">OpenAI</option><option value="GEMINI">Gemini</option><option value="OPENROUTER">OpenRouter</option></select><input className="rounded-xl border bg-[var(--app-surface)] px-3 py-2" type="password" autoComplete="new-password" placeholder="Nueva API key" value={apiKey} onChange={(event) => setApiKey(event.target.value)} /><Button type="button" disabled={pending || !apiKey.trim()} onClick={() => void create()}><Plus className="h-4 w-4" /></Button></div> : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}{error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <p className="text-xs text-[var(--app-text-muted)]">Los costos los cobra directamente el proveedor y no se descuentan de los tokens incluidos en tu membresía.</p>
    </CardContent>
  </Card>;
}
function isCredentials(value: unknown): value is CredentialsPayload { return typeof value === "object" && value !== null && "credentials" in value && Array.isArray((value as { credentials?: unknown }).credentials); }
function readError(value: unknown, fallback: string) { return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : fallback; }
