"use client";

import { useState } from "react";
import { Building2, Pencil } from "lucide-react";
import { CompanyProfileForm } from "@/components/settings/company-profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoCard } from "@/components/ui/info-cards";

export function CompanyProfileCard({
  company,
}: {
  company?: {
    name?: string | null;
    ruc?: string | null;
    logoUrl?: string | null;
  };
}) {
  const [companyState, setCompanyState] = useState(company);
  const [isEditing, setIsEditing] = useState(!company);

  return (
    <Card className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
      <CardHeader className="rounded-2xl bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900 p-2 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Empresa / Perfil profesional</CardTitle>
              <CardDescription>Base comercial desde donde se construyen proyectos, insumos y presupuestos.</CardDescription>
            </div>
          </div>
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
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">

        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard label="Nombre" value={companyState?.name ?? "Sin empresa"} tone="slate" />
          <InfoCard label="RUC" value={companyState?.ruc ?? "No definido"} tone="sky" />
          <InfoCard label="Logo" value={companyState?.logoUrl ? "Disponible" : "Pendiente"} tone="amber" />
        </div>

        {isEditing ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm shadow-slate-100/70">
            <p className="font-medium text-slate-900">
              {companyState ? "Actualizar empresa principal" : "Crear empresa principal"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Necesitas una empresa o perfil profesional para crear proyectos nuevos y heredar sus Sub Presupuestos base.
            </p>
            <div className="mt-4">
              <CompanyProfileForm
                initialCompany={companyState}
                onSaved={(nextCompany) => {
                  setCompanyState(nextCompany);
                  setIsEditing(false);
                }}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
