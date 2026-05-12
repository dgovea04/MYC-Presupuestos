import { AppShell } from "@/components/layout/app-shell";
import { CompanyProfileForm } from "@/components/settings/company-profile-form";
import { UserSettingsForm } from "@/components/settings/user-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth/session";
import { getUserCompanies } from "@/lib/data/projects";
import { getUserSettings } from "@/lib/data/settings";

export default async function SettingsPage() {
  const session = await getAuthSession();
  const [companies, settings] = await Promise.all([getUserCompanies(session!.user.id), getUserSettings(session!.user.id)]);
  const company = companies[0];

  return (
    <AppShell settings={settings}>
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Empresa / Perfil profesional</CardTitle>
            <CardDescription>Base comercial desde donde se construyen proyectos, insumos y presupuestos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-sm text-slate-500">Nombre</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{company?.name ?? "Sin empresa"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-sm text-slate-500">RUC</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{company?.ruc ?? "No definido"}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="font-medium text-slate-900">
                {company ? "Actualizar empresa principal" : "Crear empresa principal"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Necesitas una empresa o perfil profesional para crear proyectos nuevos y heredar sus sub presupuestos base.
              </p>
              <div className="mt-4">
                <CompanyProfileForm initialCompany={company} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Formato y visualizacion</CardTitle>
            <CardDescription>Define como quieres ver montos y los porcentajes base que usas al crear presupuestos.</CardDescription>
          </CardHeader>
          <CardContent>
            <UserSettingsForm initialSettings={settings} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recomendaciones de settings generales</CardTitle>
            <CardDescription>Estos son los siguientes ajustes con mas impacto para volver esta vista realmente util.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              {
                title: "Porcentajes por defecto",
                detail: "IGV, gastos generales y utilidad ya disponibles para sugerir valores base en nuevos sub presupuestos.",
              },
              {
                title: "Formato de fecha",
                detail: "Elegir entre dd/MM/yyyy, dd MMM yyyy o formatos mas compactos para tablas.",
              },
              {
                title: "Densidad de tabla",
                detail: "Compacta o comoda para presupuestos, APUs y catalogo de insumos.",
              },
              {
                title: "Redondeo de reportes",
                detail: "Separar decimales visibles en pantalla de los decimales de exportacion a PDF y Excel.",
              },
              {
                title: "Especialidades iniciales",
                detail: "Permitir editar la lista de sub presupuestos base con la que arranca cada proyecto.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
