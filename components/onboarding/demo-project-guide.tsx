import { Calculator, FileSpreadsheet, FileText, ListChecks, Sigma } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  { label: "Abre el presupuesto general", icon: FileSpreadsheet },
  { label: "Revisa una partida de estructuras", icon: ListChecks },
  { label: "Abre su APU", icon: Calculator },
  { label: "Revisa la formula polinomica", icon: Sigma },
  { label: "Exporta Excel o PDF", icon: FileText },
];

export function DemoProjectGuide() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">5 minutos para conocer MC Presupuestos</CardTitle>
          <Badge variant="secondary">Demo</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <li key={step.label} className="flex items-center gap-2 text-sm text-slate-700">
                <Icon className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <span>{step.label}</span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
