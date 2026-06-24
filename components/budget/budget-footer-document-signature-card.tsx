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
    <Card className="theme-surface-card rounded-3xl">
      <CardHeader className="theme-surface-card-gradient space-y-4 rounded-t-3xl border-b border-[var(--app-border)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Firma documental</CardTitle>
            <CardDescription>
              Datos de portada, cierre y firma del presupuesto, reutilizando el responsable tecnico que se incluye en
              las exportaciones.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="theme-status-info">Lista para portada</Badge>
            <Badge className="theme-filter-button-inactive">Metadatos sincronizados</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="theme-surface-card space-y-4 rounded-3xl border p-5 theme-soft-shadow">
            <div className="space-y-2">
              <p className="theme-muted-text text-xs font-semibold uppercase tracking-[0.22em]">Resumen documental</p>
              <p className="theme-muted-text max-w-2xl text-sm leading-6">
                Este bloque alinea la firma visible del documento final y el responsable que aparecera en la portada,
                pie o version exportada del presupuesto general.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {documentSummary.map((item) => (
                <div key={item.label} className="theme-muted-panel rounded-2xl border px-4 py-3">
                  <p className="theme-muted-text text-xs uppercase tracking-[0.18em]">{item.label}</p>
                  <p className="theme-strong-text mt-1 text-sm font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="theme-surface-card space-y-4 rounded-3xl border p-5 theme-soft-shadow">
            <div className="space-y-2">
              <p className="theme-muted-text text-xs font-semibold uppercase tracking-[0.22em]">Responsable tecnico</p>
              <p className="theme-muted-text text-sm leading-6">
                Datos personales y profesionales listos para reutilizar en portada, firma y aprobaciones.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {responsibleSummary.map((item) => (
                <div key={item.label} className="theme-muted-panel rounded-2xl border px-4 py-3">
                  <p className="theme-muted-text text-xs uppercase tracking-[0.18em]">{item.label}</p>
                  <p className="theme-strong-text mt-1 text-sm font-semibold">{item.value}</p>
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
            detail="Linea de conformidad para la aprobacion final del documento"
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
    <div className="theme-surface-card rounded-3xl border border-dashed border-[var(--app-border-strong)] px-5 py-6">
      <p className="theme-muted-text text-xs font-semibold uppercase tracking-[0.2em]">{title}</p>
      <div className="mt-10 border-t border-[var(--app-border-strong)] pt-3">
        <p className="theme-strong-text text-sm font-semibold">{subtitle}</p>
        <p className="theme-muted-text mt-1 text-sm">{detail}</p>
      </div>
    </div>
  );
}
