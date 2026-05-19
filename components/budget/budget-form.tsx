"use client";

import { useState } from "react";
import { CircleDollarSign, Layers3, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { broadcastAppDataChange } from "@/lib/client/live-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormActionBar, FormSectionPanel } from "@/components/ui/operational-surfaces";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { BudgetStatePatch } from "@/types/budget";
import type { UserSettingsRecord } from "@/types/settings";
import { formatNumber } from "@/lib/utils";

type BudgetFormProps = {
  projects: Array<{ id: string; name: string }>;
  defaultProjectId?: string;
  defaultCurrency?: UserSettingsRecord["defaultCurrency"];
  defaultIgvRate?: UserSettingsRecord["defaultIgvRate"];
  defaultGeneralExpensesRate?: UserSettingsRecord["defaultGeneralExpensesRate"];
  defaultUtilityRate?: UserSettingsRecord["defaultUtilityRate"];
  budget?: {
    id: string;
    name: string;
    projectId: string;
    currency: string;
    defaultIgvRate?: number;
    defaultGeneralExpensesRate?: number;
    defaultUtilityRate?: number;
  };
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
  budget,
}: BudgetFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const formValues = Object.fromEntries(formData.entries());

    const response = budget
      ? await fetch(`/api/budgets/${budget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildBudgetMetadataPatch(formValues)),
        })
      : await fetch("/api/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formValues),
        });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? (budget ? "No se pudo actualizar el presupuesto" : "No se pudo crear el presupuesto"));
      return;
    }

    const payload = await response.json();
    broadcastAppDataChange(["/dashboard", "/projects", "/budgets"]);

    if (budget) {
      router.push(`/budgets/${budget.id}`);
      return;
    }

    router.push(`/budgets/${payload.id}`);
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {budget ? (
        <div className="grid gap-3 md:grid-cols-3">
          <BudgetInfoCard label="Presupuesto" value={budget.name} />
          <BudgetInfoCard
            label="Proyecto"
            value={projects.find((project) => project.id === budget.projectId)?.name ?? "Pendiente"}
          />
          <BudgetInfoCard label="Moneda" value={budget.currency} />
        </div>
      ) : null}

      <FormSectionPanel
        title="Identidad del presupuesto"
        description="Define el proyecto base y el nombre principal con el que se reconocerá esta estructura."
      >
        <div className="space-y-2">
          <Label htmlFor="projectId">Proyecto</Label>
          <Select id="projectId" name="projectId" defaultValue={budget?.projectId ?? defaultProjectId ?? projects[0]?.id}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Nombre del presupuesto</Label>
          <Input id="name" name="name" defaultValue={budget?.name ?? "Presupuesto General"} />
        </div>
      </FormSectionPanel>

      <FormSectionPanel
        title="Proyecto y moneda"
        description="Ajusta la moneda de trabajo y valida rápidamente cómo se desplegará el presupuesto."
        icon={<CircleDollarSign className="h-4 w-4" />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currency">Moneda</Label>
            <Select id="currency" name="currency" defaultValue={budget?.currency ?? defaultCurrency}>
              <option value="PEN">PEN</option>
              <option value="USD">USD</option>
            </Select>
          </div>
          <PreviewInfoCard
            label="Contexto base"
            value="La moneda elegida se usa en el presupuesto general y en sus vistas derivadas."
          />
        </div>
      </FormSectionPanel>

      <FormSectionPanel
        title="Parametros base"
        description="Configura las tasas iniciales para IGV, gastos generales y utilidad."
        icon={<Layers3 className="h-4 w-4" />}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="igvRate">IGV</Label>
            <Input
              id="igvRate"
              name="igvRate"
              type="number"
              step={RATE_INPUT_STEP}
              defaultValue={formatRateDefault(budget?.defaultIgvRate ?? defaultIgvRate)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="generalExpensesRate">Gastos generales</Label>
            <Input
              id="generalExpensesRate"
              name="generalExpensesRate"
              type="number"
              step={RATE_INPUT_STEP}
              defaultValue={formatRateDefault(budget?.defaultGeneralExpensesRate ?? defaultGeneralExpensesRate)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="utilityRate">Utilidad</Label>
            <Input
              id="utilityRate"
              name="utilityRate"
              type="number"
              step={RATE_INPUT_STEP}
              defaultValue={formatRateDefault(budget?.defaultUtilityRate ?? defaultUtilityRate)}
            />
          </div>
        </div>
      </FormSectionPanel>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <FormActionBar>
        <Button className="gap-2 shadow-sm shadow-sky-950/10" disabled={loading}>
          <Save className="h-4 w-4" />
          {loading ? (budget ? "Guardando..." : "Creando...") : budget ? "Actualizar presupuesto" : "Crear presupuesto"}
        </Button>
      </FormActionBar>
    </form>
  );
}

function buildBudgetMetadataPatch(formValues: Record<string, FormDataEntryValue>): BudgetStatePatch {
  const getString = (key: string) => String(formValues[key] ?? "");
  const getNumber = (key: string) => Number(getString(key));

  return {
    budget: {
      projectId: getString("projectId"),
      name: getString("name"),
      currency: getString("currency"),
      defaultIgvRate: getNumber("igvRate"),
      defaultGeneralExpensesRate: getNumber("generalExpensesRate"),
      defaultUtilityRate: getNumber("utilityRate"),
    },
    levels: {
      create: [],
      update: [],
      delete: [],
    },
    items: {
      create: [],
      update: [],
      delete: [],
    },
  };
}

function BudgetInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PreviewInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
