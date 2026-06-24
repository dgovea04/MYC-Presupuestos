"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Loader2, Save, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyProfileCard } from "@/components/settings/company-profile-card";
import { LocalAiSettingsCard } from "@/components/settings/local-ai-settings-card";
import { CloudAiSettingsCard } from "@/components/settings/cloud-ai-settings-card";
import { FloatingKhipuSettingsCard } from "@/components/settings/floating-khipu-settings-card";
import { UserSettingsForm } from "@/components/settings/user-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoCard } from "@/components/ui/info-cards";
import { APP_SETTINGS_UPDATED_EVENT } from "@/lib/settings/events";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { AccountRecord } from "@/types/account";
import type { UserSettingsRecord } from "@/types/settings";

const DATE_FORMAT_LABELS = {
  DD_MM_YYYY: "dd/MM/yyyy",
  DD_MMM_YYYY: "dd MMM yyyy",
  DD_MM: "dd/MM",
} as const;

const recommendations = [
  {
    title: "Porcentajes por defecto",
    detail: "IGV, gastos generales y utilidad ya disponibles para sugerir valores base en nuevos Sub Presupuestos.",
  },
  {
    title: "Formato de fecha",
    detail: "Elegir entre dd/MM/yyyy, dd MMM yyyy o formatos mas compactos para tablas.",
  },
  {
    title: "Vista global Excel",
    detail: "Elegir si la app abre por defecto en vista moderna o en modo Excel.",
  },
  {
    title: "Bordes de campos",
    detail: "Mostrar u ocultar los bordes de inputs y selects cuando trabajas en modo Excel.",
  },
  {
    title: "Altura de filas",
    detail: "Ajustar una altura base para tablas compactas y listas virtualizadas compatibles.",
  },
] as const;

const FORMAT_FORM_ID = "format-settings-form";

export function SettingsPageContent({
  company,
  account,
  initialSettings,
}: {
  company?: {
    name?: string | null;
    ruc?: string | null;
    logoUrl?: string | null;
  };
  account: AccountRecord;
  initialSettings: UserSettingsRecord;
}) {
  const [companyState, setCompanyState] = useState(company);
  const [settings, setSettings] = useState(initialSettings);
  const [formatSaving, setFormatSaving] = useState(false);
  const currencyPreview = useMemo(
    () => formatCurrency(7723.48, settings.defaultCurrency, settings.currencyDecimals),
    [settings.currencyDecimals, settings.defaultCurrency],
  );
  const decimalsPreview = useMemo(() => formatNumber(7723.48, settings.currencyDecimals), [settings.currencyDecimals]);
  const datePreview = useMemo(() => formatDate("2026-05-12T00:00:00.000Z", settings.dateFormat), [settings.dateFormat]);

  return (
    <div className="space-y-6">
      <section className="grid items-start gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <CompanyProfileCard company={companyState} onSaved={setCompanyState} />

          <LocalAiSettingsCard />

          <CloudAiSettingsCard />

          <FloatingKhipuSettingsCard
            settings={settings}
            onSaved={(khipu) => {
              setSettings({ ...settings, ...khipu });
              // Broadcast to the floating assistant (which sits outside
              // the FormattingSettingsProvider context tree).
              window.dispatchEvent(new CustomEvent("khipu-settings-changed", { detail: khipu }));
            }}
          />

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
                  // Broadcast to the floating assistant so it picks up
                  // currency, decimals, date format, and other general settings.
                  window.dispatchEvent(new CustomEvent("khipu-settings-changed", { detail: saved }));
                }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-5">
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

          <Card className="theme-surface-card">
            <CardHeader>
              <CardTitle>Proximos ajustes recomendados</CardTitle>
              <CardDescription>Pequenas mejoras con bastante impacto en la operacion diaria.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations.map((item) => (
                <div key={item.title} className="theme-muted-panel rounded-2xl px-4 py-4">
                  <p className="theme-strong-text font-medium">{item.title}</p>
                  <p className="theme-muted-text mt-1.5 text-sm">{item.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
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
