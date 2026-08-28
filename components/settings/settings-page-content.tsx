"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Bot, CloudCog, FileScan, HardDrive, Loader2, PanelTop, Save, Settings2, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyProfileCard } from "@/components/settings/company-profile-card";
import { LocalAiSettingsCard } from "@/components/settings/local-ai-settings-card";
import { CloudAiSettingsCard } from "@/components/settings/cloud-ai-settings-card";
import { PdfImportAiSettingsCard } from "@/components/settings/pdf-import-ai-settings-card";
import { FloatingKhipuSettingsCard } from "@/components/settings/floating-khipu-settings-card";
import { KhipuAgentSettingsCard } from "@/components/settings/khipu-agent-settings-card";
import { UserSettingsForm } from "@/components/settings/user-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoCard } from "@/components/ui/info-cards";
import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { APP_SETTINGS_UPDATED_EVENT } from "@/lib/settings/events";
import { WorkCalendarsSettings } from "@/components/settings/work-calendars-settings";
import { WorkspaceAuditPanel } from "@/components/settings/workspace-audit-panel";
import { WorkspaceSeatUsageCard } from "@/components/settings/workspace-seat-usage-card";
import { WorkspaceInviteLinksPanel } from "@/components/settings/workspace-invite-links-panel";
import { WorkspaceBulkInvitePanel } from "@/components/settings/workspace-bulk-invite-panel";
import { WorkspaceBillingPanel } from "@/components/settings/workspace-billing-panel";
import { WorkspaceRolesPanel } from "@/components/settings/workspace-roles-panel";
import { WorkspaceAiPolicyCard } from "@/components/settings/workspace-ai-policy-card";
import { WorkspaceAiCredentialsCard } from "@/components/settings/workspace-ai-credentials-card";
import { WorkspaceAiContextCard } from "@/components/settings/workspace-ai-context-card";
import { WorkspaceAiUsageDashboard } from "@/components/settings/workspace-ai-usage-dashboard";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { isLocalClientRuntimeEnabled } from "@/lib/runtime/local-capabilities";

import type { AccountRecord } from "@/types/account";
import type { UserSettingsRecord } from "@/types/settings";

const DATE_FORMAT_LABELS = {
  DD_MM_YYYY: "dd/MM/yyyy",
  DD_MMM_YYYY: "dd MMM yyyy",
  DD_MM: "dd/MM",
} as const;

const SETTINGS_TABS = [
  {
    id: "general",
    label: "General",
    description: "Empresa, firma documental y resumen operativo.",
  },
  {
    id: "formats",
    label: "Formatos y visualizacion",
    description: "Moneda, fechas, tema, Excel y sub presupuestos base.",
  },
  {
    id: "ai",
    label: "IA",
    description: "Proveedores cloud, capacidades locales y configuracion de Khipu.",
  },
  {
    id: "workspace",
    label: "Workspace",
    description: "Empresa, miembros, permisos, invitaciones, facturación y auditoría.",
  },
  {
    id: "calendars",
    label: "Calendarios",
    description: "Calendarios laborales personalizados con dias y horas por proyecto.",
  },
] as const;

const FORMAT_FORM_ID = "format-settings-form";

const AI_SETTINGS_TABS = [
  { id: "cloud", label: "Proveedores Cloud IA", description: "API keys y modelos cloud.", icon: CloudCog },
  { id: "floating", label: "Panel Flotante Khipu", description: "Configura el asistente flotante.", icon: PanelTop },
  { id: "agent", label: "Khipu Agente", description: "Herramientas, permisos y modelo del agente.", icon: Bot },
  { id: "pdf", label: "Importador PDF IA", description: "Proveedor para extraer datos desde PDF.", icon: FileScan },
  { id: "local", label: "Integración de IA Local", description: "Conecta modelos locales con Ollama." },
] as const;

type AiSettingsTabId = (typeof AI_SETTINGS_TABS)[number]["id"];

type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

export function SettingsPageContent({
  company,
  account,
  initialSettings,
  initialWorkCalendars,
  canUseKhipu = true,
  activeWorkspaceId,
  canManageWorkspaceAi = false,
}: {
  company?: {
    name?: string | null;
    ruc?: string | null;
    logoUrl?: string | null;
  };
  account: AccountRecord;
  initialSettings: UserSettingsRecord;
  initialWorkCalendars?: { id: string; name: string; workDays: number; workHoursPerDay: number }[];
  canUseKhipu?: boolean;
  activeWorkspaceId?: string;
  canManageWorkspaceAi?: boolean;
}) {
  const [companyState, setCompanyState] = useState(company);
  const [settings, setSettings] = useState(initialSettings);
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");
  const [activeAiTab, setActiveAiTab] = useState<AiSettingsTabId>("cloud");
  const [formatSaving, setFormatSaving] = useState(false);
  const currencyPreview = useMemo(
    () => formatCurrency(7723.48, settings.defaultCurrency, settings.currencyDecimals),
    [settings.currencyDecimals, settings.defaultCurrency],
  );
  const decimalsPreview = useMemo(() => formatNumber(7723.48, settings.currencyDecimals), [settings.currencyDecimals]);
  const datePreview = useMemo(() => formatDate("2026-05-12T00:00:00.000Z", settings.dateFormat), [settings.dateFormat]);

  return (
    <div className="space-y-6">
      <Card className="theme-surface-card">
        <CardHeader className="space-y-5">
          <div className="space-y-2">
            <CardTitle>Configuracion</CardTitle>
            <CardDescription>
              Agrupa tus ajustes por seccion para limpiar la vista y encontrar mas rapido lo que necesitas cambiar.
            </CardDescription>
          </div>
          <div className="p-2">
            <div className="grid gap-2 md:grid-cols-3">
              {SETTINGS_TABS.map((tab) => {
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={isActive}
                    aria-controls={`settings-tab-panel-${tab.id}`}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition",
                      isActive
                        ? "border-sky-300 bg-white text-slate-950 shadow-sm shadow-slate-950/5 dark:border-sky-500 dark:bg-slate-800 dark:text-slate-50 dark:shadow-black/20"
                        : "border-[var(--app-border)] bg-transparent text-[var(--app-text-muted)] hover:bg-white/70 hover:text-[var(--app-text-strong)] dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-50",
                    )}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <p className="text-sm font-semibold">{tab.label}</p>
                    <p className="mt-1 text-xs leading-5">{tab.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
      </Card>

      <section
        id="settings-tab-panel-general"
        aria-hidden={activeTab !== "general"}
        className={cn(activeTab === "general" ? "block" : "hidden")}
      >
        <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <CompanyProfileCard company={companyState} onSaved={setCompanyState} />

            <Card className="theme-surface-card-gradient">
              <CardHeader>
                <CardTitle>Previsualizacion documental</CardTitle>
                <CardDescription>Lectura rapida de como se vera la firma base en PDF y Excel.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="theme-surface-panel theme-soft-shadow rounded-3xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="theme-subtle-text text-xs font-semibold uppercase tracking-[0.22em]">Firma documental</p>
                      <p className="theme-muted-text mt-2 text-sm">Responsable, empresa y firma visual que acompanaran los exportes.</p>
                    </div>
                    <div className="theme-muted-panel flex h-14 w-14 items-center justify-center rounded-2xl">
                      {companyState?.logoUrl ? (
                        <Image src={companyState.logoUrl} alt="Logo de empresa" width={42} height={42} className="max-h-10 w-auto object-contain" />
                      ) : (
                        <span className="theme-subtle-text text-[10px] font-semibold uppercase tracking-[0.18em]">Logo</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <PreviewRow label="Empresa" value={companyState?.name ?? "Pendiente"} />
                    <PreviewRow label="Responsable" value={account.name} />
                    <PreviewRow label="Cargo" value={account.jobTitle || "Pendiente"} />
                    <PreviewRow label="Telefono" value={account.phone || "Pendiente"} />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <SignaturePreview
                      title="Firma del responsable"
                      primary={account.name}
                      secondary={account.jobTitle || companyState?.name || "Cargo pendiente"}
                    />
                    <SignaturePreview
                      title="Vo. Bo. / aprobacion"
                      primary="Cliente o aprobador"
                      secondary="Se completara al exportar cada documento"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="theme-surface-card-gradient">
              <CardHeader>
                <CardTitle>Resumen rapido</CardTitle>
                <CardDescription>Lectura corta del estado actual de tus ajustes globales.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoCard label="Empresa" value={companyState?.name ?? "Pendiente"} layout="inline" />
                <InfoCard label="Logo" value={companyState?.logoUrl ? "Disponible" : "Pendiente"} layout="inline" />
                <InfoCard label="Moneda" value={settings.defaultCurrency} layout="inline" />
                <InfoCard label="Fecha" value={DATE_FORMAT_LABELS[settings.dateFormat]} layout="inline" />
                <InfoCard label="Vista" value={settings.defaultViewMode === "excel" ? "Modo Excel" : "Moderna"} layout="inline" />
                <InfoCard label="Tema" value={settings.appTheme === "dark" ? "Oscuro" : "Claro"} layout="inline" />
                <InfoCard label="Filas Excel" value={`${settings.excelRowHeight}px`} layout="inline" />
                <InfoCard label="Sub Presupuestos" value={`${settings.defaultSubBudgetNames.length} base`} layout="inline" />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section
        id="settings-tab-panel-workspace"
        aria-hidden={activeTab !== "workspace"}
        className={cn(activeTab === "workspace" ? "block" : "hidden")}
      >
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--app-text-strong)]">Workspace</h2>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">
              Administra la identidad, el acceso y la operación del workspace desde un solo lugar.
            </p>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              {activeWorkspaceId ? <WorkspaceSeatUsageCard workspaceId={activeWorkspaceId} /> : null}
              {activeWorkspaceId ? <WorkspaceBulkInvitePanel workspaceId={activeWorkspaceId} /> : null}
              {activeWorkspaceId ? <WorkspaceInviteLinksPanel workspaceId={activeWorkspaceId} /> : null}
              {activeWorkspaceId ? <WorkspaceAuditPanel workspaceId={activeWorkspaceId} /> : null}
              {activeWorkspaceId ? <WorkspaceRolesPanel workspaceId={activeWorkspaceId} /> : null}
            </div>

            <div className="space-y-6">
              {activeWorkspaceId ? <WorkspaceAiPolicyCard workspaceId={activeWorkspaceId} canManage={canManageWorkspaceAi === true} /> : null}
              {activeWorkspaceId ? <WorkspaceAiContextCard workspaceId={activeWorkspaceId} /> : null}
              {activeWorkspaceId && canManageWorkspaceAi ? <WorkspaceAiUsageDashboard workspaceId={activeWorkspaceId} /> : null}
              {activeWorkspaceId ? <WorkspaceAiCredentialsCard workspaceId={activeWorkspaceId} canManage={canManageWorkspaceAi === true} /> : null}
              {activeWorkspaceId ? <WorkspaceBillingPanel workspaceId={activeWorkspaceId} /> : null}
              {activeWorkspaceId ? <WorkspaceDangerZone workspaceId={activeWorkspaceId} workspaceName={companyState?.name ?? ""} /> : null}
            </div>
          </div>
        </div>
      </section>

      <section
        id="settings-tab-panel-formats"
        aria-hidden={activeTab !== "formats"}
        className={cn(activeTab === "formats" ? "block" : "hidden")}
      >
        <Card className="theme-surface-card-warm">
          <CardHeader className="rounded-2xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="theme-status-warning theme-status-warning-strong rounded-2xl p-2">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Formato y visualizacion</CardTitle>
                  <CardDescription>
                    Define como quieres ver montos y los porcentajes base que usas al crear presupuestos.
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  form={FORMAT_FORM_ID}
                  disabled={formatSaving}
                  className="gap-2"
                >
                  {formatSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-3 md:grid-cols-3">
              <InfoCard
                label="Moneda"
                value={settings.defaultCurrency}
                tone="sky"
                previewLabel="Vista previa"
                previewValue={currencyPreview}
              />
              <InfoCard
                label="Decimales"
                value={String(settings.currencyDecimals)}
                tone="slate"
                previewLabel="Vista previa"
                previewValue={decimalsPreview}
              />
              <InfoCard
                label="Fecha"
                value={DATE_FORMAT_LABELS[settings.dateFormat]}
                tone="amber"
                previewLabel="Vista previa"
                previewValue={datePreview}
              />
              <InfoCard
                label="Vista global"
                value={settings.defaultViewMode === "excel" ? "Modo Excel" : "Vista moderna"}
                tone="slate"
                previewLabel="Filas"
                previewValue={`${settings.excelRowHeight}px`}
              />
              <InfoCard
                label="Tema app"
                value={settings.appTheme === "dark" ? "Oscuro" : "Claro"}
                tone={settings.appTheme === "dark" ? "slate" : "sky"}
                previewLabel="Aplicacion"
                previewValue="Shell, cards y tablas"
              />
            </div>
            <UserSettingsForm
              initialSettings={settings}
              formId={FORMAT_FORM_ID}
              onSavingChange={setFormatSaving}
              onSaved={(saved) => {
                setSettings(saved);
                window.dispatchEvent(new CustomEvent(APP_SETTINGS_UPDATED_EVENT, { detail: saved }));
                window.dispatchEvent(new CustomEvent("khipu-settings-changed", { detail: saved }));
              }}
            />
          </CardContent>
        </Card>
      </section>

      <section
        id="settings-tab-panel-calendars"
        aria-hidden={activeTab !== "calendars"}
        className={cn(activeTab === "calendars" ? "block" : "hidden")}
      >
        <WorkCalendarsSettings initialCalendars={initialWorkCalendars} />
      </section>

      <section
        id="settings-tab-panel-ai"
        aria-hidden={activeTab !== "ai"}
        className={cn(activeTab === "ai" ? "block" : "hidden")}
      >
        <div className="space-y-6">
          {canUseKhipu ? (
            <>
              <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-2 dark:border-slate-700 dark:bg-slate-900/40" role="tablist" aria-label="Configuración de IA">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {AI_SETTINGS_TABS.filter((tab) => tab.id !== "local" || isLocalClientRuntimeEnabled()).map((tab) => {
                  const isActive = activeAiTab === tab.id;
                  const Icon = "icon" in tab ? tab.icon : HardDrive;
                  return (
                    <button key={tab.id} type="button" role="tab" aria-selected={isActive} aria-controls={`settings-ai-panel-${tab.id}`} onClick={() => setActiveAiTab(tab.id)} className={cn("flex min-h-14 items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-offset-2", isActive ? "border-sky-300 bg-white text-sky-800 shadow-sm dark:border-sky-500 dark:bg-slate-800 dark:text-sky-200" : "border-transparent text-[var(--app-text-muted)] hover:border-sky-200 hover:bg-white/80 hover:text-[var(--app-text-strong)] dark:hover:border-slate-600 dark:hover:bg-slate-800")}>
                      <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-sky-600 dark:text-sky-300" : "text-slate-400")} aria-hidden="true" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
                </div>
              </div>
              <div id="settings-ai-panel-cloud" role="tabpanel" hidden={activeAiTab !== "cloud"}><CloudAiSettingsCard /></div>
              <div id="settings-ai-panel-floating" role="tabpanel" hidden={activeAiTab !== "floating"}><FloatingKhipuSettingsCard settings={settings} onSaved={(khipu) => { setSettings({ ...settings, ...khipu }); window.dispatchEvent(new CustomEvent("khipu-settings-changed", { detail: khipu })); }} /></div>
              <div id="settings-ai-panel-agent" role="tabpanel" hidden={activeAiTab !== "agent"}><KhipuAgentSettingsCard /></div>
              <div id="settings-ai-panel-pdf" role="tabpanel" hidden={activeAiTab !== "pdf"}><PdfImportAiSettingsCard /></div>
              {isLocalClientRuntimeEnabled() ? <div id="settings-ai-panel-local" role="tabpanel" hidden={activeAiTab !== "local"}><LocalAiSettingsCard /></div> : null}
            </>
          ) : (
            <UpgradeCTA
              title="Khipu y proveedores IA disponibles en Pro"
              description="Actualiza tu plan para desbloquear Khipu, sus configuraciones y las acciones asistidas dentro de presupuestos y APUs."
              benefits={["Chat tecnico contextual", "Generacion y revision de APU", "Agente con herramientas y aprobaciones"]}
            />
          )}

        </div>
      </section>
    </div>
  );
}

function WorkspaceDangerZone({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const [confirmationName, setConfirmationName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleDelete() {
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationName }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "No se pudo eliminar el workspace";
        throw new Error(message);
      }
      setSuccess("Workspace eliminado. Podrás restaurarlo dentro de 30 días; actualiza la sesión para continuar.");
      setConfirmationName("");
    } catch (deletionError) {
      setError(deletionError instanceof Error ? deletionError.message : "No se pudo eliminar el workspace");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-rose-200 bg-rose-50/40">
      <CardHeader>
        <CardTitle className="text-rose-900">Zona de peligro</CardTitle>
        <CardDescription>Eliminar un workspace lo oculta de forma reversible durante 30 días. Después de ese período se borrará permanentemente con sus proyectos, presupuestos y miembros.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="workspace-delete-confirmation" className="text-sm font-medium text-rose-950">Escribe exactamente: {workspaceName}</label>
          <input id="workspace-delete-confirmation" className="flex h-10 w-full rounded-xl border border-rose-200 bg-white px-3 text-sm" value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} />
        </div>
        <Button type="button" variant="destructive" className="gap-2" disabled={pending || confirmationName !== workspaceName} onClick={() => void handleDelete()}>
          <Trash2 className="h-4 w-4" />
          {pending ? "Eliminando..." : "Eliminar workspace"}
        </Button>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      </CardContent>
    </Card>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-muted-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
      <span className="theme-muted-text text-sm">{label}</span>
      <span className="theme-strong-text text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function SignaturePreview({
  title,
  primary,
  secondary,
}: {
  title: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="theme-dashed-panel rounded-2xl border border-dashed px-4 py-4">
      <p className="theme-subtle-text text-xs font-semibold uppercase tracking-[0.18em]">{title}</p>
      <div className="theme-border-top mt-8 border-t pt-3">
        <p className="theme-strong-text text-sm font-semibold">{primary}</p>
        <p className="theme-muted-text mt-1 text-sm">{secondary}</p>
      </div>
    </div>
  );
}
