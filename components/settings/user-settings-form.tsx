"use client";

import { useState } from "react";
import { GripVertical, Loader2, Save } from "lucide-react";
import { broadcastAppDataChange } from "@/lib/client/live-updates";
import { dispatchAppViewModeSettingsUpdated } from "@/lib/budget/view-mode";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormActionBar, FormSectionPanel } from "@/components/ui/operational-surfaces";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StaticTableFrame } from "@/components/ui/virtualized-table-frame";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import {
  formatBudgetRatePercentageInput,
  parseBudgetRatePercentageInput,
} from "@/lib/settings/budget-rate-percentages";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  APP_THEME_OPTIONS,
  DATE_FORMAT_OPTIONS,
  DEFAULT_INITIAL_SUB_BUDGET_NAMES,
  EXCEL_ROW_HEIGHT_OPTIONS,
  type UserSettingsRecord,
} from "@/types/settings";

const DEFAULT_SAVE_ERROR = "No se pudo guardar la configuracion";
const GENERIC_PERCENTAGE_ERROR = "Ingresa un porcentaje valido entre 0 y 100.";
const CURRENCY_DECIMAL_OPTIONS = [0, 1, 2, 3, 4] as const;
const GENERIC_SUB_BUDGET_LIST_ERROR = "Agrega al menos un Sub Presupuesto, sin repeticiones y con nombres validos.";
const NEW_SUB_BUDGET_PLACEHOLDER = "Nuevo Sub Presupuesto";
const DATE_FORMAT_LABELS: Record<(typeof DATE_FORMAT_OPTIONS)[number], string> = {
  DD_MM_YYYY: "dd/MM/yyyy",
  DD_MMM_YYYY: "dd MMM yyyy",
  DD_MM: "dd/MM",
};
const APP_THEME_LABELS: Record<(typeof APP_THEME_OPTIONS)[number], string> = {
  light: "Claro",
  ["dark"]: "Oscuro",
};
type DraggedSubBudgetIndex = number | null;

export function UserSettingsForm({
  initialSettings,
  onSaved,
  formId,
  onSavingChange,
}: {
  initialSettings: UserSettingsRecord;
  onSaved?: (settings: UserSettingsRecord) => void;
  formId?: string;
  onSavingChange?: (saving: boolean) => void;
}) {
  const { isExcelMode } = useAppViewMode();
  const [defaultCurrency, setDefaultCurrency] = useState<UserSettingsRecord["defaultCurrency"]>(initialSettings.defaultCurrency);
  const [currencyDecimals, setCurrencyDecimals] = useState(String(initialSettings.currencyDecimals));
  const [dateFormat, setDateFormat] = useState<UserSettingsRecord["dateFormat"]>(initialSettings.dateFormat);
  const [appTheme, setAppTheme] = useState<UserSettingsRecord["appTheme"]>(initialSettings.appTheme ?? "light");
  const [defaultViewMode, setDefaultViewMode] = useState<UserSettingsRecord["defaultViewMode"]>(initialSettings.defaultViewMode);
  const [excelShowFieldBorders, setExcelShowFieldBorders] = useState(initialSettings.excelShowFieldBorders);
  const [excelRowHeight, setExcelRowHeight] = useState(String(initialSettings.excelRowHeight));
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
  const preview = formatCurrency(7723.48, defaultCurrency, Number(currencyDecimals));
  const datePreview = formatDate("2026-05-12T00:00:00.000Z", dateFormat);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    onSavingChange?.(true);
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
        appTheme,
        defaultViewMode,
        excelShowFieldBorders,
        excelRowHeight: Number(excelRowHeight),
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

      const savedSettings = await readUserSettingsResponse(response);
      dispatchAppViewModeSettingsUpdated({
        defaultViewMode: savedSettings.defaultViewMode,
        excelShowFieldBorders: savedSettings.excelShowFieldBorders,
        excelRowHeight: savedSettings.excelRowHeight,
      });
      onSaved?.(savedSettings);
      broadcastAppDataChange(["/dashboard", "/projects", "/budgets", "/resources", "/settings"], undefined, {
        locallyHandledPaths: ["/settings"],
      });
      setSuccess("Configuracion guardada correctamente.");
    } catch (submissionError) {
      setError(submissionError instanceof Error && submissionError.message ? submissionError.message : DEFAULT_SAVE_ERROR);
    } finally {
      setPending(false);
      onSavingChange?.(false);
    }
  }

  return (
    <form id={formId} className="space-y-5" onSubmit={handleSubmit}>
      <FormSectionPanel
        title="Moneda y fecha"
        description="Controla como se presentan montos y fechas en tablas, tarjetas y flujos nuevos."
      >
        <div className="grid gap-4 md:grid-cols-2">
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
            <p className="text-sm text-[var(--app-text-muted)]">Se usara como moneda inicial en nuevas vistas y presupuestos compatibles.</p>
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
            <p className="text-sm text-[var(--app-text-muted)]">
              Esto cambia solo la visualizacion. Los calculos monetarios internos mantienen su precision contable.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="appTheme">Tema de la app</Label>
          <Select id="appTheme" disabled={pending} value={appTheme} onChange={(event) => setAppTheme(event.target.value as UserSettingsRecord["appTheme"])}>
            {APP_THEME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {APP_THEME_LABELS[option]}
              </option>
            ))}
          </Select>
          <p className="text-sm text-[var(--app-text-muted)]">Aplica el look general de la webapp, incluyendo shell, cards, tablas y formularios compatibles.</p>
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
          <p className="text-sm text-[var(--app-text-muted)]">
            El formato seleccionado se usara en tablas, tarjetas y vistas de seguimiento donde se muestren fechas.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PreviewInfoCard label="Vista previa de moneda" value={preview} />
          <PreviewInfoCard label="Vista previa de fecha" value={datePreview} />
        </div>
      </FormSectionPanel>

      <FormSectionPanel
        title="Vista global Excel"
        description="Define si la app debe abrir en modo Excel por defecto y ajusta parte de su densidad visual."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="defaultViewMode">Vista global por defecto</Label>
            <Select
              id="defaultViewMode"
              disabled={pending}
              value={defaultViewMode}
              onChange={(event) => setDefaultViewMode(event.target.value as UserSettingsRecord["defaultViewMode"])}
            >
              <option value="modern">Vista moderna</option>
              <option value="excel">Modo Excel</option>
            </Select>
            <p className="text-sm text-[var(--app-text-muted)]">Se aplicara como vista inicial global y seguira siendo editable desde cada flujo.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="excelRowHeight">Altura de filas en modo Excel</Label>
            <Select id="excelRowHeight" disabled={pending} value={excelRowHeight} onChange={(event) => setExcelRowHeight(event.target.value)}>
              {EXCEL_ROW_HEIGHT_OPTIONS.map((option) => (
                <option key={option} value={String(option)}>
                  {option}px
                </option>
              ))}
            </Select>
            <p className="text-sm text-[var(--app-text-muted)]">Afecta la lectura de tablas compactas y listas virtualizadas compatibles con el modo Excel.</p>
          </div>
        </div>

        <label
          htmlFor="excelShowFieldBorders"
          className="flex items-start gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 transition hover:border-sky-300 hover:bg-[var(--app-primary-muted)]"
        >
          <input
            id="excelShowFieldBorders"
            checked={excelShowFieldBorders}
            className="mt-0.5 h-4 w-4 rounded border-[var(--app-border-strong)] [--control-accent:var(--app-primary)] focus:ring-sky-500"
            disabled={pending}
            type="checkbox"
            onChange={(event) => setExcelShowFieldBorders(event.target.checked)}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--app-text-strong)]">Mostrar bordes en fields</p>
            <p className="text-sm text-[var(--app-text-muted)]">
              Mantiene visibles los bordes de inputs y selects en modo Excel para una lectura mas tecnica.
            </p>
          </div>
        </label>
      </FormSectionPanel>

      <FormSectionPanel
        title="Porcentajes base"
        description="Valores iniciales sugeridos al crear presupuestos y estructuras nuevas."
      >
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
      </FormSectionPanel>

      <FormSectionPanel
        title="Sub Presupuestos iniciales"
        description="Lista base de sub presupuestos que se crea automaticamente en cada proyecto nuevo."
      >
        <div
          className={
            isExcelMode
              ? "rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-sm"
              : "rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm shadow-slate-950/10"
          }
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="defaultSubBudgetName-0">Sub presupuestos base</Label>
                <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-text-muted)]">
                  {defaultSubBudgetNames.length} {defaultSubBudgetNames.length === 1 ? "Sub Presupuesto" : "Sub Presupuestos"}
                </span>
              </div>
              {matchesDefaultSubBudgetNames ? (
                <Badge className="theme-status-success theme-status-success-strong">Usando lista base</Badge>
              ) : null}
              <p className="text-sm text-[var(--app-text-muted)]">
                Usa una fila por Sub Presupuesto. Puedes agregar, editar o eliminar Sub Presupuestos iniciales antes de guardar.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className=""
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
                className=""
                disabled={pending}
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setDefaultSubBudgetNames((current) => [...current, ""]);
                }}
              >
                Agregar Sub Presupuesto
              </Button>
            </div>
          </div>

          <StaticTableFrame className="mt-4">
            <Table>
              <THead>
                <TR className="bg-[var(--app-surface-muted)] hover:bg-[var(--app-surface-muted)]">
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
                    className={draggedSubBudgetIndex === index ? "scale-[0.995] bg-[var(--app-primary-muted)] opacity-60 ring-2 ring-sky-300" : "hover:bg-[var(--app-surface-muted)]"}
                  >
                    <TD className="text-center text-[var(--app-text-subtle)]">
                      <span className="inline-flex cursor-grab items-center justify-center rounded-lg p-1 transition hover:bg-[var(--app-surface-muted)]">
                        <GripVertical className="h-4 w-4" />
                      </span>
                    </TD>
                    <TD className="font-medium text-[var(--app-text-muted)]">{index + 1}</TD>
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
          </StaticTableFrame>
        </div>
      </FormSectionPanel>

      {error ? <p className="theme-status-error rounded-2xl border px-4 py-3 text-sm">{error}</p> : null}
      {success ? <p className="theme-status-success theme-status-success-strong rounded-2xl border px-4 py-3 text-sm">{success}</p> : null}

      {!formId ? (
        <FormActionBar>
          <Button type="submit" disabled={pending} className="gap-2">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </FormActionBar>
      ) : null}
    </form>
  );
}

function PreviewInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
      <p className="text-sm text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--app-text-strong)]">{value}</p>
    </div>
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

async function readUserSettingsResponse(response: Response): Promise<UserSettingsRecord> {
  try {
    if (typeof response.text !== "function") {
      return (await response.json()) as UserSettingsRecord;
    }

    const text = await response.text();
    return JSON.parse(text) as UserSettingsRecord;
  } catch {
    throw new Error(DEFAULT_SAVE_ERROR);
  }
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
    throw new Error("No se permiten nombres repetidos en los Sub Presupuestos iniciales.");
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

