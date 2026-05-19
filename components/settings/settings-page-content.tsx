"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Settings2 } from "lucide-react";
import { CompanyProfileCard } from "@/components/settings/company-profile-card";
import { UserSettingsForm } from "@/components/settings/user-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoCard } from "@/components/ui/info-cards";
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
          <CompanyProfileCard company={company} />

          <Card className="border-slate-200">
            <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#fffdf8_0%,#fffaf0_100%)]">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
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
              </div>
              <UserSettingsForm initialSettings={settings} onSaved={setSettings} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-5">
          <Card className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
            <CardHeader>
              <CardTitle>Resumen rapido</CardTitle>
              <CardDescription>Lectura corta del estado actual de tus ajustes globales.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoCard label="Empresa" value={company?.name ?? "Pendiente"} layout="inline" />
              <InfoCard label="Logo" value={company?.logoUrl ? "Disponible" : "Pendiente"} layout="inline" />
              <InfoCard label="Moneda" value={settings.defaultCurrency} layout="inline" />
              <InfoCard label="Fecha" value={DATE_FORMAT_LABELS[settings.dateFormat]} layout="inline" />
              <InfoCard label="Vista" value={settings.defaultViewMode === "excel" ? "Modo Excel" : "Moderna"} layout="inline" />
              <InfoCard label="Filas Excel" value={`${settings.excelRowHeight}px`} layout="inline" />
              <InfoCard label="Sub Presupuestos" value={`${settings.defaultSubBudgetNames.length} base`} layout="inline" />
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
            <CardHeader>
              <CardTitle>Previsualizacion documental</CardTitle>
              <CardDescription>Lectura rapida de como se vera la firma base en PDF y Excel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/70">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Firma documental</p>
                    <p className="mt-2 text-sm text-slate-600">Responsable, empresa y firma visual que acompanaran los exportes.</p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                    {company?.logoUrl ? (
                      <Image src={company.logoUrl} alt="Logo de empresa" width={42} height={42} className="max-h-10 w-auto object-contain" />
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Logo</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <PreviewRow label="Empresa" value={company?.name ?? "Pendiente"} />
                  <PreviewRow label="Responsable" value={account.name} />
                  <PreviewRow label="Cargo" value={account.jobTitle || "Pendiente"} />
                  <PreviewRow label="Telefono" value={account.phone || "Pendiente"} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <SignaturePreview
                    title="Firma del responsable"
                    primary={account.name}
                    secondary={account.jobTitle || company?.name || "Cargo pendiente"}
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

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Proximos ajustes recomendados</CardTitle>
              <CardDescription>Pequenas mejoras con bastante impacto en la operacion diaria.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1.5 text-sm text-slate-600">{item.detail}</p>
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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-900">{value}</span>
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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <div className="mt-8 border-t border-slate-300 pt-3">
        <p className="text-sm font-semibold text-slate-900">{primary}</p>
        <p className="mt-1 text-sm text-slate-500">{secondary}</p>
      </div>
    </div>
  );
}
