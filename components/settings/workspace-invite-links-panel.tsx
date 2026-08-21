"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_LABELS: Record<string, string> = { ADMIN: "Administrador", EDITOR: "Editor", VIEWER: "Visualizador" };

type InviteLink = { id: string; role: string; expiresAt: string; maxUses: number | null; useCount: number; revokedAt: string | null; createdAt: string };

type ListPayload = { links: InviteLink[] };
type CreatePayload = { link: InviteLink; token: string };

export function WorkspaceInviteLinksPanel({ workspaceId }: { workspaceId: string }) {
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [role, setRole] = useState("VIEWER");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [maxUses, setMaxUses] = useState("");
  const [createdToken, setCreatedToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invite-links`, { cache: "no-store" });
      const payload: unknown = await response.json();
      if (!response.ok || !isListPayload(payload)) throw new Error(readError(payload, "No se pudieron cargar los enlaces"));
      setLinks(payload.links);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los enlaces");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLinks(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLinks]);

  async function handleCreate() {
    setPending(true);
    setError("");
    setNotice("");
    setCreatedToken("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invite-links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, expiresInDays: Number(expiresInDays), maxUses: maxUses ? Number(maxUses) : null }) });
      const payload: unknown = await response.json();
      if (!response.ok || !isCreatePayload(payload)) throw new Error(readError(payload, "No se pudo crear el enlace"));
      setCreatedToken(`${window.location.origin}/workspace-invite/${payload.token}`);
      setNotice("Enlace creado. Cópialo ahora; no volveremos a mostrar el token.");
      await loadLinks();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear el enlace");
    } finally {
      setPending(false);
    }
  }

  async function handleRevoke(linkId: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invite-links`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ linkId }) });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(readError(payload, "No se pudo revocar el enlace"));
      await loadLinks();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "No se pudo revocar el enlace");
    } finally {
      setPending(false);
    }
  }

  async function copyToken() {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setNotice("Enlace copiado al portapapeles.");
  }

  return <div className="space-y-6"><Card className="border-[var(--app-border)] bg-[var(--app-surface)]"><CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Enlaces de invitación</CardTitle><CardDescription>Crea enlaces con rol, expiración y usos limitados para incorporar miembros sin enviar emails individuales.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><label className="space-y-2 text-sm font-medium">Rol<select className="flex h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value)}><option value="VIEWER">Visualizador</option><option value="EDITOR">Editor</option><option value="ADMIN">Administrador</option></select></label><label className="space-y-2 text-sm font-medium">Expira en días<input className="flex h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm" type="number" min="1" max="30" value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} /></label><label className="space-y-2 text-sm font-medium">Máximo de usos<input className="flex h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm" type="number" min="1" max="1000" placeholder="Ilimitado" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} /></label></div><Button type="button" className="gap-2" disabled={pending} onClick={() => void handleCreate()}><Link2 className="h-4 w-4" />{pending ? "Procesando..." : "Crear enlace"}</Button>{createdToken ? <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 p-4"><p className="text-sm font-medium text-sky-950">Enlace disponible una sola vez</p><div className="flex flex-col gap-2 sm:flex-row"><input readOnly aria-label="Enlace de invitación creado" className="min-w-0 flex-1 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs text-slate-700" value={createdToken} /><Button type="button" variant="outline" className="gap-2" onClick={() => void copyToken()}><Copy className="h-4 w-4" />Copiar</Button></div></div> : null}{notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}{error ? <p className="text-sm text-rose-700">{error}</p> : null}</CardContent></Card><Card className="border-[var(--app-border)] bg-[var(--app-surface)]"><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Enlaces activos</CardTitle><CardDescription>Revoca inmediatamente cualquier enlace que ya no deba aceptar miembros.</CardDescription></div><Button type="button" variant="outline" className="gap-2" disabled={loading} onClick={() => void loadLinks()}><RefreshCw className="h-4 w-4" />Actualizar</Button></div></CardHeader><CardContent>{loading ? <div className="flex items-center gap-2 py-6 text-sm text-[var(--app-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Cargando enlaces...</div> : links.length === 0 ? <p className="rounded-2xl border border-dashed border-[var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-text-muted)]">No hay enlaces de invitación.</p> : <div className="space-y-3">{links.map((link) => <div key={link.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-[var(--app-text-strong)]">{ROLE_LABELS[link.role] ?? link.role}</p><p className="text-sm text-[var(--app-text-muted)]">{link.useCount}{link.maxUses === null ? " usos · ilimitado" : ` / ${link.maxUses} usos`} · expira {formatDate(link.expiresAt)}</p></div>{link.revokedAt ? <span className="text-sm text-rose-700">Revocado</span> : <Button type="button" variant="ghost" className="w-fit gap-2 text-rose-600 hover:text-rose-700" disabled={pending} onClick={() => void handleRevoke(link.id)}><Trash2 className="h-4 w-4" />Revocar</Button>}</div>)}</div>}</CardContent></Card></div>;
}

function isListPayload(value: unknown): value is ListPayload { return typeof value === "object" && value !== null && "links" in value && Array.isArray(value.links); }
function isCreatePayload(value: unknown): value is CreatePayload { return typeof value === "object" && value !== null && "link" in value && "token" in value && typeof value.token === "string"; }
function readError(value: unknown, fallback: string) { return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : fallback; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "fecha no disponible" : new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(date); }
