"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CellValue, Worksheet } from "exceljs";
import { Calculator, ChevronRight, FileSpreadsheet, Plus, Trash2 } from "lucide-react";

import {
  addMetradoRow,
  buildDefaultMetradoSheetName,
  deleteMetradoRow,
  duplicateMetradoRow,
  updateMetradoRowInput,
} from "@/components/metrados/metrado-view-model";
import { MetradoExportActions } from "@/components/metrados/MetradoExportActions";
import { MetradoFormulaBar } from "@/components/metrados/MetradoFormulaBar";
import { type MetradoActiveCell, MetradoSheetTable } from "@/components/metrados/MetradoSheetTable";
import { MetradoSummaryPanel } from "@/components/metrados/MetradoSummaryPanel";
import { MetradoTemplateSelector } from "@/components/metrados/MetradoTemplateSelector";
import { MetradoValidationPanel } from "@/components/metrados/MetradoValidationPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { calculateMetradoSheet } from "@/lib/calculations/metrados";
import { customMetradoFormulaSuggestions } from "@/lib/metrados/custom-formula-suggestions";
import { metradoTemplates } from "@/lib/metrados/templates";
import { validateMetradoSheet } from "@/lib/metrados/validation";
import { cn } from "@/lib/utils";
import type {
  CustomMetradoFormulaRecord,
  MetradoFormulaInputKey,
  MetradoFormulaRecord,
  MetradoRowRecord,
  MetradoSheetRecord,
  MetradoTemplateType,
  MetradoUnit,
} from "@/types/metrado";

export type MetradoProjectOption = {
  id: string;
  name: string;
};

export type MetradoBudgetOption = {
  id: string;
  projectId: string;
  name: string;
};

export type MetradoPartidaOption = {
  id: string;
  projectId: string;
  budgetId: string;
  code: string;
  description: string;
  unit: string;
};

type ActionState = "idle" | "saving" | "saved" | "error";
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type MetradosDashboardProps = {
  initialSheets: MetradoSheetRecord[];
  projects: MetradoProjectOption[];
  budgets: MetradoBudgetOption[];
  partidas: MetradoPartidaOption[];
  customFormulas: CustomMetradoFormulaRecord[];
};

type ImportPreviewResponse = {
  rows: MetradoRowRecord[];
  issues: Array<{ id: string; severity: "error" | "warning"; rowId?: string; field?: string; message: string }>;
};

type SheetResponse = {
  sheet: MetradoSheetRecord;
};

type FormulaResponse = {
  formula: CustomMetradoFormulaRecord;
};

const units = ["m", "m2", "m3", "kg", "und", "glb"] as const satisfies MetradoUnit[];

export function MetradosDashboard({
  initialSheets,
  projects,
  budgets,
  partidas,
  customFormulas: initialCustomFormulas,
}: MetradosDashboardProps) {
  const [sheets, setSheets] = useState<MetradoSheetRecord[]>(initialSheets);
  const [customFormulas, setCustomFormulas] = useState<CustomMetradoFormulaRecord[]>(initialCustomFormulas);
  const [selectedSheetId, setSelectedSheetId] = useState(initialSheets[0]?.id ?? "");
  const selectedSheet = sheets.find((sheet) => sheet.id === selectedSheetId) ?? null;
  const initialProjectId = selectedSheet?.projectId ?? projects[0]?.id ?? "";
  const initialBudgetId =
    selectedSheet?.budgetId ?? budgets.find((budget) => budget.projectId === initialProjectId)?.id ?? "";
  const initialPartidaId =
    selectedSheet?.partidaLink?.budgetItemId ??
    partidas.find((partida) => partida.budgetId === initialBudgetId)?.id ??
    "";
  const [projectId, setProjectId] = useState(initialProjectId);
  const [budgetId, setBudgetId] = useState(initialBudgetId);
  const [partidaId, setPartidaId] = useState(initialPartidaId);
  const [templateType, setTemplateType] = useState<MetradoTemplateType>(
    selectedSheet?.templateType ?? "CONCRETE",
  );
  const [sheetName, setSheetName] = useState(selectedSheet?.name ?? "Nuevo metrado");
  const [sheetUnit, setSheetUnit] = useState<MetradoUnit>(selectedSheet?.unit ?? "m3");
  const [rows, setRows] = useState<MetradoRowRecord[]>(selectedSheet?.rows ?? []);
  const [preferredFormulaKey, setPreferredFormulaKey] = useState(selectedSheet?.rows[0]?.formulaKey ?? "manual");
  const [activeCell, setActiveCell] = useState<MetradoActiveCell | null>(null);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveClock, setSaveClock] = useState(() => Date.now());
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customFormulaSheetOpen, setCustomFormulaSheetOpen] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const isHydrated = useRef(false);
  const saveRef = useRef<((isAutosave?: boolean) => Promise<boolean>) | null>(null);
  const lastSavedPayload = useRef("");

  const template = useMemo(
    () => metradoTemplates.find((entry) => entry.type === templateType) ?? metradoTemplates[0],
    [templateType],
  );
  const availableFormulas = useMemo(
    () => (templateType === "CUSTOM" ? [...template.formulas, ...customFormulas] : template.formulas),
    [customFormulas, template.formulas, templateType],
  );
  const pinnedCustomFormulas = useMemo(
    () => customFormulas.filter((formula) => formula.showInSuggestions),
    [customFormulas],
  );
  const inputColumns = useMemo(
    () => collectFormulaInputColumns(availableFormulas, rows, preferredFormulaKey),
    [availableFormulas, preferredFormulaKey, rows],
  );
  const calculated = useMemo(
    () => calculateMetradoSheet({ unit: sheetUnit, rows, formulas: availableFormulas }),
    [availableFormulas, rows, sheetUnit],
  );
  const selectedPartida = partidas.find((partida) => partida.id === partidaId) ?? null;
  const isCreatingSheet = !selectedSheet;
  const validationIssues = useMemo(
    () =>
      validateMetradoSheet({
        sheetUnit,
        templateFormulaKeys: availableFormulas.map((formula) => formula.key),
        formulas: availableFormulas,
        linkedPartidaUnit: selectedSheet?.partidaLink?.budgetItemUnit ?? selectedPartida?.unit ?? null,
        rows: calculated.rows,
      }),
    [
      availableFormulas,
      calculated.rows,
      selectedPartida?.unit,
      selectedSheet?.partidaLink?.budgetItemUnit,
      sheetUnit,
    ],
  );
  const issues = useMemo(
    () => mergeIssues([...calculated.issues, ...validationIssues]),
    [calculated.issues, validationIssues],
  );
  const hasBlockingIssues = issues.some((issue) => issue.severity === "error");
  const filteredBudgets = budgets.filter((budget) => budget.projectId === projectId);
  const filteredPartidas = partidas.filter((partida) => partida.budgetId === budgetId);
  const activeSheetByPartidaId = useMemo(() => {
    const links = new Map<string, MetradoSheetRecord>();

    for (const sheet of sheets) {
      const linkedPartidaId = sheet.partidaLink?.budgetItemId;
      if (linkedPartidaId && !links.has(linkedPartidaId)) {
        links.set(linkedPartidaId, sheet);
      }
    }

    return links;
  }, [sheets]);
  const selectedPartidaActiveSheet = partidaId ? activeSheetByPartidaId.get(partidaId) ?? null : null;
  const activeRow = calculated.rows.find((row) => row.id === activeCell?.rowId) ?? calculated.rows[0] ?? null;
  const activeFormula =
    availableFormulas.find((formula) => formula.key === (activeRow?.formulaKey ?? preferredFormulaKey)) ??
    availableFormulas[0] ??
    null;
  const exportHref = selectedSheet ? `/api/metrados-avanzados/${selectedSheet.id}/export` : null;
  const persistedSheetSelected = Boolean(selectedSheet);
  const serializedDraft = useMemo(
    () => JSON.stringify(getSheetSavePayload({ name: sheetName, unit: sheetUnit, rows: calculated.rows })),
    [calculated.rows, sheetName, sheetUnit],
  );

  useEffect(() => {
    saveRef.current = saveDraft;
  });

  useEffect(() => {
    lastSavedPayload.current = selectedSheet
      ? JSON.stringify(getSheetSavePayload({ name: selectedSheet.name, unit: selectedSheet.unit, rows: selectedSheet.rows }))
      : "";
    isHydrated.current = true;
  }, [selectedSheet]);

  useEffect(() => {
    if (!isHydrated.current || !selectedSheet) {
      return;
    }

    if (serializedDraft !== lastSavedPayload.current) {
      setSaveState("dirty");
    }
  }, [selectedSheet, serializedDraft]);

  useEffect(() => {
    if (saveState !== "dirty" || !selectedSheet || hasBlockingIssues) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void saveRef.current?.(true);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [hasBlockingIssues, saveState, selectedSheet]);

  useEffect(() => {
    if (!lastSavedAt) {
      return;
    }

    const interval = window.setInterval(() => setSaveClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [lastSavedAt]);

  function selectSheet(sheetId: string) {
    if (!sheetId) {
      startNewSheet();
      return;
    }

    const nextSheet = sheets.find((sheet) => sheet.id === sheetId) ?? null;
    setSelectedSheetId(sheetId);
    if (!nextSheet) {
      setRows([]);
      setActiveCell(null);
      setSaveState("idle");
      setLastSavedAt(null);
      setFeedback("");
      setError("");
      return;
    }
    setProjectId(nextSheet.projectId);
    setBudgetId(nextSheet.budgetId);
    setPartidaId(nextSheet.partidaLink?.budgetItemId ?? "");
    setTemplateType(nextSheet.templateType);
    setSheetName(nextSheet.name);
    setSheetUnit(nextSheet.unit);
    setRows(nextSheet.rows);
    setPreferredFormulaKey(nextSheet.rows[0]?.formulaKey ?? (nextSheet.templateType === "CUSTOM" ? "manual" : ""));
    setActiveCell(null);
    setSaveState("idle");
    setLastSavedAt(null);
    setFeedback("");
    setError("");
  }

  function loadSheetIntoEditor(sheet: MetradoSheetRecord) {
    setSelectedSheetId(sheet.id);
    setProjectId(sheet.projectId);
    setBudgetId(sheet.budgetId);
    setPartidaId(sheet.partidaLink?.budgetItemId ?? "");
    setTemplateType(sheet.templateType);
    setSheetName(sheet.name);
    setSheetUnit(sheet.unit);
    setRows(sheet.rows);
    setPreferredFormulaKey(sheet.rows[0]?.formulaKey ?? (sheet.templateType === "CUSTOM" ? "manual" : ""));
    setActiveCell(null);
    setSaveState("idle");
    setLastSavedAt(null);
    setFeedback("");
    setError("");
  }

  function startNewSheet() {
    const nextProjectId = projectId || projects[0]?.id || "";
    const currentBudgetStillApplies = budgets.some((budget) => budget.id === budgetId && budget.projectId === nextProjectId);
    const nextBudgetId = currentBudgetStillApplies
      ? budgetId
      : budgets.find((budget) => budget.projectId === nextProjectId)?.id ?? "";
    const nextPartida = partidas.find((partida) => partida.budgetId === nextBudgetId) ?? null;
    const nextTemplate = metradoTemplates[0];

    setSelectedSheetId("");
    setProjectId(nextProjectId);
    setBudgetId(nextBudgetId);
    setPartidaId(nextPartida?.id ?? "");
    setTemplateType(nextTemplate.type);
    setSheetUnit(nextTemplate.defaultUnit);
    setSheetName(buildDefaultMetradoSheetName({ templateName: nextTemplate.name, partidaCode: nextPartida?.code }));
    setRows([]);
    setPreferredFormulaKey("manual");
    setActiveCell(null);
    setSaveState("idle");
    setLastSavedAt(null);
    setFeedback("Configura la hoja y presiona Crear hoja.");
    setError("");
  }

  function requestDeleteSelectedSheet() {
    if (!selectedSheet) {
      setError("Selecciona una hoja para eliminar.");
      return;
    }

    setDeleteDialogOpen(true);
  }

  async function deleteSelectedSheet() {
    if (!selectedSheet) {
      setDeleteDialogOpen(false);
      setError("Selecciona una hoja para eliminar.");
      return;
    }

    setDeleteDialogOpen(false);
    await runAction(async () => {
      const response = await fetch(`/api/metrados-avanzados/${selectedSheet.id}`, {
        method: "DELETE",
      });
      await readJson<{ ok: true }>(response);

      const nextSheets = sheets.filter((sheet) => sheet.id !== selectedSheet.id);
      setSheets(nextSheets);

      const nextSheet = nextSheets[0] ?? null;
      if (nextSheet) {
        loadSheetIntoEditor(nextSheet);
      } else {
        startNewSheet();
      }

      setFeedback("Hoja eliminada.");
    }, "No se pudo eliminar la hoja.");
  }

  async function createSheet() {
    if (!projectId || !budgetId || !partidaId) {
      setError("Selecciona proyecto, presupuesto y partida.");
      return;
    }

    await runAction(async () => {
      const sheet = await createSheetRecord();
      selectCreatedSheet(sheet, sheet.rows);
      setFeedback("Metrado creado.");
    }, "No se pudo crear el metrado.");
  }

  async function saveDraft(isAutosave = false): Promise<boolean> {
    if (!selectedSheet) {
      if (!projectId || !budgetId || !partidaId) {
        setError("Selecciona proyecto, presupuesto y partida.");
        return false;
      }

      await runAction(async () => {
        const draftRows = calculated.rows;
        const sheet = await createSheetRecord();
        selectCreatedSheet(sheet, draftRows);
        await persistDraft(sheet.id, draftRows, isAutosave);
        setFeedback("Borrador guardado.");
      }, "No se pudo guardar el borrador.");
      return true;
    }

    if (serializedDraft === lastSavedPayload.current && saveState !== "error") {
      if (saveState === "dirty") {
        setSaveState("saved");
      }
      return true;
    }

    if (hasBlockingIssues) {
      setSaveState("error");
      setError("Corrige los errores antes de guardar.");
      return false;
    }

    await runAction(async () => {
      await persistDraft(selectedSheet.id, calculated.rows, isAutosave);
      if (!isAutosave) {
        setFeedback("Borrador guardado.");
      }
    }, "No se pudo guardar el borrador.");
    return true;
  }

  async function sendToPartida() {
    if (!selectedSheet) {
      setError("Guarda el metrado antes de enviarlo.");
      return;
    }

    await runAction(async () => {
      await persistDraft(selectedSheet.id, calculated.rows);
      const response = await fetch(`/api/metrados-avanzados/${selectedSheet.id}/send-to-partida`, {
        method: "POST",
      });
      await readJson<{ quantity: number }>(response);
      const refreshed = await fetch(`/api/metrados-avanzados/${selectedSheet.id}`);
      const payload = await readJson<SheetResponse>(refreshed);
      setSheets((current) => current.map((sheet) => (sheet.id === payload.sheet.id ? payload.sheet : sheet)));
      setFeedback("Total enviado a la partida.");
    }, "No se pudo enviar el total.");
  }

  async function importRows(file: File) {
    if (!selectedSheet) {
      setError("Crea o selecciona un metrado antes de importar.");
      return;
    }

    await runAction(async () => {
      const rawRows = await extractRowsFromFile(file);
      const response = await fetch(`/api/metrados-avanzados/${selectedSheet.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rawRows }),
      });
      const payload = await readJson<ImportPreviewResponse>(response);
      const nextRows = payload.rows.map((row) => ({ ...row, sheetId: selectedSheet.id }));
      setRows(nextRows);
      setFeedback(`Importacion lista: ${nextRows.length} filas.`);
      if (payload.issues.length > 0) {
        setError(`${payload.issues.length} alertas de importacion.`);
      }
    }, "No se pudo importar el archivo.");
  }

  async function saveCustomFormula(input: {
    name: string;
    description: string;
    category: string;
    expression: string;
    requiredInputs: MetradoFormulaInputKey[];
    resultUnit: MetradoUnit;
    showInSuggestions: boolean;
  }): Promise<CustomMetradoFormulaRecord> {
    const response = await fetch("/api/metrados-avanzados/formulas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await readJson<FormulaResponse>(response);
    setCustomFormulas((current) => [...current, payload.formula].sort(compareFormulaRecords));
    setFeedback("Formula personalizada guardada.");
    return payload.formula;
  }

  async function updateCustomFormula(input: {
    id: string;
    name: string;
    description: string;
    category: string;
    expression: string;
    requiredInputs: MetradoFormulaInputKey[];
    resultUnit: MetradoUnit;
    showInSuggestions: boolean;
  }): Promise<CustomMetradoFormulaRecord> {
    const response = await fetch("/api/metrados-avanzados/formulas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await readJson<FormulaResponse>(response);
    setCustomFormulas((current) =>
      current.map((formula) => (formula.id === payload.formula.id ? payload.formula : formula)).sort(compareFormulaRecords),
    );
    setFeedback("Formula personalizada actualizada.");
    return payload.formula;
  }

  function patchRow(
    rowId: string,
    patch: Partial<Pick<MetradoRowRecord, "sector" | "eje" | "nivel" | "description" | "unit" | "formulaKey">>,
  ) {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function updateInput(rowId: string, key: MetradoFormulaInputKey, value: string) {
    if (value.trim() === "") {
      setRows((current) =>
        current.map((row) => {
          if (row.id !== rowId) {
            return row;
          }
          const nextInputs = { ...row.inputs };
          delete nextInputs[key];
          return { ...row, inputs: nextInputs };
        }),
      );
      return;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      setRows((current) => updateMetradoRowInput(current, rowId, key, parsed));
    }
  }

  async function persistDraft(sheetId: string, draftRows: MetradoRowRecord[], isAutosave = false) {
    setSaveState("saving");

    const metadataResponse = await fetch(`/api/metrados-avanzados/${sheetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sheetName, unit: sheetUnit }),
    });
    await readJson<SheetResponse>(metadataResponse);

    const rowsResponse = await fetch(`/api/metrados-avanzados/${sheetId}/rows`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: draftRows }),
    });
    const payload = await readJson<SheetResponse>(rowsResponse);
    setSheets((current) => current.map((sheet) => (sheet.id === payload.sheet.id ? payload.sheet : sheet)));
    setRows(payload.sheet.rows);
    setSheetUnit(payload.sheet.unit);
    lastSavedPayload.current = JSON.stringify(
      getSheetSavePayload({ name: payload.sheet.name, unit: payload.sheet.unit, rows: payload.sheet.rows }),
    );
    setLastSavedAt(Date.now());
    setSaveClock(Date.now());
    setSaveState("saved");
    if (isAutosave) {
      setFeedback("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] px-4 py-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.28)] lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            <FileSpreadsheet className="h-4 w-4" />
            Metrados avanzados
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Hoja de metrados</h1>
          <p className="text-xs leading-5 text-slate-500">Registro de cantidades con formulas, autosave y envio a partida.</p>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <MetradoExportActions
            exportHref={exportHref}
            actionState={actionState}
            canSave={Boolean(selectedSheet) && (!hasBlockingIssues || rows.length === 0)}
            canSend={Boolean(selectedSheet) && !hasBlockingIssues}
            canImport={Boolean(selectedSheet)}
            onSaveDraft={saveDraft}
            onImportFile={importRows}
            onSendToPartida={sendToPartida}
            saveState={selectedSheet ? saveState : undefined}
            lastSavedLabel={lastSavedAt ? formatLastSavedLabel(lastSavedAt, saveClock) : null}
            saveLabel="Guardar"
          />
        </div>
      </div>

      <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100/60" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 marker:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Calculator className="h-4 w-4 shrink-0 text-sky-600" />
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">Configuracion</span>
              <span className="block truncate text-xs text-slate-500">
                Proyecto, presupuesto, partida y formula de la hoja.
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                startNewSheet();
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva hoja
            </Button>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition group-hover:bg-slate-100 group-open:rotate-90 group-open:bg-slate-100">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </summary>
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1.2fr)_minmax(180px,0.9fr)_minmax(180px,0.9fr)]">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <Field label="Hoja existente">
                <Select
                  id="metrado-sheet-select"
                  value={selectedSheetId}
                  onChange={(event) => selectSheet(event.currentTarget.value)}
                >
                  <option value="" disabled>
                    {sheets.length === 0 ? "Sin hojas guardadas" : "Seleccionar hoja"}
                  </option>
                  {sheets.map((sheet) => (
                    <option key={sheet.id} value={sheet.id}>
                      {sheet.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-10 px-0 text-rose-600 hover:bg-rose-50"
                disabled={!selectedSheet || actionState === "saving"}
                aria-label="Eliminar hoja seleccionada"
                title="Eliminar hoja seleccionada"
                onClick={requestDeleteSelectedSheet}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Field label="Proyecto">
              <Select
                id="metrado-project-select"
                value={projectId}
                disabled={persistedSheetSelected}
                onChange={(event) => {
                  const nextProjectId = event.currentTarget.value;
                  const nextBudgetId = budgets.find((budget) => budget.projectId === nextProjectId)?.id ?? "";
                  const nextPartida = partidas.find((partida) => partida.budgetId === nextBudgetId) ?? null;
                  setProjectId(nextProjectId);
                  setBudgetId(nextBudgetId);
                  setPartidaId(nextPartida?.id ?? "");
                  if (isCreatingSheet) {
                    setSheetName(buildDefaultMetradoSheetName({ templateName: template.name, partidaCode: nextPartida?.code }));
                  }
                }}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Presupuesto">
              <Select
                id="metrado-budget-select"
                value={budgetId}
                disabled={persistedSheetSelected}
                onChange={(event) => {
                  const nextBudgetId = event.currentTarget.value;
                  const nextPartida = partidas.find((partida) => partida.budgetId === nextBudgetId) ?? null;
                  setBudgetId(nextBudgetId);
                  setPartidaId(nextPartida?.id ?? "");
                  if (isCreatingSheet) {
                    setSheetName(buildDefaultMetradoSheetName({ templateName: template.name, partidaCode: nextPartida?.code }));
                  }
                }}
              >
                {filteredBudgets.map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
            <Field label="Partida">
              <div className="space-y-1.5">
                <Select
                  id="metrado-partida-select"
                  value={partidaId}
                  disabled={persistedSheetSelected}
                  className={cn(
                    selectedPartidaActiveSheet &&
                      "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-500 focus-visible:ring-amber-500/20",
                  )}
                  contentClassName="w-[min(760px,calc(100vw-2rem))]"
                  onChange={(event) => {
                    const nextPartidaId = event.currentTarget.value;
                    const nextPartida = partidas.find((partida) => partida.id === nextPartidaId) ?? null;
                    setPartidaId(nextPartidaId);
                    if (isCreatingSheet) {
                      setSheetName(buildDefaultMetradoSheetName({ templateName: template.name, partidaCode: nextPartida?.code }));
                    }
                  }}
                >
                  {filteredPartidas.map((partida) => {
                    const activeSheet = activeSheetByPartidaId.get(partida.id) ?? null;

                    return (
                      <option key={partida.id} value={partida.id} data-tone={activeSheet ? "warning" : undefined}>
                        {buildPartidaOptionLabel(partida, activeSheet)}
                      </option>
                    );
                  })}
                </Select>
                {isCreatingSheet && selectedPartidaActiveSheet ? (
                  <p className="text-xs text-amber-700">
                    Esta partida ya tiene hoja activa: {selectedPartidaActiveSheet.name}.
                  </p>
                ) : null}
              </div>
            </Field>
            <Field label="Unidad">
              <Select
                id="metrado-unit-select"
                value={sheetUnit}
                onChange={(event) => setSheetUnit(event.currentTarget.value as MetradoUnit)}
              >
                {units.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(260px,520px)_minmax(320px,1fr)]">
            <Field label="Nombre">
              <Input
                id="metrado-name-input"
                value={sheetName}
                onChange={(event) => setSheetName(event.currentTarget.value)}
              />
            </Field>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="block truncate font-medium text-slate-900">
                {isCreatingSheet
                  ? "Creando nueva hoja"
                  : selectedPartida
                    ? `${selectedPartida.code} ${selectedPartida.description}`
                    : "Sin partida"}
              </span>
              <span className="text-xs">
                {isCreatingSheet ? "Selecciona proyecto, presupuesto, partida y plantilla" : `Vinculo: ${selectedPartida?.unit ?? "-"}`}
              </span>
            </div>
          </div>
          <MetradoTemplateSelector
            templates={metradoTemplates}
            value={templateType}
            customFormulaValue={templateType === "CUSTOM" ? preferredFormulaKey : null}
            customFormulaSuggestions={pinnedCustomFormulas}
            disabled={Boolean(selectedSheet)}
            onChange={(nextTemplateType) => {
              setTemplateType(nextTemplateType);
              const nextTemplate = metradoTemplates.find((entry) => entry.type === nextTemplateType);
              if (nextTemplate) {
                setSheetUnit(nextTemplate.defaultUnit);
                setPreferredFormulaKey(nextTemplate.formulaKeys[0] ?? "manual");
                if (isCreatingSheet) {
                  setSheetName(
                    buildDefaultMetradoSheetName({ templateName: nextTemplate.name, partidaCode: selectedPartida?.code }),
                  );
                }
              }
            }}
            onCustomFormulaChange={(formula) => {
              setTemplateType("CUSTOM");
              setPreferredFormulaKey(formula.key);
              setSheetUnit(formula.resultUnit);
              if (isCreatingSheet) {
                setSheetName(
                  buildDefaultMetradoSheetName({ templateName: formula.label, partidaCode: selectedPartida?.code }),
                );
              }
            }}
          />
          {templateType === "CUSTOM" ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Formula personalizada</p>
                <p className="mt-1 text-xs text-slate-500">
                  {customFormulas.length > 0
                    ? `${customFormulas.length} formulas guardadas. Puedes crear nuevas desde el panel lateral.`
                    : "Crea formulas con variables propias desde el panel lateral."}
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setCustomFormulaSheetOpen(true)}>
                Configurar formulas
              </Button>
            </div>
          ) : null}
          {isCreatingSheet ? (
            <div className="flex flex-col gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-sky-800 md:flex-row md:items-center md:justify-between">
              <span>Estas configurando una hoja nueva. Creala para habilitar importar, exportar y enviar a partida.</span>
              <Button size="sm" onClick={createSheet}>
                <Plus className="mr-2 h-4 w-4" />
                Crear hoja
              </Button>
            </div>
          ) : null}
        </div>
      </details>

      <DeleteMetradoSheetDialog
        open={deleteDialogOpen}
        sheetName={selectedSheet?.name ?? ""}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => void deleteSelectedSheet()}
      />
      <CustomFormulaSheet
        open={customFormulaSheetOpen}
        formulas={customFormulas}
        suggestions={customMetradoFormulaSuggestions}
        onClose={() => setCustomFormulaSheetOpen(false)}
        onSave={saveCustomFormula}
        onUpdate={updateCustomFormula}
        onUse={(formula) => {
          setTemplateType("CUSTOM");
          setPreferredFormulaKey(formula.key);
          setRows((current) =>
            current.map((row) => ({
              ...row,
              formulaKey: formula.key,
              unit: formula.resultUnit,
            })),
          );
          setSheetUnit(formula.resultUnit);
        }}
      />

      {selectedSheet ? (
        <>
          <MetradoFormulaBar activeRow={activeRow} formula={activeFormula} />

          <div
            className={cn(
              "grid gap-6",
              summaryCollapsed ? "xl:grid-cols-[minmax(0,1fr)_64px]" : "xl:grid-cols-[minmax(0,1fr)_360px]",
            )}
          >
            <MetradoSheetTable
              rows={calculated.rows}
              formulas={availableFormulas}
              inputColumns={inputColumns}
              activeCell={activeCell}
              onActiveCellChange={setActiveCell}
              onAddRow={() =>
                setRows((current) =>
                  addMetradoRow(
                    current,
                    selectedSheet.id,
                    sheetUnit,
                    preferredFormulaKey || availableFormulas[0]?.key || "manual",
                  ),
                )
              }
              onDuplicateRow={(rowId) => setRows((current) => duplicateMetradoRow(current, rowId))}
              onDeleteRow={(rowId) => setRows((current) => deleteMetradoRow(current, rowId))}
              onPatchRow={(rowId, patch) => {
                if (patch.formulaKey) {
                  const selectedFormula = availableFormulas.find((formula) => formula.key === patch.formulaKey);
                  setPreferredFormulaKey(patch.formulaKey);
                  patchRow(rowId, {
                    ...patch,
                    unit: selectedFormula?.resultUnit ?? patch.unit,
                  });
                  return;
                }
                patchRow(rowId, patch);
              }}
              onInputChange={updateInput}
            />
            <aside className="space-y-4">
              <MetradoSummaryPanel
                calculation={calculated}
                linkedPartida={selectedSheet.partidaLink}
                unit={sheetUnit}
                collapsed={summaryCollapsed}
                onToggleCollapsed={() => setSummaryCollapsed((current) => !current)}
              />
              {!summaryCollapsed ? (
                <>
                  <MetradoValidationPanel issues={issues} />
                  <StatusMessage state={actionState} feedback={feedback} error={error} />
                </>
              ) : null}
            </aside>
          </div>
        </>
      ) : (
        <StatusMessage state={actionState} feedback={feedback} error={error} />
      )}
    </div>
  );

  async function runAction(action: () => Promise<void>, fallbackError: string) {
    setActionState("saving");
    setError("");
    setFeedback("");

    try {
      await action();
      setActionState("saved");
    } catch (actionError) {
      setActionState("error");
      setError(actionError instanceof Error ? actionError.message : fallbackError);
    }
  }

  async function createSheetRecord(): Promise<MetradoSheetRecord> {
    const response = await fetch("/api/metrados-avanzados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        budgetId,
        budgetItemId: partidaId,
        templateType,
        unit: sheetUnit,
        name: sheetName,
      }),
    });
    const payload = await readJson<SheetResponse>(response);
    setSheets((current) => [payload.sheet, ...current.filter((sheet) => sheet.id !== payload.sheet.id)]);
    return payload.sheet;
  }

  function selectCreatedSheet(sheet: MetradoSheetRecord, nextRows: MetradoRowRecord[]) {
    setSelectedSheetId(sheet.id);
    setTemplateType(sheet.templateType);
    setSheetUnit(sheet.unit);
    setRows(nextRows);
    setActiveCell(null);
    setSaveState("idle");
    setLastSavedAt(null);
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const controlId = getChildControlId(children);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={controlId}>{label}</Label>
      {children}
    </div>
  );
}

function StatusMessage({ state, feedback, error }: { state: ActionState; feedback: string; error: string }) {
  if (!feedback && !error && state !== "saving") {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-sm",
        error
          ? "border-rose-100 bg-rose-50 text-rose-700"
          : "border-emerald-100 bg-emerald-50 text-emerald-700",
      )}
    >
      {state === "saving" ? "Procesando..." : error || feedback}
    </div>
  );
}

function CustomFormulaSheet({
  open,
  formulas,
  suggestions,
  onClose,
  onSave,
  onUpdate,
  onUse,
}: {
  open: boolean;
  formulas: CustomMetradoFormulaRecord[];
  suggestions: MetradoFormulaRecord[];
  onClose: () => void;
  onSave: (input: {
    name: string;
    description: string;
    category: string;
    expression: string;
    requiredInputs: MetradoFormulaInputKey[];
    resultUnit: MetradoUnit;
    showInSuggestions: boolean;
  }) => Promise<CustomMetradoFormulaRecord>;
  onUpdate: (input: {
    id: string;
    name: string;
    description: string;
    category: string;
    expression: string;
    requiredInputs: MetradoFormulaInputKey[];
    resultUnit: MetradoUnit;
    showInSuggestions: boolean;
  }) => Promise<CustomMetradoFormulaRecord>;
  onUse: (formula: MetradoFormulaRecord) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content asChild>
          <div className="fixed inset-y-0 right-0 z-50 h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-slate-50 p-5 shadow-2xl outline-none">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Configuracion</p>
              <Dialog.Title asChild>
                  <h3 className="text-2xl font-semibold text-slate-900">Formula personalizada</h3>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p className="mt-1 text-sm text-slate-500">
                  Guarda formulas reutilizables para partidas fuera de los grupos conocidos.
                </p>
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
                <Button variant="outline">Cerrar</Button>
            </Dialog.Close>
          </div>

            <CustomFormulaBuilder
              formulas={formulas}
              suggestions={suggestions}
              onSave={onSave}
              onUpdate={onUpdate}
              onUse={onUse}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CustomFormulaBuilder({
  formulas,
  suggestions,
  onSave,
  onUpdate,
  onUse,
}: {
  formulas: CustomMetradoFormulaRecord[];
  suggestions: MetradoFormulaRecord[];
  onSave: (input: {
    name: string;
    description: string;
    category: string;
    expression: string;
    requiredInputs: MetradoFormulaInputKey[];
    resultUnit: MetradoUnit;
    showInSuggestions: boolean;
  }) => Promise<CustomMetradoFormulaRecord>;
  onUpdate: (input: {
    id: string;
    name: string;
    description: string;
    category: string;
    expression: string;
    requiredInputs: MetradoFormulaInputKey[];
    resultUnit: MetradoUnit;
    showInSuggestions: boolean;
  }) => Promise<CustomMetradoFormulaRecord>;
  onUse: (formula: MetradoFormulaRecord) => void;
}) {
  const firstSuggestion = suggestions[0];
  const [editingFormulaId, setEditingFormulaId] = useState("");
  const [selectedSuggestionId, setSelectedSuggestionId] = useState(firstSuggestion?.id ?? "");
  const [name, setName] = useState(firstSuggestion?.label ?? "");
  const [category, setCategory] = useState(firstSuggestion?.category ?? "Personalizado");
  const [expression, setExpression] = useState(firstSuggestion?.expression ?? "");
  const [variables, setVariables] = useState(firstSuggestion?.requiredInputs.join(", ") ?? "");
  const [resultUnit, setResultUnit] = useState<MetradoUnit>(firstSuggestion?.resultUnit ?? "und");
  const [showInSuggestions, setShowInSuggestions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function applySuggestion(suggestionId: string) {
    const suggestion = suggestions.find((entry) => entry.id === suggestionId);
    setSelectedSuggestionId(suggestionId);
    setEditingFormulaId("");

    if (!suggestion) {
      return;
    }

    setName(suggestion.label);
    setCategory(suggestion.category ?? "Personalizado");
    setExpression(suggestion.expression);
    setVariables(suggestion.requiredInputs.join(", "));
    setResultUnit(suggestion.resultUnit);
    setShowInSuggestions(true);
    setMessage("");
  }

  function applySavedFormula(formulaId: string) {
    setEditingFormulaId(formulaId);
    setSelectedSuggestionId("");
    setMessage("");

    const formula = formulas.find((entry) => entry.id === formulaId);

    if (!formula) {
      return;
    }

    setName(formula.name);
    setCategory(formula.category);
    setExpression(formula.expression);
    setVariables(formula.requiredInputs.join(", "));
    setResultUnit(formula.resultUnit);
    setShowInSuggestions(formula.showInSuggestions);
  }

  function startNewFormula() {
    setEditingFormulaId("");
    applySuggestion(firstSuggestion?.id ?? "");
  }

  async function saveFormula() {
    const requiredInputs = parseVariableList(variables);

    if (!name.trim() || !expression.trim() || requiredInputs.length === 0) {
      setMessage("Completa nombre, variables y expresion.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const payload = {
        name,
        description: "",
        category,
        expression,
        requiredInputs,
        resultUnit,
        showInSuggestions,
      };
      const saved = editingFormulaId
        ? await onUpdate({
            id: editingFormulaId,
            ...payload,
          })
        : await onSave(payload);
      setEditingFormulaId(saved.id);
      onUse(saved);
      setMessage(editingFormulaId ? "Formula actualizada y lista para usar." : "Formula guardada y lista para usar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la formula.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-slate-900">Formula personalizada</h3>
        <p className="text-xs text-slate-500">
          Crea formulas con variables propias. Se permiten numeros, variables, parentesis y operadores + - * /.
        </p>
      </div>

      {formulas.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <Field label="Mis formulas guardadas">
            <Select
              id="metrado-saved-custom-formula"
              value={editingFormulaId}
              portal={false}
              onChange={(event) => applySavedFormula(event.currentTarget.value)}
            >
              <option value="" disabled>
                Seleccionar formula para editar
              </option>
              {formulas.map((formula) => (
                <option key={formula.id} value={formula.id}>
                  {formula.category} - {formula.label} - {formula.resultUnit}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={startNewFormula}>
              Nueva formula
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
        <Field label="Sugerencia">
          <Select
            id="metrado-custom-suggestion"
            value={selectedSuggestionId}
            portal={false}
            onChange={(event) => applySuggestion(event.currentTarget.value)}
          >
            {suggestions.map((suggestion) => (
              <option key={suggestion.id} value={suggestion.id}>
                {suggestion.category} - {suggestion.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unidad resultado">
          <Select
            id="metrado-custom-unit"
            value={resultUnit}
            portal={false}
            onChange={(event) => setResultUnit(event.currentTarget.value as MetradoUnit)}
          >
            {units.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.8fr)_minmax(180px,0.5fr)_minmax(0,1fr)]">
        <Field label="Nombre">
          <Input id="metrado-custom-name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
        </Field>
        <Field label="Categoria">
          <Input id="metrado-custom-category" value={category} onChange={(event) => setCategory(event.currentTarget.value)} />
        </Field>
        <Field label="Variables">
          <Input
            id="metrado-custom-variables"
            value={variables}
            placeholder="largo, alto, areaVanos"
            onChange={(event) => setVariables(event.currentTarget.value)}
          />
        </Field>
      </div>

      <Field label="Expresion">
        <Input
          id="metrado-custom-expression"
          value={expression}
          placeholder="(largo * alto) - areaVanos"
          onChange={(event) => setExpression(event.currentTarget.value)}
        />
      </Field>

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-1"
          checked={showInSuggestions}
          onChange={(event) => setShowInSuggestions(event.currentTarget.checked)}
        />
        <span>
          <span className="block font-medium text-slate-900">Mostrar en formulas sugeridas</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Aparecera como tarjeta antes de Personalizado en la configuracion de metrados.
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 truncate text-xs text-slate-500">
          {formulas.length > 0
            ? `Mis formulas guardadas: ${formulas.map((formula) => formula.label).join(", ")}`
            : "Aun no tienes formulas guardadas."}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" disabled={saving} onClick={() => void saveFormula()}>
            {editingFormulaId ? "Actualizar formula" : "Guardar formula"}
          </Button>
        </div>
      </div>

      {message ? <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}

function DeleteMetradoSheetDialog({
  open,
  sheetName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  sheetName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[96] bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[97] w-[min(520px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl outline-none">
          <div className="border-b border-slate-200 px-6 py-5">
            <Dialog.Title asChild>
              <h3 className="text-xl font-semibold text-slate-900">Eliminar hoja de metrado</h3>
            </Dialog.Title>
            <Dialog.Description asChild>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Se eliminara la hoja <span className="font-medium text-slate-700">{sheetName}</span> junto con sus filas y vinculo a la partida.
              </p>
            </Dialog.Description>
          </div>

          <div className="px-6 py-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Esta accion no se puede deshacer.
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onConfirm}>
              Eliminar hoja
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

async function readJson<TPayload>(response: Response): Promise<TPayload> {
  const body = (await response.json()) as { error?: string } & TPayload;

  if (!response.ok) {
    throw new Error(body.error ?? "No se pudo completar la accion.");
  }

  return body;
}

async function extractRowsFromFile(file: File): Promise<Record<string, unknown>[]> {
  if (isExcelFile(file)) {
    return parseExcelRows(file);
  }

  const parsed = JSON.parse(await file.text()) as unknown;
  return extractRowsArray(parsed);
}

async function parseExcelRows(file: File): Promise<Record<string, unknown>[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.getWorksheet("Metrado") ?? workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("El archivo Excel no contiene una hoja de metrado.");
  }

  return mapWorksheetRows(worksheet);
}

function mapWorksheetRows(worksheet: Worksheet): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < 8) {
      return;
    }

    const totalMarker = cellToImportValue(row.getCell(17).value);
    if (typeof totalMarker === "string" && totalMarker.trim().toLowerCase() === "total") {
      return;
    }

    const record: Record<string, unknown> = {
      sector: cellToImportValue(row.getCell(1).value),
      eje: cellToImportValue(row.getCell(2).value),
      nivel: cellToImportValue(row.getCell(3).value),
      description: cellToImportValue(row.getCell(4).value),
      formulaKey: cellToImportValue(row.getCell(5).value),
      unit: cellToImportValue(row.getCell(6).value),
      largo: cellToImportValue(row.getCell(7).value),
      ancho: cellToImportValue(row.getCell(8).value),
      alto: cellToImportValue(row.getCell(9).value),
      cantidad: cellToImportValue(row.getCell(10).value),
      longitud: cellToImportValue(row.getCell(11).value),
      pesoUnitario: cellToImportValue(row.getCell(12).value),
      perimetro: cellToImportValue(row.getCell(13).value),
      altura: cellToImportValue(row.getCell(14).value),
      area: cellToImportValue(row.getCell(15).value),
      factor: cellToImportValue(row.getCell(16).value),
      manual: cellToImportValue(row.getCell(17).value),
    };

    if (!isEmptyImportRecord(record)) {
      rows.push(record);
    }
  });

  return rows;
}

function cellToImportValue(value: CellValue): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(cellToImportValue).filter((item) => item !== null).join(" ");
  }

  if (hasStringProperty(value, "text")) {
    return value.text;
  }

  if (hasCellValueProperty(value, "result")) {
    return cellToImportValue(value.result);
  }

  if (hasRichText(value)) {
    return value.richText.map((item) => item.text).join("");
  }

  return null;
}

function collectFormulaInputColumns(
  formulas: MetradoFormulaRecord[],
  rows: MetradoRowRecord[],
  preferredFormulaKey: string,
): MetradoFormulaInputKey[] {
  const keys = new Set<MetradoFormulaInputKey>();

  const rowFormulaKeys = rows.length > 0 ? rows.map((row) => row.formulaKey) : [preferredFormulaKey];

  for (const formulaKey of rowFormulaKeys) {
    const formula = formulas.find((entry) => entry.key === formulaKey);

    if (!formula) {
      for (const row of rows.filter((entry) => entry.formulaKey === formulaKey)) {
        for (const key of Object.keys(row.inputs)) {
          keys.add(key);
        }
      }
      continue;
    }

    for (const key of formula.requiredInputs) {
      keys.add(key);
    }
  }

  return [...keys];
}

function getSheetSavePayload({
  name,
  unit,
  rows,
}: {
  name: string;
  unit: MetradoUnit;
  rows: MetradoRowRecord[];
}) {
  return {
    name,
    unit,
    rows: rows.map((row) => ({
      id: row.id,
      sector: row.sector,
      eje: row.eje,
      nivel: row.nivel,
      description: row.description,
      unit: row.unit,
      formulaKey: row.formulaKey,
      inputs: row.inputs,
      partial: row.partial,
      sortOrder: row.sortOrder,
    })),
  };
}

function formatLastSavedLabel(lastSavedAt: number, now: number): string {
  const seconds = Math.max(1, Math.floor((now - lastSavedAt) / 1000));

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

function buildPartidaOptionLabel(partida: MetradoPartidaOption, activeSheet: MetradoSheetRecord | null): string {
  const baseLabel = `${partida.code} - ${partida.description} - ${partida.unit}`;

  if (!activeSheet) {
    return baseLabel;
  }

  return `${baseLabel} - Hoja activa: ${activeSheet.name}`;
}

function parseVariableList(value: string): MetradoFormulaInputKey[] {
  const variables = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(entry));

  return [...new Set(variables)];
}

function compareFormulaRecords(left: MetradoFormulaRecord, right: MetradoFormulaRecord): number {
  return `${left.category ?? ""}${left.label}`.localeCompare(`${right.category ?? ""}${right.label}`);
}

function extractRowsArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value) && value.every(isRecord)) {
    return value;
  }

  if (isRecord(value) && Array.isArray(value.rows) && value.rows.every(isRecord)) {
    return value.rows;
  }

  throw new Error("El archivo debe contener filas JSON.");
}

function getChildControlId(children: ReactNode): string | undefined {
  if (typeof children !== "object" || children === null || !("props" in children)) {
    return undefined;
  }

  const props = children.props as { id?: unknown };
  return typeof props.id === "string" ? props.id : undefined;
}

function hasStringProperty<TProperty extends string>(
  value: object,
  property: TProperty,
): value is Record<TProperty, string> {
  return property in value && typeof (value as Record<TProperty, unknown>)[property] === "string";
}

function hasCellValueProperty<TProperty extends string>(
  value: object,
  property: TProperty,
): value is Record<TProperty, CellValue> {
  return property in value;
}

function hasRichText(value: object): value is { richText: Array<{ text: string }> } {
  if (!("richText" in value) || !Array.isArray(value.richText)) {
    return false;
  }

  return value.richText.every((item) => isRecord(item) && typeof item.text === "string");
}

function isExcelFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".xlsx") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

function isEmptyImportRecord(record: Record<string, unknown>): boolean {
  return Object.values(record).every(
    (value) => value === null || value === undefined || String(value).trim() === "",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeIssues<TIssue extends { id: string }>(issues: TIssue[]): TIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (seen.has(issue.id)) {
      return false;
    }
    seen.add(issue.id);
    return true;
  });
}
