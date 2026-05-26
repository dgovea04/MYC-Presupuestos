import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportResponsibleMeta } from "@/types/report-meta";

type BudgetFooterDocumentSignatureCardProps = {
  budgetName: string;
  projectName: string;
  clientName?: string | null;
  location?: string | null;
  responsible: ReportResponsibleMeta & {
    email?: string | null;
  };
};

export function BudgetFooterDocumentSignatureCard({
  budgetName,
  projectName,
  clientName,
  location,
  responsible,
}: BudgetFooterDocumentSignatureCardProps) {
  const documentSummary = [
    { label: "Presupuesto", value: budgetName },
    { label: "Proyecto", value: projectName },
    { label: "Cliente", value: clientName || "Pendiente" },
    { label: "Ubicacion", value: location || "Pendiente" },
  ];
  const responsibleSummary = [
    { label: "Responsable", value: responsible.name || "Pendiente" },
    { label: "Cargo", value: responsible.jobTitle || "Pendiente" },
    { label: "Empresa", value: responsible.companyName || "Pendiente" },
    { label: "Telefono", value: responsible.phone || "Pendiente" },
    { label: "Correo", value: responsible.email || "Pendiente" },
  ];

  return (
    <Card className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
      <CardHeader className="space-y-4 rounded-t-3xl border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_40%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Firma documental</CardTitle>
            <CardDescription>
              Vista base para la futura portada o cierre documental del presupuesto, reutilizando el responsable tecnico que ya
              sale en exportes.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-sky-100 text-sky-700">Lista para portada</Badge>
            <Badge className="border border-slate-200 bg-white text-slate-700">Metadatos sincronizados</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-4 rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-sm shadow-slate-100/70">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Resumen documental</p>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                Este bloque anticipa la firma visible del documento final y deja alineado el responsable que aparecerá en la
                portada, pie o versión exportada del presupuesto general.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {documentSummary.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-sm shadow-slate-100/70">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Responsable tecnico</p>
              <p className="text-sm leading-6 text-slate-600">
                Datos personales y profesionales listos para reutilizar en portada, firma y aprobaciones.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {responsibleSummary.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SignatureBox
            title="Firma del responsable"
            subtitle={responsible.name || "Responsable tecnico"}
            detail={responsible.jobTitle || responsible.companyName || "Cargo pendiente"}
          />
          <SignatureBox
            title="Vo. Bo. / aprobacion"
            subtitle={clientName || "Cliente o aprobador"}
            detail="Espacio reservado para la aprobacion final del documento"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SignatureBox({
  title,
  subtitle,
  detail,
}: {
  title: string;
  subtitle: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <div className="mt-10 border-t border-slate-300 pt-3">
        <p className="text-sm font-semibold text-slate-900">{subtitle}</p>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>
      </div>
    </div>
  );
}
