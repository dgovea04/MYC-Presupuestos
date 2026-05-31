import Link from "next/link";
import { Clock3, History } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectActivityEvent } from "@/lib/data/activity-events";
import { formatDate } from "@/lib/utils";
import type { DateFormatOption } from "@/types/settings";

const activityTypeLabels: Record<ProjectActivityEvent["type"], string> = {
  PROJECT_CREATED: "Proyecto",
  PROJECT_UPDATED: "Proyecto",
  BUDGET_CREATED: "Presupuesto",
  BUDGET_UPDATED: "Presupuesto",
  POLYNOMIAL_FORMULA_GENERATED: "Formula",
  POLYNOMIAL_FORMULA_UPDATED: "Formula",
  ADJUSTMENT_REGISTERED: "Reajuste",
};

export function ProjectActivityHistory({
  events,
  dateFormat,
}: {
  events: ProjectActivityEvent[];
  dateFormat: DateFormatOption;
}) {
  return (
    <section id="historial">
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-slate-700">
              <History className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Historial del proyecto</CardTitle>
              <CardDescription>
                Trazabilidad reciente de cambios registrados para la obra y sus presupuestos.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {events.length ? (
            <div className="space-y-3">
              {events.map((event) => (
                <Link
                  key={event.id}
                  href={event.href}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 hover:bg-sky-50/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {activityTypeLabels[event.type]}
                      </span>
                      <p className="font-medium text-slate-900">{event.title}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{event.detail}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                    <Clock3 className="h-4 w-4" />
                    {formatDate(event.createdAt, dateFormat)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <p className="font-medium text-slate-900">Sin actividad registrada</p>
              <p className="mt-2 text-sm text-slate-600">
                Los cambios importantes del proyecto apareceran aqui cuando se creen o actualicen presupuestos,
                formulas y reajustes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
