"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  formatBudgetRatePercentageInput,
  parseBudgetRatePercentageInput,
} from "@/lib/settings/budget-rate-percentages";
import { DATE_FORMAT_OPTIONS, DEFAULT_INITIAL_SUB_BUDGET_NAMES, type UserSettingsRecord } from "@/types/settings";
import { formatCurrency, formatDate } from "@/lib/utils";

const DEFAULT_SAVE_ERROR = "No se pudo guardar la configuracion";
const GENERIC_PERCENTAGE_ERROR = "Ingresa un porcentaje valido entre 0 y 100.";
const CURRENCY_DECIMAL_OPTIONS = [0, 1, 2, 3, 4] as const;
const GENERIC_SUB_BUDGET_LIST_ERROR = "Agrega al menos una especialidad, sin repeticiones y con nombres validos.";
const NEW_SUB_BUDGET_PLACEHOLDER = "Nueva especialidad";
const DATE_FORMAT_LABELS: Record<(typeof DATE_FORMAT_OPTIONS)[number], string> = {
  DD_MM_YYYY: "dd/MM/yyyy",
  DD_MMM_YYYY: "dd MMM yyyy",
  DD_MM: "dd/MM",
};
type DraggedSubBudgetIndex = number | null;

export function UserSettingsForm({
  initialSettings,
}: {
  initialSettings: UserSettingsRecord;
}) {
  const [defaultCurrency, setDefaultCurrency] = useState<UserSettingsRecord["defaultCurrency"]>(initialSettings.defaultCurrency);
  const [currencyDecimals, setCurrencyDecimals] = useState(String(initialSettings.currencyDecimals));
  const [dateFormat, setDateFormat] = useState<UserSettingsRecord["dateFormat"]>(initialSettings.dateFormat);
  const [defaultIgvRate, setDefaultIgvRate] = useState(formatBudgetRatePercentageInput(initialSettings.defaultIgvRate));
  const [defaultGeneralExpensesRate, setDefaultGeneralExpensesRate] = useState(
    formatBudgetRatePercentageInput(initialSettings.defaultGeneralExpensesRate),
  );
  const [defaultUtilityRate, setDefaultUtilityRate] = useState(formatBudgetRatePercentageInput(initialSettings.defaultUtilityRate));
  const [defaultSubBudgetNames, setDefaultSubBudgetNames] = useState(initialSettings.defaultSubBudgetNames);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [draggedSubBudgetIndex, setDraggedSubBudgetIndex] = useState<DraggedSubBudgetIndex>(null);
  const matchesDefaultSubBudgetNames = areSubBudgetNamesEqual(defaultSubBudgetNames, DEFAULT_INITIAL_SUB_BUDGET_NAMES);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");

    try {
      const parsedRates = parseBudgetRates({
        defaultIgvRate,
        defaultGeneralExpensesRate,
        defaultUtilityRate,
      });
      const parsedSubBudgetNames = parseSubBudgetNames(defaultSubBudgetNames);
      const payload = {
        defaultCurrency,
        currencyDecimals: Number(currencyDecimals),
        dateFormat,
        defaultIgvRate: parsedRates.defaultIgvRate,
        defaultGeneralExpensesRate: parsedRates.defaultGeneralExpensesRate,
        defaultUtilityRate: parsedRates.defaultUtilityRate,
        defaultSubBudgetNames: parsedSubBudgetNames,
      };

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }

      setSuccess("Configuracion guardada correctamente.");
    } catch (submissionError) {
      setError(submissionError instanceof Error && submissionError.message ? submissionError.message : DEFAULT_SAVE_ERROR);
    } finally {
      setPending(false);
    }
  }

  const preview = formatCurrency(7723.48, defaultCurrency, Number(currencyDecimals));
  const datePreview = formatDate("2026-05-12T00:00:00.000Z", dateFormat);

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="defaultCurrency">Moneda por defecto</Label>
        <Select
          id="defaultCurrency"
          disabled={pending}
          value={defaultCurrency}
          onChange={(event) => setDefaultCurrency(event.target.value as UserSettingsRecord["defaultCurrency"])}
        >
          <option value="PEN">PEN - Sol peruano</option>
          <option value="USD">USD - Dolar estadounidense</option>
        </Select>
        <p className="text-sm text-slate-500">Se usara como moneda inicial en nuevas vistas y presupuestos compatibles.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currencyDecimals">Decimales para moneda</Label>
        <Select id="currencyDecimals" disabled={pending} value={currencyDecimals} onChange={(event) => setCurrencyDecimals(event.target.value)}>
          {CURRENCY_DECIMAL_OPTIONS.map((option) => (
            <option key={option} value={String(option)}>
              {option} {option === 1 ? "decimal" : "decimales"}
            </option>
          ))}
        </Select>
        <p className="text-sm text-slate-500">
          Esto cambia solo la visualizacion. Los calculos monetarios internos mantienen su precision contable.
        </p>
        <p className="text-sm text-slate-500">
          Vista previa: <span className="font-medium text-slate-900">{preview}</span>
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dateFormat">Formato de fecha</Label>
        <Select id="dateFormat" disabled={pending} value={dateFormat} onChange={(event) => setDateFormat(event.target.value as UserSettingsRecord["dateFormat"])}>
          {DATE_FORMAT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {DATE_FORMAT_LABELS[option]}
            </option>
          ))}
        </Select>
        <p className="text-sm text-slate-500">
          El formato seleccionado se usara en tablas, tarjetas y vistas de seguimiento donde se muestren fechas.
        </p>
        <p className="text-sm text-slate-500">
          Vista previa: <span className="font-medium text-slate-900">{datePreview}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="defaultIgvRate">IGV (%)</Label>
          <Input
            id="defaultIgvRate"
            disabled={pending}
            inputMode="decimal"
            step="0.01"
            value={defaultIgvRate}
            onChange={(event) => setDefaultIgvRate(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultGeneralExpensesRate">Gastos generales (%)</Label>
          <Input
            id="defaultGeneralExpensesRate"
            disabled={pending}
            inputMode="decimal"
            step="0.01"
            value={defaultGeneralExpensesRate}
            onChange={(event) => setDefaultGeneralExpensesRate(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultUtilityRate">Utilidad (%)</Label>
          <Input
            id="defaultUtilityRate"
            disabled={pending}
            inputMode="decimal"
            step="0.01"
            value={defaultUtilityRate}
            onChange={(event) => setDefaultUtilityRate(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="defaultSubBudgetName-0">Especialidades iniciales</Label>
              {matchesDefaultSubBudgetNames ? (
                <Badge className="bg-emerald-100 text-emerald-700">Usando lista base</Badge>
              ) : null}
            </div>
            <p className="text-sm text-slate-500">
              Esta lista define los sub-presupuestos base con los que arranca cada proyecto nuevo.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending || matchesDefaultSubBudgetNames}
              onClick={() => {
                setError("");
                setSuccess("");
                setDefaultSubBudgetNames([...DEFAULT_INITIAL_SUB_BUDGET_NAMES]);
              }}
            >
              Restaurar base
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setError("");
                setSuccess("");
                setDefaultSubBudgetNames((current) => [...current, ""]);
              }}
            >
              Agregar especialidad
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <Table>
            <THead>
              <TR className="bg-slate-50 hover:bg-slate-50">
                <TH className="w-12 text-center"></TH>
                <TH className="w-16">#</TH>
                <TH>Sub presupuesto inicial</TH>
                <TH className="text-right">Acciones</TH>
              </TR>
            </THead>
            <TBody>
              {defaultSubBudgetNames.map((name, index) => (
                <TR
                  key={`${index}-${name}`}
                  draggable={!pending}
                  onDragStart={() => setDraggedSubBudgetIndex(index)}
                  onDragOver={(event) => {
                    if (draggedSubBudgetIndex !== null) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={() => {
                    if (draggedSubBudgetIndex === null || draggedSubBudgetIndex === index) {
                      return;
                    }

                    setError("");
                    setSuccess("");
                    setDefaultSubBudgetNames((current) => moveSubBudgetNameToTarget(current, draggedSubBudgetIndex, index));
                    setDraggedSubBudgetIndex(null);
                  }}
                  onDragEnd={() => setDraggedSubBudgetIndex(null)}
                  className={draggedSubBudgetIndex === index ? "scale-[0.995] opacity-60 ring-2 ring-sky-300" : undefined}
                >
                  <TD className="text-center text-slate-400">
                    <span className="inline-flex cursor-grab items-center justify-center rounded-lg p-1">
                      <GripVertical className="h-4 w-4" />
                    </span>
                  </TD>
                  <TD className="font-medium text-slate-500">{index + 1}</TD>
                  <TD>
                    <Input
                      id={`defaultSubBudgetName-${index}`}
                      disabled={pending}
                      placeholder={NEW_SUB_BUDGET_PLACEHOLDER}
                      value={name}
                      onChange={(event) => {
                        setError("");
                        setSuccess("");
                        setDefaultSubBudgetNames((current) =>
                          current.map((currentName, currentIndex) =>
                            currentIndex === index ? event.target.value : currentName,
                          ),
                        );
                      }}
                    />
                  </TD>
                  <TD>
                    <div className="flex justify-end">
                      <ActionButton
                        action="delete"
                        label="Eliminar"
                        size="sm"
                        variant="ghost"
                        disabled={pending || defaultSubBudgetNames.length === 1}
                        onClick={() => {
                          setError("");
                          setSuccess("");
                          setDefaultSubBudgetNames((current) => current.filter((_, currentIndex) => currentIndex !== index));
                        }}
                      />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        <p className="text-sm text-slate-500">
          Usa una fila por especialidad. Puedes agregar, editar o eliminar sub-presupuestos iniciales antes de guardar.
        </p>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar configuracion"}
      </Button>
    </form>
  );
}

async function getErrorMessage(response: Response) {
  try {
    const data: unknown = await response.json();

    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string" &&
      data.error.trim().length > 0
    ) {
      return data.error;
    }
  } catch {
    return DEFAULT_SAVE_ERROR;
  }

  return DEFAULT_SAVE_ERROR;
}

function parseBudgetRates(inputs: {
  defaultIgvRate: string;
  defaultGeneralExpensesRate: string;
  defaultUtilityRate: string;
}) {
  return {
    defaultIgvRate: parseSingleBudgetRate("IGV", inputs.defaultIgvRate),
    defaultGeneralExpensesRate: parseSingleBudgetRate("Gastos generales", inputs.defaultGeneralExpensesRate),
    defaultUtilityRate: parseSingleBudgetRate("Utilidad", inputs.defaultUtilityRate),
  };
}

function parseSubBudgetNames(values: string[]) {
  const parsed = values
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (parsed.length === 0) {
    throw new Error(GENERIC_SUB_BUDGET_LIST_ERROR);
  }

  const unique = [...new Set(parsed)];
  if (unique.length !== parsed.length) {
    throw new Error("No se permiten nombres repetidos en especialidades iniciales.");
  }

  return unique;
}

function parseSingleBudgetRate(label: string, value: string) {
  try {
    return parseBudgetRatePercentageInput(value);
  } catch (error) {
    throw new Error(`${label}: ${getBudgetRateErrorMessage(error)}`);
  }
}

function getBudgetRateErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return GENERIC_PERCENTAGE_ERROR;
  }

  if (error.message === "Budget rate percentage must be between 0 and 100") {
    return "Ingresa un porcentaje entre 0 y 100.";
  }

  if (error.message === "Budget rate percentage must be a valid number") {
    return GENERIC_PERCENTAGE_ERROR;
  }

  return GENERIC_PERCENTAGE_ERROR;
}

function areSubBudgetNamesEqual(current: readonly string[], base: readonly string[]) {
  if (current.length !== base.length) {
    return false;
  }

  return current.every((name, index) => name === base[index]);
}

function moveSubBudgetNameToTarget(names: readonly string[], sourceIndex: number, targetIndex: number) {
  if (sourceIndex === targetIndex) {
    return [...names];
  }

  const nextNames = [...names];
  const [sourceName] = nextNames.splice(sourceIndex, 1);

  if (sourceName === undefined) {
    return [...names];
  }

  nextNames.splice(targetIndex, 0, sourceName);
  return nextNames;
}
