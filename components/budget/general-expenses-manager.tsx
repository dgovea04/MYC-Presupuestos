"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { calculateGeneralExpenseStructure } from "@/lib/calculations/general-expense-structure";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type {
  GeneralExpenseItemInput,
  GeneralExpenseSectionItemCategory,
  GeneralExpenseStructure,
  GeneralExpenseTitleInput,
} from "@/types/budget-sections";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function GeneralExpensesManager({
  budgetId,
  currency,
  totalDirectCost,
  generalExpensesRate,
  initialStructure,
}: {
  budgetId: string;
  currency: string;
  totalDirectCost: number;
  generalExpensesRate: number;
  initialStructure: GeneralExpenseStructure;
}) {
  const { currencyDecimals } = useFormattingSettings();
  const [structure, setStructure] = useState(initialStructure);
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveClock, setSaveClock] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const isHydrated = useRef(false);
  const saveStructureRef = useRef<((isAutosave?: boolean) => Promise<boolean>) | null>(null);

  const preview = useMemo(
    () =>
      calculateGeneralExpenseStructure({
        totalDirectCost,
        groups: structure.groups.map((group) => ({
          ...group,
          titles: group.titles.map((title) => ({
            ...title,
            items: title.items.map((item) => ({
              ...item,
            })),
          })),
        })),
      }),
    [structure, totalDirectCost],
  );
  const breakdownRows = useMemo(() => {
    const fixedTotal = preview.groups.find((group) => group.kind === "FIXED")?.subtotal ?? 0;
    const variableTotal = preview.groups.find((group) => group.kind === "VARIABLE")?.subtotal ?? 0;

    return [
      {
        label: "GASTOS GENERALES FIJOS",
        amount: fixedTotal,
        percentage: getDirectCostPercentage(fixedTotal, totalDirectCost),
      },
      {
        label: "GASTOS GENERALES VARIABLES",
        amount: variableTotal,
        percentage: getDirectCostPercentage(variableTotal, totalDirectCost),
      },
      {
        label: "TOTAL GASTOS GENERALES",
        amount: preview.total,
        percentage: getDirectCostPercentage(preview.total, totalDirectCost),
      },
    ];
  }, [preview, totalDirectCost]);

  const serializedDraft = useMemo(() => JSON.stringify(getStructureSavePayload(structure)), [structure]);
  const lastSavedPayload = useRef(serializedDraft);

  useEffect(() => {
    if (!isHydrated.current) {
      isHydrated.current = true;
      return;
    }

    if (serializedDraft !== lastSavedPayload.current) {
      setSaveState("dirty");
    }
  }, [serializedDraft]);

  useEffect(() => {
    if (saveState !== "dirty") return;

    const timeout = window.setTimeout(() => {
      void saveStructureRef.current?.(true);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [saveState]);

  useEffect(() => {
    saveStructureRef.current = saveStructure;
  });

  useEffect(() => {
    if (!lastSavedAt) return;

    const interval = window.setInterval(() => setSaveClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [lastSavedAt]);

  useEffect(() => {
    if (!feedback) return;

    const timeout = window.setTimeout(() => setFeedback(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  async function persist(url: string, options?: RequestInit, pendingKey?: string) {
    if (pendingKey) {
      setPendingKeys((current) => [...current, pendingKey]);
    }

    setError("");
    setFeedback("");

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "No se pudo guardar el cambio");
      }

      const data = (await response.json()) as GeneralExpenseStructure;
      setStructure(data);
      const snapshot = JSON.stringify(getStructureSavePayload(data));
      lastSavedPayload.current = snapshot;
      setLastSavedAt(Date.now());
      setSaveClock(Date.now());
      setSaveState("saved");
      return data;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar el cambio");
      setSaveState("error");
      return null;
    } finally {
      if (pendingKey) {
        setPendingKeys((current) => current.filter((key) => key !== pendingKey));
      }
    }
  }

  async function saveStructure(isAutosave = false) {
    if (saving) return false;

    const payload = getStructureSavePayload(structure);
    const snapshot = JSON.stringify(payload);

    if (snapshot === lastSavedPayload.current && saveState !== "error") {
      if (saveState === "dirty") {
        setSaveState("saved");
      }
      return true;
    }

    setSaving(true);
    setSaveState("saving");
    setError("");

    try {
      const response = await fetch(`/api/budgets/${budgetId}/general-expenses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "No se pudieron guardar los gastos generales");
      }

      const nextStructure = (await response.json()) as GeneralExpenseStructure;
      setStructure(nextStructure);
      lastSavedPayload.current = JSON.stringify(getStructureSavePayload(nextStructure));
      setLastSavedAt(Date.now());
      setSaveClock(Date.now());
      setSaveState("saved");

      if (!isAutosave) {
        setFeedback("Cambios guardados.");
      }

      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron guardar los gastos generales");
      setSaveState("error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function flushPendingChanges() {
    if (saveState !== "dirty" && saveState !== "error") {
      return true;
    }

    return saveStructure();
  }

  function updateItem(itemId: string, changes: Partial<GeneralExpenseItemInput>) {
    setStructure((current) => ({
      ...current,
      groups: current.groups.map((group) => ({
        ...group,
        titles: group.titles.map((title) => ({
          ...title,
          items: title.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  ...changes,
                }
              : item,
          ),
        })),
      })),
    }));
  }

  function updateTitle(titleId: string, changes: Partial<GeneralExpenseTitleInput>) {
    setStructure((current) => ({
      ...current,
      groups: current.groups.map((group) => ({
        ...group,
        titles: group.titles.map((title) =>
          title.id === titleId
            ? {
                ...title,
                ...changes,
                items:
                  changes.category === undefined
                    ? title.items
                    : title.items.map((item) => ({
                        ...item,
                        category: changes.category ?? item.category,
                      })),
              }
            : title,
        ),
      })),
    }));
  }

  function getTitle(titleId: string) {
    for (const group of structure.groups) {
      const title = group.titles.find((candidate) => candidate.id === titleId);
      if (title) {
        return title;
      }
    }
    return null;
  }

  async function addTitle(groupId: string) {
    const canContinue = await flushPendingChanges();
    if (!canContinue) return;

    const result = await persist(
      `/api/budgets/${budgetId}/general-expenses/groups/${groupId}/titles`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nuevo titulo", category: "STANDARD" } satisfies GeneralExpenseTitleInput),
      },
      groupId,
    );

    if (result) {
      setFeedback("Titulo agregado.");
    }
  }

  async function deleteTitle(titleId: string) {
    const canContinue = await flushPendingChanges();
    if (!canContinue) return;

    const result = await persist(
      `/api/budgets/${budgetId}/general-expenses/titles/${titleId}`,
      {
        method: "DELETE",
      },
      titleId,
    );

    if (result) {
      setFeedback("Titulo eliminado.");
    }
  }

  async function addItem(titleId: string) {
    const canContinue = await flushPendingChanges();
    if (!canContinue) return;

    const title = getTitle(titleId);
    if (!title) return;

    const result = await persist(
      `/api/budgets/${budgetId}/general-expenses/titles/${titleId}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Nuevo item",
          unit: "UND",
          quantityDescription: "-",
          quantity: 1,
          participationPercentage: 0,
          unitPrice: 0,
        } satisfies GeneralExpenseItemInput),
      },
      titleId,
    );

    if (result) {
      setFeedback("Item agregado.");
    }
  }

  async function deleteItem(itemId: string) {
    const canContinue = await flushPendingChanges();
    if (!canContinue) return;

    const result = await persist(
      `/api/budgets/${budgetId}/general-expenses/items/${itemId}`,
      {
        method: "DELETE",
      },
      itemId,
    );

    if (result) {
      setFeedback("Item eliminado.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Detalle de gastos generales</CardTitle>
          <CardDescription>
            Cada presupuesto general usa una copia editable de la plantilla base. Los parciales se recalculan usando el costo
            directo real del presupuesto actual.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveBadge state={saveState} lastSavedLabel={formatLastSavedLabel(lastSavedAt, saveClock)} />
          <ToolbarIconButton
            label={saving ? "Guardando" : "Guardar ahora"}
            onClick={() => void saveStructure()}
            disabled={saving || pendingKeys.length > 0}
          >
            <Save className="h-4 w-4" />
          </ToolbarIconButton>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          El total oficial del presupuesto sigue saliendo de la tasa general actual: {formatNumber(generalExpensesRate, 4)}.
          Esta seccion trabaja con el desagregado operativo de la plantilla base.
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard label="Costo directo" value={formatCurrency(totalDirectCost, currency, currencyDecimals)} />
          <MetricCard label="Gasto general calculado" value={formatCurrency(preview.total, currency, currencyDecimals)} />
          <MetricCard label="Grupos" value={String(preview.groups.length)} />
          <MetricCard
            label="Titulos"
            value={String(preview.groups.reduce((sum, group) => sum + group.titles.length, 0))}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Reglas: `Parcial = Cantidad x PU` o `Cantidad x % Part x Costo Directo`, segun categoria.
          </p>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {!error && feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}
        </div>

        {preview.groups.map((group) => (
          <section key={group.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {group.kind === "FIXED" ? "Gastos Generales Fijo" : "Gastos Generales Variables"}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{group.name}</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">
                  Subtotal: {formatCurrency(group.subtotal, currency, currencyDecimals)}
                </span>
                <ToolbarIconButton
                  label="Agregar titulo"
                  onClick={() => void addTitle(group.id)}
                  disabled={saving || pendingKeys.includes(group.id)}
                >
                  <Plus className="h-4 w-4" />
                </ToolbarIconButton>
              </div>
            </div>

            {group.titles.map((title) => (
              <div key={title.id} className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid flex-1 gap-3 md:grid-cols-[minmax(110px,140px)_minmax(240px,1fr)_minmax(220px,260px)]">
                    <Input
                      value={title.code}
                      onChange={(event) => updateTitle(title.id, { code: event.target.value })}
                      aria-label={`Codigo del titulo ${title.name}`}
                      className={getInputDensityClass()}
                    />
                    <Input
                      value={title.name}
                      onChange={(event) => updateTitle(title.id, { name: event.target.value })}
                      aria-label={`Nombre del titulo ${title.code}`}
                      className={getInputDensityClass()}
                    />
                    <Select
                      value={title.category}
                      onChange={(event) =>
                        updateTitle(title.id, {
                          category: event.target.value as GeneralExpenseSectionItemCategory,
                        })
                      }
                      className={getInputDensityClass()}
                    >
                      <option value="STANDARD">Estandar</option>
                      <option value="PERSONAL">Personal</option>
                      <option value="TESTING">Ensayos</option>
                      <option value="DIRECT_COST_BASED">En funcion del Costo Directo</option>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <p className="text-sm text-slate-500">
                      Subtotal del titulo: {formatCurrency(title.subtotal, currency, currencyDecimals)}
                    </p>
                    <ToolbarIconButton
                      label="Agregar item"
                      onClick={() => void addItem(title.id)}
                      disabled={saving || pendingKeys.includes(title.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </ToolbarIconButton>
                    <ToolbarIconButton
                      label="Eliminar titulo"
                      onClick={() => void deleteTitle(title.id)}
                      disabled={saving || pendingKeys.includes(title.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </ToolbarIconButton>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <Table className="min-w-[980px]">
                    <THead>
                      <TR className="bg-slate-50 hover:bg-slate-50">
                        <TH>Codigo</TH>
                        <TH>Descripcion</TH>
                        <TH>Unidad</TH>
                        <TH>Cant. desc.</TH>
                        <TH className="text-right">Cantidad</TH>
                        <TH className="text-right">% Part</TH>
                        <TH className="text-right">PU</TH>
                        <TH className="text-right">Parcial</TH>
                        <TH className="text-right">Acciones</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {title.items.map((item) => {
                        const usesDirectCost = title.category === "DIRECT_COST_BASED";
                        const isPending = pendingKeys.includes(item.id);

                        return (
                          <TR key={item.id}>
                            <TD className="align-top">
                              <Input
                                value={item.code}
                                onChange={(event) => updateItem(item.id, { code: event.target.value })}
                                className={getInputDensityClass()}
                              />
                            </TD>
                            <TD className="align-top">
                              <Input
                                value={item.description}
                                onChange={(event) => updateItem(item.id, { description: event.target.value })}
                                className={getInputDensityClass()}
                              />
                            </TD>
                            <TD className="align-top">
                              <Input
                                value={item.unit}
                                onChange={(event) => updateItem(item.id, { unit: event.target.value })}
                                className={cn(getInputDensityClass(), "text-center")}
                              />
                            </TD>
                            <TD className="align-top">
                              <Input
                                value={item.quantityDescription ?? ""}
                                onChange={(event) => updateItem(item.id, { quantityDescription: event.target.value })}
                                className={getInputDensityClass()}
                              />
                            </TD>
                            <TD className="align-top">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.quantity}
                                onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })}
                                className={cn(getInputDensityClass(), "text-right tabular-nums")}
                              />
                            </TD>
                            <TD className="align-top">
                              <Input
                                type="number"
                                step="0.0001"
                                value={item.participationPercentage}
                                onChange={(event) =>
                                  updateItem(item.id, { participationPercentage: Number(event.target.value) })
                                }
                                className={cn(getInputDensityClass(), "text-right tabular-nums")}
                              />
                            </TD>
                            <TD className="align-top">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.unitPrice}
                                disabled={usesDirectCost}
                                onChange={(event) => updateItem(item.id, { unitPrice: Number(event.target.value) })}
                                className={cn(getInputDensityClass(), "text-right tabular-nums")}
                              />
                            </TD>
                            <TD className="whitespace-nowrap text-right text-sm font-medium tabular-nums text-slate-800">
                              {formatCurrency(item.partial, currency, currencyDecimals)}
                            </TD>
                            <TD className="align-top">
                              <div className="flex justify-end">
                                <ToolbarIconButton
                                  label="Eliminar item"
                                  onClick={() => void deleteItem(item.id)}
                                  disabled={saving || isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </ToolbarIconButton>
                              </div>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </div>
              </div>
            ))}
          </section>
        ))}

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Resumen final</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">DESCOMPOSICION DE LOS GASTOS GENERALES</h3>
            </div>
            <p className="text-sm text-slate-500">
              Porcentajes calculados sobre el costo directo actual: {formatCurrency(totalDirectCost, currency, currencyDecimals)}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <Table>
              <THead>
                <TR className="bg-slate-50 hover:bg-slate-50">
                  <TH>Descripcion</TH>
                  <TH className="text-right">Porcentaje</TH>
                  <TH className="text-right">Monto</TH>
                </TR>
              </THead>
              <TBody>
                {breakdownRows.map((row, index) => {
                  const isTotal = index === breakdownRows.length - 1;

                  return (
                    <TR key={row.label} className={isTotal ? "bg-slate-50/70" : undefined}>
                      <TD className={cn("text-sm text-slate-900", isTotal ? "font-semibold" : "font-medium")}>{row.label}</TD>
                      <TD className={cn("text-right tabular-nums text-slate-700", isTotal ? "font-semibold" : "font-medium")}>
                        {formatPercentageValue(row.percentage)}
                      </TD>
                      <TD className={cn("text-right tabular-nums text-slate-900", isTotal ? "font-semibold" : "font-medium")}>
                        {formatCurrency(row.amount, currency, currencyDecimals)}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function SaveBadge({ state, lastSavedLabel }: { state: SaveState; lastSavedLabel: string | null }) {
  const styles: Record<SaveState, string> = {
    idle: "bg-slate-100 text-slate-600",
    dirty: "bg-amber-100 text-amber-700",
    saving: "bg-sky-100 text-sky-700",
    saved: "bg-emerald-100 text-emerald-700",
    error: "bg-rose-100 text-rose-700",
  };

  const labels: Record<SaveState, string> = {
    idle: "Sin cambios",
    dirty: "Cambios pendientes",
    saving: "Guardando...",
    saved: "Guardado automatico",
    error: "Error al guardar",
  };

  return (
    <span className={cn("inline-flex flex-col rounded-full px-3 py-2 text-xs font-medium", styles[state])}>
      <span>{labels[state]}</span>
      {lastSavedLabel ? <span className="mt-0.5 text-[11px] font-normal opacity-80">{lastSavedLabel}</span> : null}
    </span>
  );
}

function ToolbarIconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="h-8 w-8 rounded-lg px-0 text-slate-600 hover:bg-slate-100"
    >
      {children}
    </Button>
  );
}

function getInputDensityClass() {
  return "h-8 rounded-lg px-2 text-xs";
}

function getStructureSavePayload(structure: GeneralExpenseStructure) {
  return {
    groups: structure.groups.map((group, groupIndex) => ({
      id: group.id,
      sortOrder: groupIndex,
      titles: group.titles.map((title, titleIndex) => ({
        id: title.id,
        code: title.code,
        name: title.name,
        category: title.category,
        sortOrder: titleIndex,
        items: title.items.map((item, itemIndex) => ({
          id: item.id,
          code: item.code,
          description: item.description,
          unit: item.unit,
          quantityDescription: item.quantityDescription,
          quantity: item.quantity,
          participationPercentage: item.participationPercentage,
          unitPrice: item.unitPrice,
          sortOrder: itemIndex,
        })),
      })),
    })),
  };
}

function formatLastSavedLabel(lastSavedAt: number | null, currentTime: number) {
  if (!lastSavedAt) return null;

  const seconds = Math.max(0, Math.floor((currentTime - lastSavedAt) / 1000));
  if (seconds < 60) {
    return `Ultimo guardado hace ${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Ultimo guardado hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }

  const hours = Math.floor(minutes / 60);
  return `Ultimo guardado hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
}

function getDirectCostPercentage(amount: number, totalDirectCost: number) {
  if (totalDirectCost <= 0) {
    return 0;
  }

  return amount / totalDirectCost;
}

function formatPercentageValue(value: number) {
  return `${formatNumber(value * 100, 2)}%`;
}
