"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { broadcastAppDataChange } from "@/lib/client/live-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { UserSettingsRecord } from "@/types/settings";
import { formatNumber } from "@/lib/utils";

type BudgetFormProps = {
  projects: Array<{ id: string; name: string }>;
  defaultProjectId?: string;
  defaultCurrency?: UserSettingsRecord["defaultCurrency"];
  defaultIgvRate?: UserSettingsRecord["defaultIgvRate"];
  defaultGeneralExpensesRate?: UserSettingsRecord["defaultGeneralExpensesRate"];
  defaultUtilityRate?: UserSettingsRecord["defaultUtilityRate"];
};

const RATE_INPUT_STEP = "0.001";

function formatRateDefault(rate: number) {
  return formatRate(rate);
}

function formatRate(rate: number) {
  return formatNumber(rate, 6).replace(/\.?0+$/, "");
}

export function BudgetForm({
  projects,
  defaultProjectId,
  defaultCurrency = "PEN",
  defaultIgvRate = 0.18,
  defaultGeneralExpensesRate = 0.1,
  defaultUtilityRate = 0.08,
}: BudgetFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const response = await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo crear el presupuesto");
      return;
    }

    const budget = await response.json();
    broadcastAppDataChange(["/dashboard", "/projects", "/budgets"]);
    router.push(`/budgets/${budget.id}`);
  }

  return (
    <form action={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="projectId">Proyecto</Label>
        <Select id="projectId" name="projectId" defaultValue={defaultProjectId ?? projects[0]?.id}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="name">Nombre del presupuesto</Label>
        <Input id="name" name="name" defaultValue="Presupuesto General" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="currency">Moneda</Label>
        <Select id="currency" name="currency" defaultValue={defaultCurrency}>
          <option value="PEN">PEN</option>
          <option value="USD">USD</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="igvRate">IGV</Label>
        <Input id="igvRate" name="igvRate" type="number" step={RATE_INPUT_STEP} defaultValue={formatRateDefault(defaultIgvRate)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="generalExpensesRate">Gastos generales</Label>
        <Input
          id="generalExpensesRate"
          name="generalExpensesRate"
          type="number"
          step={RATE_INPUT_STEP}
          defaultValue={formatRateDefault(defaultGeneralExpensesRate)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="utilityRate">Utilidad</Label>
        <Input id="utilityRate" name="utilityRate" type="number" step={RATE_INPUT_STEP} defaultValue={formatRateDefault(defaultUtilityRate)} />
      </div>
      {error ? <p className="md:col-span-2 text-sm text-rose-600">{error}</p> : null}
      <div className="md:col-span-2 flex justify-end">
        <Button disabled={loading}>{loading ? "Creando..." : "Crear presupuesto"}</Button>
      </div>
    </form>
  );
}
