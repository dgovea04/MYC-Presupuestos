"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useRef, useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormActionBar, FormSectionPanel } from "@/components/ui/operational-surfaces";
import { getExcelViewCssVariables } from "@/lib/budget/excel-view-css";
import { cn, formatNumber } from "@/lib/utils";

export function SubBudgetCreateSheet({
  projectId,
  parentBudgetId,
  parentBudgetName,
  currency,
  igvRate,
  generalExpensesRate,
  utilityRate,
}: {
  projectId: string;
  parentBudgetId: string;
  parentBudgetName: string;
  currency: string;
  igvRate: number;
  generalExpensesRate: number;
  utilityRate: number;
}) {
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { isExcelMode } = useAppViewMode();
  const { excelRowHeight, excelShowFieldBorders } = useFormattingSettings();
  const excelCssVariables = useMemo(
    () => getExcelViewCssVariables(excelShowFieldBorders, excelRowHeight),
    [excelRowHeight, excelShowFieldBorders],
  );
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const subBudgetName = String(formData.get("name") ?? "").trim();
    const payload = {
      projectId,
      parentBudgetId,
      kind: "SUB_BUDGET",
      name: subBudgetName,
      currency,
      igvRate,
      generalExpensesRate,
      utilityRate,
    };

    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "No se pudo crear el Sub Presupuesto");
        return;
      }

      setName("");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button className="gap-2 shadow-sm shadow-sky-950/10">
          <Plus className="h-4 w-4" />
          Nuevo Sub Presupuesto
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={cn("fixed inset-0 z-50 bg-slate-950/30", isExcelMode ? "backdrop-blur-0" : "backdrop-blur-sm")} />
        <Dialog.Content
          asChild
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeButtonRef.current?.focus();
          }}
        >
          <div
            className={cn(
              "fixed inset-y-0 right-0 z-50 h-full w-full max-w-2xl overflow-y-auto border-l p-5 outline-none",
              isExcelMode ? "border-[var(--app-border-strong)] bg-[var(--app-surface)] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.16)]" : "border-[var(--app-border)] bg-[var(--app-surface-muted)] shadow-2xl",
            )}
            data-view-mode={isExcelMode ? "excel" : "modern"}
            style={excelCssVariables}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--app-text-muted)]">Presupuesto General</p>
                <Dialog.Title asChild>
                  <h3 className="text-2xl font-semibold text-[var(--app-text-strong)]">Nuevo Sub Presupuesto</h3>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                    Crea una nueva rama tecnica del presupuesto sin salir del consolidado.
                  </p>
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button ref={closeButtonRef} variant="outline">
                  Cerrar
                </Button>
              </Dialog.Close>
            </div>

            <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
              <div className="grid gap-3 md:grid-cols-3">
                <ContextInfoCard label="Presupuesto padre" value={parentBudgetName} />
                <ContextInfoCard label="Moneda" value={currency} />
                <ContextInfoCard label="IGV" value={formatRateLabel(igvRate)} />
              </div>

              <FormSectionPanel
                title="Identidad del Sub Presupuesto"
                description="Define el nombre operativo con el que aparecera en el consolidado y en los accesos de edicion."
              >
                <div className="space-y-2">
                  <Label htmlFor="subBudgetName">Nombre del Sub Presupuesto</Label>
                  <Input
                    id="subBudgetName"
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ej. Instalaciones Mecanicas"
                    className="border-[var(--table-border-soft)]"
                    required
                    minLength={3}
                  />
                </div>
              </FormSectionPanel>

              <FormSectionPanel
                title="Parametros heredados"
                description="El nuevo Sub Presupuesto parte con las tasas del presupuesto general y total cero para iniciar la carga tecnica."
              >
                <div className="grid gap-3 md:grid-cols-3">
                  <ContextInfoCard label="Gastos generales" value={formatRateLabel(generalExpensesRate)} />
                  <ContextInfoCard label="Utilidad" value={formatRateLabel(utilityRate)} />
                  <ContextInfoCard label="Total inicial" value="0.00" />
                </div>
              </FormSectionPanel>

              {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

              <FormActionBar>
                <Button type="submit" className="gap-2 shadow-sm shadow-sky-950/10" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {loading ? "Creando..." : "Crear Sub Presupuesto"}
                </Button>
              </FormActionBar>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ContextInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
      <p className="text-sm text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{value}</p>
    </div>
  );
}

function formatRateLabel(rate: number) {
  return `${formatNumber(rate * 100, 3).replace(/\.?0+$/, "")}%`;
}
