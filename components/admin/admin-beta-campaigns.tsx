"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, Filter, FlaskConical, Pause, Play, Plus, Users } from "lucide-react";
import type { AdminBetaAnalytics } from "@/lib/data/admin-beta-analytics";
import { AdminBetaCampaignDetail, type CampaignDetail } from "@/components/admin/admin-beta-campaign-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Campaign = {
  id: string;
  name: string;
  code: string | null;
  durationDays: number;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "FINISHED";
  assignmentMode: "AUTOMATIC" | "ADMIN" | "CODE" | "MIXED";
  startsAt: string | Date;
  endsAt: string | Date | null;
  maxAssignments: number | null;
  assignedCount: number;
};

export function AdminBetaCampaigns({
  campaigns,
  analytics,
  canManage,
  canExport,
  selectedCampaignId,
  selectedDuration,
  marketingFrom,
  marketingTo,
}: {
  campaigns: Campaign[];
  analytics: AdminBetaAnalytics;
  canManage: boolean;
  canExport: boolean;
  selectedCampaignId?: string;
  selectedDuration?: 60 | 90;
  marketingFrom?: string;
  marketingTo?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);

  function loadCampaignDetail(campaignId: string, filters: { query?: string; status?: string; source?: string; page?: number } = {}) {
    setActiveCampaignId(campaignId);
    setMessage(null);
    const params = new URLSearchParams({ page: String(filters.page ?? 1), pageSize: "25" });
    if (filters.query) params.set("q", filters.query);
    if (filters.status) params.set("status", filters.status);
    if (filters.source) params.set("source", filters.source);
    startTransition(async () => {
      const response = await fetch(`/api/admin/beta/campaigns/${campaignId}?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as { campaign?: CampaignDetail; error?: string; grantsPagination?: CampaignDetail["grantsPagination"] } | null;
      if (!response.ok || !payload?.campaign) {
        setMessage(payload?.error ?? "No se pudo cargar el detalle de la campaña.");
        return;
      }
      setDetail({ ...payload.campaign, grantsPagination: payload.grantsPagination });
    });
  }

  function transitionCampaign(campaign: Campaign) {
    const status = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/beta/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(response.ok ? `Campaña ${status === "ACTIVE" ? "activada" : "pausada"}.` : payload?.error ?? "No se pudo actualizar la campaña.");
      if (response.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-8">
        <Metric label="Elegibles" value={analytics.metrics.eligible} />
        <Metric label="Asignados" value={analytics.metrics.assigned} />
        <Metric label="Activados" value={analytics.metrics.activated} suffix={`${analytics.metrics.activationRate}%`} />
        <Metric label="Upgrade" value={analytics.metrics.upgradeClicked} />
        <Metric label="Checkout" value={analytics.metrics.checkoutStarted} />
        <Metric label="Convertidos" value={analytics.metrics.converted} suffix={`${analytics.metrics.conversionRate}%`} />
        <Metric label="Vencen ≤14d" value={analytics.metrics.expiringWithin14d} />
        <Metric label="Sin conversión" value={analytics.metrics.expiredWithoutConversion} />
      </section>

      <form action="/admin" method="get" className="theme-muted-panel grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_180px_auto_auto] md:items-end">
        <input type="hidden" name="adminTab" value="beta" />
        {marketingFrom ? <input type="hidden" name="marketingFrom" value={marketingFrom} /> : null}
        {marketingTo ? <input type="hidden" name="marketingTo" value={marketingTo} /> : null}
        <label className="grid gap-1 text-xs font-medium text-[var(--app-text-muted)]">
          Campaña
          <Select name="betaCampaignId" defaultValue={selectedCampaignId ?? ""}>
            <option value="">Todas las campañas</option>
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </Select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-[var(--app-text-muted)]">
          Duración
          <Select name="betaDuration" defaultValue={selectedDuration ? String(selectedDuration) : ""}>
            <option value="">60 y 90 días</option>
            <option value="60">Solo 60 días</option>
            <option value="90">Solo 90 días</option>
          </Select>
        </label>
        <Button type="submit" className="gap-2"><Filter className="h-4 w-4" />Aplicar filtros</Button>
        <p className="text-xs text-[var(--app-text-subtle)] md:pb-2">Observación: {analytics.observationWindowDays} días</p>
      </form>

      {canManage ? <CreateCampaignForm onCreated={() => router.refresh()} onMessage={setMessage} /> : null}

      <Card className="theme-surface-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="theme-filter-button-active inline-flex h-10 w-10 items-center justify-center rounded-2xl">
              <FlaskConical className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>Campañas beta</CardTitle>
              <p className="theme-muted-text mt-1 text-sm">Administra accesos Pro temporales sin mezclarlos con facturación.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {campaigns.length === 0 ? (
            <p className="theme-dashed-panel theme-muted-text rounded-2xl border px-4 py-8 text-center text-sm">Aún no hay campañas beta.</p>
          ) : (
            campaigns.map((campaign) => (
              <div key={campaign.id} className="theme-surface-card flex flex-col gap-4 rounded-2xl border p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="theme-strong-text font-semibold">{campaign.name}</p>
                    <span className="theme-status-info theme-status-info-strong rounded-full px-2.5 py-1 text-xs font-semibold">{campaign.status}</span>
                    <span className="theme-muted-panel theme-muted-text rounded-full px-2.5 py-1 text-xs">Pro · {campaign.durationDays} días</span>
                  </div>
                  <div className="theme-muted-text mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span>{campaign.code ? `Código: ${campaign.code}` : "Sin código"}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{campaign.assignedCount}{campaign.maxAssignments ? `/${campaign.maxAssignments}` : ""}</span>
                    <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatDate(campaign.startsAt)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={isPending} onClick={() => loadCampaignDetail(campaign.id)}>Gestionar</Button>
                  {canManage && (campaign.status === "ACTIVE" || campaign.status === "PAUSED") ? (
                    <Button type="button" variant="outline" disabled={isPending} onClick={() => transitionCampaign(campaign)} className="gap-2">
                      {campaign.status === "ACTIVE" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {campaign.status === "ACTIVE" ? "Pausar" : "Activar"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {message ? <p className="theme-muted-panel theme-muted-text rounded-xl px-3 py-2 text-sm">{message}</p> : null}
        </CardContent>
      </Card>
      <Card className="theme-surface-card">
        <CardHeader>
          <CardTitle>Rendimiento comercial</CardTitle>
          <p className="theme-muted-text mt-1 text-sm">Retención y conversión observadas durante la beta y hasta 14 días después de vencer.</p>
        </CardHeader>
        <CardContent>
          {analytics.byCampaign.length === 0 ? (
            <p className="theme-muted-text rounded-xl border border-dashed px-4 py-8 text-center text-sm">No hay datos beta para los filtros seleccionados.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="theme-muted-panel theme-muted-text text-left text-xs uppercase tracking-[0.12em]">
                  <tr>
                    <th className="px-3 py-3 font-medium">Campaña</th>
                    <th className="px-3 py-3 text-right font-medium">Elegibles</th>
                    <th className="px-3 py-3 text-right font-medium">Asignados</th>
                    <th className="px-3 py-3 text-right font-medium">Activación</th>
                    <th className="px-3 py-3 text-right font-medium">W1</th>
                    <th className="px-3 py-3 text-right font-medium">W4</th>
                    <th className="px-3 py-3 text-right font-medium">W8</th>
                    <th className="px-3 py-3 text-right font-medium">Durante beta</th>
                    <th className="px-3 py-3 text-right font-medium">0–7 días</th>
                    <th className="px-3 py-3 text-right font-medium">8–14 días</th>
                    <th className="px-3 py-3 text-right font-medium">Riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.byCampaign.map((campaign) => (
                    <tr key={campaign.campaignId} className="border-t border-[var(--app-border-soft)]">
                      <td className="px-3 py-3"><p className="theme-strong-text font-medium">{campaign.campaignName}</p><p className="theme-muted-text text-xs">Pro · {campaign.durationDays} días</p></td>
                      <td className="px-3 py-3 text-right">{campaign.eligible}</td>
                      <td className="px-3 py-3 text-right">{campaign.assigned}</td>
                      <td className="px-3 py-3 text-right">{formatMetric(campaign.activated, campaign.activationRate)}</td>
                      <td className="px-3 py-3 text-right">{formatRetention(campaign.retention.w1)}</td>
                      <td className="px-3 py-3 text-right">{formatRetention(campaign.retention.w4)}</td>
                      <td className="px-3 py-3 text-right">{formatRetention(campaign.retention.w8)}</td>
                      <td className="px-3 py-3 text-right">{formatRetention(campaign.conversionWindows.duringBeta)}</td>
                      <td className="px-3 py-3 text-right">{formatRetention(campaign.conversionWindows.postExpiry0To7d)}</td>
                      <td className="px-3 py-3 text-right">{formatRetention(campaign.conversionWindows.postExpiry8To14d)}</td>
                      <td className="px-3 py-3 text-right">{campaign.expiringWithin14d > 0 || campaign.expiredWithoutConversion > 0 ? <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />{campaign.expiringWithin14d + campaign.expiredWithoutConversion}</span> : <span className="text-emerald-700">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {activeCampaignId && detail ? (
        <AdminBetaCampaignDetail
          campaign={detail}
          canManage={canManage}
          canExport={canExport}
          onReload={(filters) => loadCampaignDetail(activeCampaignId, filters)}
          onChanged={() => {
            router.refresh();
            loadCampaignDetail(activeCampaignId);
          }}
        />
      ) : null}
    </div>
  );
}

function CreateCampaignForm({ onCreated, onMessage }: { onCreated: () => void; onMessage: (message: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      code: String(formData.get("code") ?? "").trim() || null,
      durationDays: Number(formData.get("durationDays") ?? 60),
      assignmentMode: String(formData.get("assignmentMode") ?? "ADMIN"),
      startsAt: String(formData.get("startsAt") ?? ""),
      maxAssignments: String(formData.get("maxAssignments") ?? "").trim() ? Number(formData.get("maxAssignments")) : null,
      eligibilityRules: {
        requireVerifiedEmail: true,
        excludePaidSubscribers: true,
        excludePreviousBetaUsers: true,
      },
    };

    startTransition(async () => {
      const response = await fetch("/api/admin/beta/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      onMessage(response.ok ? "Campaña beta creada." : result?.error ?? "No se pudo crear la campaña.");
      if (response.ok) {
        setIsOpen(false);
        onCreated();
      }
    });
  }

  if (!isOpen) {
    return <Button type="button" disabled={isPending} onClick={() => setIsOpen(true)} className="gap-2"><Plus className="h-4 w-4" />Nueva campaña</Button>;
  }

  return (
    <Card className="theme-surface-card">
      <CardHeader><CardTitle className="text-base">Nueva campaña beta</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2"><Label htmlFor="beta-name">Nombre</Label><Input id="beta-name" name="name" required placeholder="Piloto Pro 60 días" /></div>
          <div className="space-y-2"><Label htmlFor="beta-code">Código opcional</Label><Input id="beta-code" name="code" placeholder="PILOTO60" /></div>
          <div className="space-y-2"><Label htmlFor="beta-duration">Duración</Label><Select id="beta-duration" name="durationDays" defaultValue="60"><option value="60">60 días</option><option value="90">90 días</option></Select></div>
          <div className="space-y-2"><Label htmlFor="beta-mode">Asignación</Label><Select id="beta-mode" name="assignmentMode" defaultValue="ADMIN"><option value="ADMIN">Administrativa</option><option value="AUTOMATIC">Automática</option><option value="CODE">Por código</option><option value="MIXED">Mixta</option></Select></div>
          <div className="space-y-2"><Label htmlFor="beta-starts-at">Inicio</Label><Input id="beta-starts-at" name="startsAt" type="datetime-local" required /></div>
          <div className="space-y-2"><Label htmlFor="beta-max">Máximo de asignaciones</Label><Input id="beta-max" name="maxAssignments" type="number" min="1" placeholder="50" /></div>
          <div className="flex gap-2 md:col-span-2"><Button type="submit" disabled={isPending}>{isPending ? "Creando..." : "Crear campaña"}</Button><Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return <Card className="theme-surface-card"><CardContent className="p-4"><p className="theme-muted-text text-sm">{label}</p><p className="theme-strong-text mt-2 text-2xl font-semibold">{value}{suffix ? <span className="theme-muted-text ml-2 text-sm font-normal">{suffix}</span> : null}</p></CardContent></Card>;
}

function formatMetric(value: number, rate: number) {
  return `${value} · ${rate}%`;
}

function formatRetention(value: { users: number; rate: number }) {
  return `${value.users} · ${value.rate}%`;
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
