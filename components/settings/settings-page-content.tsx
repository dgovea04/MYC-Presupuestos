"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Settings2 } from "lucide-react";
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

          <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
            <CardHeader className="rounded-2xl bg-[var(--app-surface-elevated)]">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[var(--app-primary-muted)] p-2 text-[var(--app-text-strong)]">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Formato y visualizacion</CardTitle>
                  <CardDescription>
                    Define como quieres ver montos y los porcentajes base que usas al crear presupuestos.
                  </CardDescription>
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
          <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
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

          <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
            <CardHeader>
              <CardTitle>Previsualizacion documental</CardTitle>
              <CardDescription>Lectura rapida de como se vera la firma base en PDF y Excel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm shadow-slate-950/10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-text-subtle)]">Firma documental</p>
                    <p className="mt-2 text-sm text-[var(--app-text-muted)]">Responsable, empresa y firma visual que acompanaran los exportes.</p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]">
                    {companyState?.logoUrl ? (
                      <Image src={companyState.logoUrl} alt="Logo de empresa" width={42} height={42} className="max-h-10 w-auto object-contain" />
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">Logo</span>
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

          <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
            <CardHeader>
              <CardTitle>Proximos ajustes recomendados</CardTitle>
              <CardDescription>Pequenas mejoras con bastante impacto en la operacion diaria.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations.map((item) => (
                <div key={item.title} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="font-medium text-[var(--app-text-strong)]">{item.title}</p>
                  <p className="mt-1.5 text-sm text-[var(--app-text-muted)]">{item.detail}</p>
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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3">
      <span className="text-sm text-[var(--app-text-muted)]">{label}</span>
      <span className="text-right text-sm font-medium text-[var(--app-text-strong)]">{value}</span>
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
    <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">{title}</p>
      <div className="mt-8 border-t border-[var(--app-border)] pt-3">
        <p className="text-sm font-semibold text-[var(--app-text-strong)]">{primary}</p>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">{secondary}</p>
      </div>
    </div>
  );
}
