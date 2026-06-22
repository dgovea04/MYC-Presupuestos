"use client";

import Image from "next/image";
import { useState } from "react";
import { Building2, Pencil } from "lucide-react";
import { CompanyProfileSheet } from "@/components/settings/company-profile-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoCard } from "@/components/ui/info-cards";

export function CompanyProfileCard({
  company,
  onSaved,
}: {
  company?: {
    name?: string | null;
    ruc?: string | null;
    logoUrl?: string | null;
  };
  onSaved?: (company: { name?: string | null; ruc?: string | null; logoUrl?: string | null }) => void;
}) {
  const [isEditing, setIsEditing] = useState(!company);

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader className="rounded-2xl bg-[var(--app-surface-elevated)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[var(--app-primary-muted)] p-2 text-[var(--app-text-strong)]">
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
              className="gap-2"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4" />
              {company ? "Editar" : "Crear empresa"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard label="Nombre" value={company?.name ?? "Sin empresa"} tone="slate" />
          <InfoCard label="RUC" value={company?.ruc ?? "No definido"} tone="sky" />
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.38)]">
            <p className="text-sm text-[var(--app-text-muted)]">Logo</p>
            <div className="mt-3 flex min-h-12 items-center">
              {company?.logoUrl ? (
                <div className="flex h-12 w-20 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-2">
                  <Image src={company.logoUrl} alt="Logo de empresa" width={64} height={32} className="max-h-8 w-auto object-contain" />
                </div>
              ) : (
                <p className="text-lg font-semibold tracking-tight text-[var(--app-text-strong)]">Pendiente</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <CompanyProfileSheet
        open={isEditing}
        company={company}
        onClose={() => setIsEditing(false)}
        onSaved={(nextCompany) => {
          onSaved?.(nextCompany);
        }}
      />
    </Card>
  );
}
