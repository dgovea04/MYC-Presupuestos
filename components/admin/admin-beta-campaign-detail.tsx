"use client";

import { useState, useTransition } from "react";
import { Ban, CalendarPlus, Download, RefreshCw, Search, Send, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

export type CampaignDetail = {
  id: string;
  name: string;
  durationDays: number;
  status: string;
  grants: Array<{
    id: string;
    userId: string;
    status: string;
    source: string;
    startsAt: string;
    expiresAt: string;
    revokedAt: string | null;
    user: { name: string; email: string };
  }>;
  grantsPagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type GrantFilters = {
  query?: string;
  status?: string;
  source?: string;
  page?: number;
};

export function AdminBetaCampaignDetail({
  campaign,
  canManage,
  canExport,
  onReload,
  onChanged,
}: {
  campaign: CampaignDetail;
  canManage: boolean;
  canExport: boolean;
  onReload: (filters: GrantFilters) => void;
  onChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [userIds, setUserIds] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<{ eligible: string[]; excluded: Array<{ userId: string; reasons: string[] }>; remainingAssignments: number | null } | null>(null);
  const [extensionDates, setExtensionDates] = useState<Record<string, string>>({});
  const [grantQuery, setGrantQuery] = useState("");
  const [grantStatus, setGrantStatus] = useState("");
  const [grantSource, setGrantSource] = useState("");

  function reloadGrants(page = 1) {
    onReload({
      query: grantQuery.trim() || undefined,
      status: grantStatus || undefined,
      source: grantSource || undefined,
      page,
    });
  }

  function getExportHref() {
    const params = new URLSearchParams({ campaignId: campaign.id });
    if (grantQuery.trim()) params.set("q", grantQuery.trim());
    if (grantStatus) params.set("status", grantStatus);
    if (grantSource) params.set("source", grantSource);
    return `/api/admin/beta/grants/export?${params.toString()}`;
  }

  function getUserIdList() {
    return [...new Set(userIds.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean))];
  }

  function runAssignment(dryRun: boolean) {
    const ids = getUserIdList();
    if (ids.length === 0) {
      setMessage("Ingresa al menos un ID de usuario.");
      return;
    }
    if (!reason.trim() && !dryRun) {
      setMessage("Indica el motivo de la asignación.");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/beta/campaigns/${campaign.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: ids, dryRun, reason: reason.trim() || null, source: "ADMIN" }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        eligible?: string[];
        excluded?: Array<{ userId: string; reasons: string[] }>;
        remainingAssignments?: number | null;
        assigned?: Array<{ userId: string }>;
        errors?: Array<{ userId: string; error: string }>;
      } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "No se pudo procesar la asignación.");
        return;
      }

      if (dryRun) {
        setPreview({
          eligible: payload?.eligible ?? [],
          excluded: payload?.excluded ?? [],
          remainingAssignments: payload?.remainingAssignments ?? null,
        });
        setMessage("Preview generado. Revisa los usuarios elegibles antes de confirmar.");
      } else {
        setPreview(null);
        setMessage(`Asignación completada: ${payload?.assigned?.length ?? 0} usuarios procesados${payload?.errors?.length ? `, ${payload.errors.length} con error` : ""}.`);
        setUserIds("");
        onChanged();
      }
    });
  }

  function revokeGrant(grantId: string) {
    const confirmation = window.prompt("Indica el motivo de la revocación (mínimo 10 caracteres).");
    if (!confirmation) return;

    startTransition(async () => {
      const response = await fetch(`/api/admin/beta/grants/${grantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REVOKE", reason: confirmation }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(response.ok ? "Grant revocado." : payload?.error ?? "No se pudo revocar el grant.");
      if (response.ok) onChanged();
    });
  }

  function extendGrant(grantId: string) {
    const newExpiresAt = extensionDates[grantId];
    if (!newExpiresAt) {
      setMessage("Selecciona una nueva fecha de vencimiento.");
      return;
    }
    const extensionReason = window.prompt("Indica el motivo de la extensión (mínimo 10 caracteres).");
    if (!extensionReason) return;

    startTransition(async () => {
      const response = await fetch(`/api/admin/beta/grants/${grantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "EXTEND", newExpiresAt: new Date(newExpiresAt).toISOString(), reason: extensionReason }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(response.ok ? "Grant extendido." : payload?.error ?? "No se pudo extender el grant.");
      if (response.ok) onChanged();
    });
  }

  return (
    <Card className="theme-surface-card border-sky-200">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Gestionar {campaign.name}</CardTitle>
            <p className="theme-muted-text mt-1 text-sm">{campaign.durationDays} días · {campaign.grants.length} grants recientes</p>
          </div>
          <span className="theme-status-info theme-status-info-strong rounded-full px-2.5 py-1 text-xs font-semibold">{campaign.status}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {canManage ? (
          <div className="theme-muted-panel space-y-3 rounded-2xl border p-4">
            <div className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-sky-600" /><p className="theme-strong-text text-sm font-semibold">Asignar usuarios</p></div>
            <div className="space-y-2"><Label htmlFor="beta-user-ids">IDs de usuario</Label><Textarea id="beta-user-ids" value={userIds} onChange={(event) => setUserIds(event.target.value)} placeholder="Un ID por línea o separados por coma" /></div>
            <div className="space-y-2"><Label htmlFor="beta-assignment-reason">Motivo</Label><Input id="beta-assignment-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Piloto de constructoras" /></div>
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={isPending} onClick={() => runAssignment(true)} className="gap-2"><RefreshCw className="h-4 w-4" />Previsualizar</Button><Button type="button" disabled={isPending} onClick={() => runAssignment(false)} className="gap-2"><Send className="h-4 w-4" />Asignar elegibles</Button></div>
            {preview ? <div className="theme-surface-card space-y-2 rounded-xl border p-3 text-sm"><p className="theme-strong-text">Elegibles: {preview.eligible.length} · Cupos restantes: {preview.remainingAssignments ?? "ilimitados"}</p>{preview.excluded.length > 0 ? <p className="theme-muted-text">Excluidos: {preview.excluded.map((item) => `${item.userId} (${item.reasons.join(", ")})`).join("; ")}</p> : null}</div> : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2"><CalendarPlus className="h-4 w-4 text-sky-600" /><p className="theme-strong-text text-sm font-semibold">Grants</p></div>
            {canExport ? <a href={getExportHref()} className="theme-filter-button inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"><Download className="h-4 w-4" />Exportar CSV</a> : null}
          </div>
          <form className="theme-muted-panel grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_auto_auto_auto]" onSubmit={(event) => { event.preventDefault(); reloadGrants(1); }}>
            <label className="sr-only" htmlFor="beta-grant-search">Buscar grants</label>
            <div className="relative"><Search className="theme-muted-text pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><Input id="beta-grant-search" value={grantQuery} onChange={(event) => setGrantQuery(event.target.value)} placeholder="Buscar por nombre, correo o ID" className="pl-9" /></div>
            <Select aria-label="Filtrar grants por estado" value={grantStatus} onChange={(event) => setGrantStatus(event.target.value)}><option value="">Todos los estados</option><option value="SCHEDULED">Programados</option><option value="ACTIVE">Activos</option><option value="EXPIRED">Vencidos</option><option value="REVOKED">Revocados</option></Select>
            <Select aria-label="Filtrar grants por origen" value={grantSource} onChange={(event) => setGrantSource(event.target.value)}><option value="">Todos los orígenes</option><option value="ADMIN">Administrativo</option><option value="AUTOMATIC">Automático</option><option value="CODE">Código</option><option value="IMPORT">Importación</option></Select>
            <Button type="submit" disabled={isPending} className="gap-2"><Search className="h-4 w-4" />Buscar</Button>
          </form>
          {campaign.grants.length === 0 ? <p className="theme-muted-text rounded-xl border border-dashed px-3 py-5 text-sm">No encontramos grants con estos filtros.</p> : campaign.grants.map((grant) => (
            <div key={grant.id} className="theme-surface-card space-y-3 rounded-xl border p-3 text-sm">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div><p className="theme-strong-text font-medium">{grant.user.name}</p><p className="theme-muted-text">{grant.user.email} · {grant.source}</p></div>
                <span className={grant.status === "REVOKED" ? "theme-status-error rounded-full px-2.5 py-1 text-xs font-semibold" : "theme-status-info theme-status-info-strong rounded-full px-2.5 py-1 text-xs font-semibold"}>{grant.status}</span>
              </div>
              <div className="theme-muted-text flex flex-wrap gap-x-4 gap-y-1 text-xs"><span>Desde {formatDate(grant.startsAt)}</span><span>Hasta {formatDate(grant.expiresAt)}</span></div>
              {canManage && grant.status !== "REVOKED" ? <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><Input aria-label={`Nueva fecha para ${grant.user.email}`} type="datetime-local" value={extensionDates[grant.id] ?? ""} onChange={(event) => setExtensionDates((current) => ({ ...current, [grant.id]: event.target.value }))} /><Button type="button" variant="outline" disabled={isPending} onClick={() => extendGrant(grant.id)} className="gap-2"><CalendarPlus className="h-4 w-4" />Extender</Button><Button type="button" variant="outline" disabled={isPending} onClick={() => revokeGrant(grant.id)} className="gap-2"><Ban className="h-4 w-4" />Revocar</Button></div> : null}
            </div>
          ))}
          {campaign.grantsPagination && campaign.grantsPagination.totalPages > 1 ? <div className="flex flex-col gap-3 pt-2 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="theme-muted-text">Página {campaign.grantsPagination.page} de {campaign.grantsPagination.totalPages} · {campaign.grantsPagination.total} grants</p><div className="flex gap-2">{campaign.grantsPagination.page > 1 ? <Button type="button" variant="outline" disabled={isPending} onClick={() => reloadGrants(campaign.grantsPagination!.page - 1)}>Anterior</Button> : null}{campaign.grantsPagination.page < campaign.grantsPagination.totalPages ? <Button type="button" disabled={isPending} onClick={() => reloadGrants(campaign.grantsPagination!.page + 1)}>Siguiente</Button> : null}</div></div> : null}
        </div>
        {message ? <p className="theme-muted-panel theme-muted-text rounded-xl px-3 py-2 text-sm">{message}</p> : null}
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
