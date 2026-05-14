"use client";

import { useState } from "react";
import { Building2, Pencil } from "lucide-react";
import { CompanyProfileForm } from "@/components/settings/company-profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InfoCard } from "@/components/ui/info-cards";
import { OperationalPanel } from "@/components/ui/operational-surfaces";

export function CompanyProfileCard({
  company,
}: {
  company?: {
    name?: string | null;
    ruc?: string | null;
  };
}) {
  const [isEditing, setIsEditing] = useState(!company);

  return (
    <Card className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
      <CardContent className="space-y-6">
        <OperationalPanel
          title="Empresa / Perfil profesional"
          description="Base comercial desde donde se construyen proyectos, insumos y presupuestos."
          metrics={
            <div className="rounded-2xl bg-slate-900 p-2 text-white">
              <Building2 className="h-5 w-5" />
            </div>
          }
          controls={
            <div className="flex justify-end">
              <Button
                variant="outline"
                className="gap-2 bg-white"
                onClick={() => setIsEditing((current) => !current)}
              >
                <Pencil className="h-4 w-4" />
                {isEditing ? "Ocultar editor" : company ? "Editar" : "Crear empresa"}
              </Button>
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard label="Nombre" value={company?.name ?? "Sin empresa"} tone="slate" />
          <InfoCard label="RUC" value={company?.ruc ?? "No definido"} tone="sky" />
        </div>

        {isEditing ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm shadow-slate-100/70">
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
        ) : null}
      </CardContent>
    </Card>
  );
}
