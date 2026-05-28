"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CellValue, Worksheet } from "exceljs";
import { Calculator, FileSpreadsheet, Plus } from "lucide-react";

import {
  addMetradoRow,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { calculateMetradoSheet } from "@/lib/calculations/metrados";
import { metradoTemplates } from "@/lib/metrados/templates";
import { validateMetradoSheet } from "@/lib/metrados/validation";
import { cn } from "@/lib/utils";
import type {
  MetradoFormulaInputKey,
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

type MetradosDashboardProps = {
  initialSheets: MetradoSheetRecord[];
  projects: MetradoProjectOption[];
  budgets: MetradoBudgetOption[];
  partidas: MetradoPartidaOption[];
};

type ImportPreviewResponse = {
  rows: MetradoRowRecord[];
  issues: Array<{ id: string; severity: "error" | "warning"; rowId?: string; field?: string; message: string }>;
};

type SheetResponse = {
  sheet: MetradoSheetRecord;
};

const units = ["m", "m2", "m3", "kg", "und", "glb"] as const satisfies MetradoUnit[];

export function MetradosDashboard({
  initialSheets,
  projects,
  budgets,
  partidas,
}: MetradosDashboardProps) {
  const [sheets, setSheets] = useState<MetradoSheetRecord[]>(initialSheets);
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
  const [activeCell, setActiveCell] = useState<MetradoActiveCell | null>(null);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const template = useMemo(
    () => metradoTemplates.find((entry) => entry.type === templateType) ?? metradoTemplates[0],
    [templateType],
  );
  const calculated = useMemo(() => calculateMetradoSheet({ unit: sheetUnit, rows }), [rows, sheetUnit]);
  const selectedPartida = partidas.find((partida) => partida.id === partidaId) ?? null;
  const validationIssues = useMemo(
    () =>
      validateMetradoSheet({
        sheetUnit,
        templateFormulaKeys: template.formulaKeys,
        linkedPartidaUnit: selectedSheet?.partidaLink?.budgetItemUnit ?? selectedPartida?.unit ?? null,
        rows: calculated.rows,
      }),
    [
      calculated.rows,
      selectedPartida?.unit,
      selectedSheet?.partidaLink?.budgetItemUnit,
      sheetUnit,
      template.formulaKeys,
    ],
  );
  const issues = useMemo(
    () => mergeIssues([...calculated.issues, ...validationIssues]),
    [calculated.issues, validationIssues],
  );
  const hasBlockingIssues = issues.some((issue) => issue.severity === "error");
  const filteredBudgets = budgets.filter((budget) => budget.projectId === projectId);
  const filteredPartidas = partidas.filter((partida) => partida.budgetId === budgetId);
  const activeRow = calculated.rows.find((row) => row.id === activeCell?.rowId) ?? calculated.rows[0] ?? null;
  const activeFormula =
    template.formulas.find((formula) => formula.key === activeRow?.formulaKey) ?? template.formulas[0] ?? null;
  const exportHref = selectedSheet ? `/api/metrados-avanzados/${selectedSheet.id}/export` : null;
  const persistedSheetSelected = Boolean(selectedSheet);

  function selectSheet(sheetId: string) {
    const nextSheet = sheets.find((sheet) => sheet.id === sheetId) ?? null;
    setSelectedSheetId(sheetId);
    if (!nextSheet) {
      setRows([]);
      setActiveCell(null);
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
    setActiveCell(null);
    setFeedback("");
    setError("");
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

  async function saveDraft() {
    if (!selectedSheet) {
      if (!projectId || !budgetId || !partidaId) {
        setError("Selecciona proyecto, presupuesto y partida.");
        return;
      }

      await runAction(async () => {
        const draftRows = calculated.rows;
        const sheet = await createSheetRecord();
        selectCreatedSheet(sheet, draftRows);
        await persistDraft(sheet.id, draftRows);
        setFeedback("Borrador guardado.");
      }, "No se pudo guardar el borrador.");
      return;
    }

    await runAction(async () => {
      await persistDraft(selectedSheet.id, calculated.rows);
      setFeedback("Borrador guardado.");
    }, "No se pudo guardar el borrador.");
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

  async function persistDraft(sheetId: string, draftRows: MetradoRowRecord[]) {
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
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-sky-700">
            <FileSpreadsheet className="h-4 w-4" />
            Metrados avanzados
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Quantity takeoff</h1>
        </div>
        <MetradoExportActions
          exportHref={exportHref}
          actionState={actionState}
          canSave={!hasBlockingIssues || rows.length === 0}
          canSend={Boolean(selectedSheet) && !hasBlockingIssues}
          canImport={Boolean(selectedSheet)}
          onSaveDraft={saveDraft}
          onImportFile={importRows}
          onSendToPartida={sendToPartida}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4 text-sky-600" />
            Configuracion
          </CardTitle>
          <Button size="sm" onClick={createSheet}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Field label="Hoja">
              <Select
                id="metrado-sheet-select"
                value={selectedSheetId}
                onChange={(event) => selectSheet(event.currentTarget.value)}
              >
                <option value="">Nueva hoja</option>
                {sheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Proyecto">
              <Select
                id="metrado-project-select"
                value={projectId}
                disabled={persistedSheetSelected}
                onChange={(event) => {
                  const nextProjectId = event.currentTarget.value;
                  const nextBudgetId = budgets.find((budget) => budget.projectId === nextProjectId)?.id ?? "";
                  setProjectId(nextProjectId);
                  setBudgetId(nextBudgetId);
                  setPartidaId(partidas.find((partida) => partida.budgetId === nextBudgetId)?.id ?? "");
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
                  setBudgetId(nextBudgetId);
                  setPartidaId(partidas.find((partida) => partida.budgetId === nextBudgetId)?.id ?? "");
                }}
              >
                {filteredBudgets.map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Partida">
              <Select
                id="metrado-partida-select"
                value={partidaId}
                disabled={persistedSheetSelected}
                onChange={(event) => setPartidaId(event.currentTarget.value)}
              >
                {filteredPartidas.map((partida) => (
                  <option key={partida.id} value={partida.id}>
                    {partida.code} - {partida.unit}
                  </option>
                ))}
              </Select>
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
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,360px)]">
            <Field label="Nombre">
              <Input
                id="metrado-name-input"
                value={sheetName}
                onChange={(event) => setSheetName(event.currentTarget.value)}
              />
            </Field>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="block truncate font-medium text-slate-900">
                {selectedPartida ? `${selectedPartida.code} ${selectedPartida.description}` : "Sin partida"}
              </span>
              <span className="text-xs">Vinculo: {selectedPartida?.unit ?? "-"}</span>
            </div>
          </div>
          <MetradoTemplateSelector
            templates={metradoTemplates}
            value={templateType}
            disabled={Boolean(selectedSheet)}
            onChange={(nextTemplateType) => {
              setTemplateType(nextTemplateType);
              const nextTemplate = metradoTemplates.find((entry) => entry.type === nextTemplateType);
              if (nextTemplate) {
                setSheetUnit(nextTemplate.defaultUnit);
              }
            }}
          />
        </CardContent>
      </Card>

      <MetradoFormulaBar activeRow={activeRow} formula={activeFormula} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <MetradoSheetTable
          rows={calculated.rows}
          formulaKeys={template.formulaKeys}
          activeCell={activeCell}
          onActiveCellChange={setActiveCell}
          onAddRow={() =>
            setRows((current) =>
              addMetradoRow(current, selectedSheet?.id ?? "draft-metrado", sheetUnit, template.formulaKeys[0] ?? "manual"),
            )
          }
          onDuplicateRow={(rowId) => setRows((current) => duplicateMetradoRow(current, rowId))}
          onDeleteRow={(rowId) => setRows((current) => deleteMetradoRow(current, rowId))}
          onPatchRow={patchRow}
          onInputChange={updateInput}
        />
        <aside className="space-y-4">
          <MetradoSummaryPanel calculation={calculated} linkedPartida={selectedSheet?.partidaLink ?? null} unit={sheetUnit} />
          <MetradoValidationPanel issues={issues} />
          <StatusMessage state={actionState} feedback={feedback} error={error} />
        </aside>
      </div>
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
