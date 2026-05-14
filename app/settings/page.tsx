import { Settings2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CompanyProfileCard } from "@/components/settings/company-profile-card";
import { UserSettingsForm } from "@/components/settings/user-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoCard } from "@/components/ui/info-cards";
import { getAuthSession } from "@/lib/auth/session";
import { getUserCompanies } from "@/lib/data/projects";
import { getUserSettings } from "@/lib/data/settings";

const recommendations = [
  {
    title: "Porcentajes por defecto",
    detail: "IGV, gastos generales y utilidad ya disponibles para sugerir valores base en nuevos sub presupuestos.",
  },
  {
    title: "Formato de fecha",
    detail: "Elegir entre dd/MM/yyyy, dd MMM yyyy o formatos más compactos para tablas.",
  },
  {
    title: "Densidad de tabla",
    detail: "Compacta o cómoda para presupuestos, APUs y catálogo de insumos.",
  },
  {
    title: "Redondeo de reportes",
    detail: "Separar decimales visibles en pantalla de los decimales de exportación a PDF y Excel.",
  },
  {
    title: "Especialidades iniciales",
    detail: "Permitir editar la lista de sub presupuestos base con la que arranca cada proyecto.",
  },
] as const;

export default async function SettingsPage() {
  const session = await getAuthSession();
  const [companies, settings] = await Promise.all([getUserCompanies(session!.user.id), getUserSettings(session!.user.id)]);
  const company = companies[0];

  return (
    <AppShell settings={settings}>
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
                      Define cómo quieres ver montos y los porcentajes base que usas al crear presupuestos.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoCard label="Moneda" value={settings.defaultCurrency} tone="sky" />
                  <InfoCard label="Decimales" value={String(settings.currencyDecimals)} tone="slate" />
                  <InfoCard label="Fecha" value={settings.dateFormat} tone="amber" />
                </div>
                <UserSettingsForm initialSettings={settings} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 xl:sticky xl:top-5">
            <Card className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
              <CardHeader>
                <CardTitle>Resumen rápido</CardTitle>
                <CardDescription>Lectura corta del estado actual de tus ajustes globales.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoCard label="Empresa" value={company?.name ?? "Pendiente"} layout="inline" />
                <InfoCard label="Moneda" value={settings.defaultCurrency} layout="inline" />
                <InfoCard label="Fecha" value={settings.dateFormat} layout="inline" />
                <InfoCard label="Especialidades" value={`${settings.defaultSubBudgetNames.length} base`} layout="inline" />
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Próximos ajustes recomendados</CardTitle>
                <CardDescription>Pequeñas mejoras con bastante impacto en la operación diaria.</CardDescription>
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
    </AppShell>
  );
}
