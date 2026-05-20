import type { BudgetItemRecord, BudgetLevelType } from "@/types/budget";
import type { CatalogPartidaRecord } from "@/types/partida";
import {
  suggestPartidaMatches,
  type BudgetPasteMatchKind,
  type BudgetPasteSuggestedMatch,
} from "@/lib/budgets/sub-budget-partida-suggestions";

export type BudgetPasteEditableColumn = "code" | "description" | "unit" | "quantity";
export type BudgetPasteMode = "flat" | "structured-by-code" | "structured-by-indent";
export type BudgetPasteApplyMode = "insert-below" | "replace-current" | "insert-inside-level";
export type BudgetPasteTargetKind = "item" | "level";
export type BudgetPasteItemRow = Partial<Pick<BudgetItemRecord, BudgetPasteEditableColumn>>;
export type BudgetPasteIssue = {
  severity: "error" | "warning";
  rowIndex: number;
  message: string;
};
export type BudgetPasteStructuredEntry =
  | { kind: "level"; code?: string; name: string; depth: number; levelType?: BudgetLevelType; sourceRowIndex: number }
  | { kind: "item"; values: BudgetPasteItemRow; parentDepth: number; sourceRowIndex: number };
export type GuidedBudgetPaste = {
  detectedMode: BudgetPasteMode;
  selectedMode: BudgetPasteMode;
  applyMode: BudgetPasteApplyMode;
  targetKind: BudgetPasteTargetKind;
  rows: BudgetPasteItemRow[];
  entries: BudgetPasteStructuredEntry[];
  importedItems: number;
  importedLevels: number;
  issues: BudgetPasteIssue[];
  hasErrors: boolean;
};
export type GuidedBudgetPasteItemMatch = {
  rowIndex?: number;
  entryIndex?: number;
  sourceRowIndex: number;
  values: BudgetPasteItemRow;
  match: {
    matchKind: BudgetPasteMatchKind;
    exactMatch: CatalogPartidaRecord | null;
    bestSuggestion: CatalogPartidaRecord | null;
    suggestions: BudgetPasteSuggestedMatch[];
  };
};
export type GuidedBudgetPasteWithSuggestions = GuidedBudgetPaste & {
  itemMatches: GuidedBudgetPasteItemMatch[];
};

type ParsedClipboardRow = {
  code?: string;
  description?: string;
  rawDescription?: string;
  unit?: string;
  quantity?: number;
  rawQuantity?: string;
  quantityIsInvalid?: boolean;
};

type ClipboardHeaderMap = Partial<Record<BudgetPasteEditableColumn, number>>;

export function createGuidedBudgetPaste({
  rawText,
  startColumn,
  targetKind,
  selectedMode,
  applyMode,
}: {
  rawText: string;
  startColumn: BudgetPasteEditableColumn;
  targetKind: BudgetPasteTargetKind;
  selectedMode?: BudgetPasteMode;
  applyMode: BudgetPasteApplyMode;
}): GuidedBudgetPaste {
  const rawRows = rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => trimTrailingEmptyCells(line.split("\t")));

  const emptyResult = buildResult({
    detectedMode: "flat",
    selectedMode: selectedMode ?? "flat",
    applyMode,
    targetKind,
    rows: [],
    entries: [],
    issues: [{ severity: "error", rowIndex: 0, message: "No se encontraron filas validas para importar." }],
  });

  if (rawRows.length === 0) return emptyResult;
  if (rawRows.length === 1 && rawRows[0]?.length === 1) return emptyResult;

  const headerIndex = rawRows.findIndex((cells) => detectClipboardHeaderMap(cells) !== null);
  const headerMap = headerIndex >= 0 ? detectClipboardHeaderMap(rawRows[headerIndex] ?? []) : null;
  const candidateRows = rawRows
    .map((cells, index) => {
      if (headerMap && index > headerIndex) {
        return mapClipboardRowWithHeaderMap(cells, headerMap);
      }

      return mapClipboardRow(cells, startColumn);
    })
    .filter((row): row is ParsedClipboardRow => row !== null);

  const dataStartIndex = candidateRows.findIndex((row) => isClipboardHeaderRowNormalized(row) || isLikelyBudgetDataRow(row));
  const parsedRows = (dataStartIndex >= 0 ? candidateRows.slice(dataStartIndex) : candidateRows).filter(
    (row) => !isClipboardHeaderRowNormalized(row) && !isClipboardPreambleRowNormalized(row),
  );

  if (parsedRows.length === 0) return emptyResult;

  const detectedMode = detectBudgetPasteMode(parsedRows, startColumn);
  const nextSelectedMode = selectedMode ?? detectedMode;

  if (nextSelectedMode === "flat") {
    const { rows, issues } = createFlatRows(parsedRows);
    return buildResult({
      detectedMode,
      selectedMode: nextSelectedMode,
      applyMode,
      targetKind,
      rows,
      entries: [],
      issues,
    });
  }

  const { entries, issues } = createStructuredEntries(parsedRows, nextSelectedMode);
  return buildResult({
    detectedMode,
    selectedMode: nextSelectedMode,
    applyMode,
    targetKind,
    rows: [],
    entries,
    issues,
  });
}

function buildResult({
  detectedMode,
  selectedMode,
  applyMode,
  targetKind,
  rows,
  entries,
  issues,
}: {
  detectedMode: BudgetPasteMode;
  selectedMode: BudgetPasteMode;
  applyMode: BudgetPasteApplyMode;
  targetKind: BudgetPasteTargetKind;
  rows: BudgetPasteItemRow[];
  entries: BudgetPasteStructuredEntry[];
  issues: BudgetPasteIssue[];
}) {
  const importedLevels = entries.filter((entry) => entry.kind === "level").length;
  const importedItems = selectedMode === "flat" ? rows.length : entries.filter((entry) => entry.kind === "item").length;

  return {
    detectedMode,
    selectedMode,
    applyMode,
    targetKind,
    rows,
    entries,
    importedItems,
    importedLevels,
    issues,
    hasErrors: issues.some((issue) => issue.severity === "error"),
  } satisfies GuidedBudgetPaste;
}

function createFlatRows(parsedRows: ParsedClipboardRow[]) {
  const rows: BudgetPasteItemRow[] = [];
  const issues: BudgetPasteIssue[] = [];

  parsedRows.forEach((row, rowIndex) => {
    const mapped = toPastedItemRow(row);
    const rowIssues = collectItemIssues(row, rowIndex);
    issues.push(...rowIssues);

    if (Object.keys(mapped).length === 0) return;
    rows.push(mapped);
  });

  return { rows, issues };
}

function createStructuredEntries(parsedRows: ParsedClipboardRow[], selectedMode: BudgetPasteMode) {
  const entries: BudgetPasteStructuredEntry[] = [];
  const issues: BudgetPasteIssue[] = [];
  let currentLevelDepth = 0;
  let lastLevelDepth = -1;

  parsedRows.forEach((row, rowIndex) => {
    const looksLevel = selectedMode === "structured-by-code" ? isCodeBasedLevelRow(row) : isIndentBasedLevelRow(row);

    if (looksLevel) {
      const indentPlacement =
        selectedMode === "structured-by-indent"
          ? inferIndentLevelPlacement(parsedRows, entries, row, rowIndex)
          : null;
      const depth =
        selectedMode === "structured-by-code"
          ? inferCodeDepth(row.code ?? "")
          : (indentPlacement?.depth ?? inferIndentDepth(row.rawDescription ?? ""));

      if (depth > lastLevelDepth + 1) {
        issues.push({
          severity: "error",
          rowIndex,
          message: "La jerarquia salta niveles y no puede importarse con seguridad.",
        });
      }

      entries.push({
        kind: "level",
        code: row.code?.trim(),
        name: row.description?.trim() ?? "Nuevo nivel",
        depth,
        levelType:
          selectedMode === "structured-by-code"
            ? inferLevelTypeFromCodeDepth(depth)
            : (indentPlacement?.levelType ?? undefined),
        sourceRowIndex: rowIndex,
      });
      currentLevelDepth = depth;
      lastLevelDepth = depth;
      return;
    }

    const itemValues = toPastedItemRow(row);
    const rowIssues = collectItemIssues(row, rowIndex);
    issues.push(...rowIssues);

    if (selectedMode === "structured-by-indent" && !row.code?.trim()) {
      issues.push({
        severity: "warning",
        rowIndex,
        message: "La fila no tiene codigo y se interpretara por indentacion.",
      });
    }

    if (Object.keys(itemValues).length === 0) {
      issues.push({
        severity: "error",
        rowIndex,
        message: "La fila no tiene datos suficientes para interpretarse como partida.",
      });
      return;
    }

    const parentDepth =
      selectedMode === "structured-by-code"
        ? inferItemParentDepthFromCode(row.code ?? "", currentLevelDepth)
        : inferItemParentDepthFromIndent(row.rawDescription ?? "", currentLevelDepth);

    entries.push({
      kind: "item",
      values: itemValues,
      parentDepth,
      sourceRowIndex: rowIndex,
    });
  });

  return { entries, issues };
}

export function attachPartidaSuggestionsToGuidedPaste(
  guidedPaste: GuidedBudgetPaste,
  catalog: CatalogPartidaRecord[],
): GuidedBudgetPasteWithSuggestions {
  if (catalog.length === 0) {
    return {
      ...guidedPaste,
      itemMatches: [],
    };
  }

  if (guidedPaste.selectedMode === "flat") {
    return {
      ...guidedPaste,
      itemMatches: guidedPaste.rows.map((row, rowIndex) => ({
        rowIndex,
        sourceRowIndex: rowIndex,
        values: row,
        match: suggestPartidaMatches({
          item: {
            code: row.code ?? "",
            description: row.description ?? "",
            unit: row.unit ?? "",
          },
          catalog,
          limit: 3,
        }),
      })),
    };
  }

  const itemMatches = guidedPaste.entries.flatMap((entry, entryIndex) => {
    if (entry.kind !== "item") return [];

    const itemMatch: GuidedBudgetPasteItemMatch = {
      entryIndex,
      sourceRowIndex: entry.sourceRowIndex,
      values: entry.values,
      match: suggestPartidaMatches({
        item: {
          code: entry.values.code ?? "",
          description: entry.values.description ?? "",
          unit: entry.values.unit ?? "",
        },
        catalog,
        limit: 3,
      }),
    };

    return [itemMatch];
  });

  return {
    ...guidedPaste,
    itemMatches,
  };
}

function collectItemIssues(row: ParsedClipboardRow, rowIndex: number) {
  const issues: BudgetPasteIssue[] = [];
  const description = row.description?.trim() ?? "";
  const hasUsefulData = Boolean(row.code?.trim() || description || row.unit?.trim() || row.rawQuantity?.trim());

  if (!hasUsefulData) {
    issues.push({
      severity: "error",
      rowIndex,
      message: "La fila esta vacia o no tiene datos utiles.",
    });
  }

  if (description && !row.unit?.trim() && (row.rawQuantity?.trim() || row.code?.trim())) {
    issues.push({
      severity: "warning",
      rowIndex,
      message: "La fila parece una partida pero no tiene unidad.",
    });
  }

  if (row.quantityIsInvalid) {
    issues.push({
      severity: "error",
      rowIndex,
      message: "La fila tiene un metrado invalido y no puede importarse.",
    });
  }

  return issues;
}

function detectBudgetPasteMode(parsedRows: ParsedClipboardRow[], startColumn: BudgetPasteEditableColumn): BudgetPasteMode {
  const codeSignals = parsedRows.filter((row) => isCodeBasedLevelRow(row)).length;
  const indentSignals = parsedRows.filter((row) => isIndentBasedLevelRow(row)).length;
  const hasStructuredSignals = startColumn !== "unit" && startColumn !== "quantity" && (codeSignals > 0 || indentSignals > 0);

  if (!hasStructuredSignals) return "flat";
  if (codeSignals >= indentSignals) return "structured-by-code";
  return "structured-by-indent";
}

function mapClipboardRow(cells: string[], startColumn: BudgetPasteEditableColumn): ParsedClipboardRow | null {
  const editableColumnOrder: BudgetPasteEditableColumn[] = ["code", "description", "unit", "quantity"];
  const normalizedStartColumn = shouldTreatClipboardRowAsCodeAligned(cells, startColumn) ? "code" : startColumn;
  const startIndex = editableColumnOrder.indexOf(normalizedStartColumn);
  if (startIndex === -1) return null;

  const row: ParsedClipboardRow = {};

  cells.forEach((cell, cellIndex) => {
    const column = editableColumnOrder[startIndex + cellIndex];
    if (!column) return;

    if (column === "description") {
      row.rawDescription = cell;
      row.description = cell.trim();
      return;
    }

    if (column === "quantity") {
      row.rawQuantity = cell;
      const parsed = parseSpreadsheetNumber(cell);
      row.quantity = parsed.value;
      row.quantityIsInvalid = parsed.isInvalid;
      return;
    }

    row[column] = cell.trim();
  });

  return Object.values(row).some((value) => value !== undefined && value !== "") ? row : null;
}

function shouldTreatClipboardRowAsCodeAligned(cells: string[], startColumn: BudgetPasteEditableColumn) {
  if (startColumn === "code") return false;
  if (cells.length < 2) return false;

  const [firstCell, secondCell] = cells;
  const normalizedCode = firstCell?.trim() ?? "";
  const normalizedDescription = secondCell?.trim() ?? "";

  if (!normalizedCode || !normalizedDescription) return false;

  return looksLikeSpreadsheetCodeValue(normalizedCode);
}

function mapClipboardRowWithHeaderMap(cells: string[], headerMap: ClipboardHeaderMap): ParsedClipboardRow | null {
  const row: ParsedClipboardRow = {};

  if (headerMap.code !== undefined) {
    row.code = cells[headerMap.code]?.trim();
  }

  if (headerMap.description !== undefined) {
    const description = cells[headerMap.description] ?? "";
    row.rawDescription = description;
    row.description = description.trim();
  }

  if (headerMap.unit !== undefined) {
    row.unit = cells[headerMap.unit]?.trim();
  }

  if (headerMap.quantity !== undefined) {
    const quantity = cells[headerMap.quantity] ?? "";
    const parsed = parseSpreadsheetNumber(quantity);
    row.rawQuantity = quantity;
    row.quantity = parsed.value;
    row.quantityIsInvalid = parsed.isInvalid;
  }

  return Object.values(row).some((value) => value !== undefined && value !== "") ? row : null;
}

function detectClipboardHeaderMap(cells: string[]): ClipboardHeaderMap | null {
  const headerMap: ClipboardHeaderMap = {};

  cells.forEach((cell, index) => {
    const token = normalizeSpreadsheetText(cell);
    if (!token) return;

    if (isCodeHeaderToken(token)) {
      headerMap.code ??= index;
      return;
    }

    if (isDescriptionHeaderToken(token)) {
      headerMap.description ??= index;
      return;
    }

    if (isUnitHeaderToken(token)) {
      headerMap.unit ??= index;
      return;
    }

    if (isQuantityHeaderToken(token)) {
      headerMap.quantity ??= index;
    }
  });

  return headerMap.description !== undefined && (headerMap.quantity !== undefined || headerMap.code !== undefined) ? headerMap : null;
}

function isClipboardHeaderRowNormalized(row: ParsedClipboardRow) {
  const code = normalizeSpreadsheetText(row.code ?? "");
  const description = normalizeSpreadsheetText(row.description ?? "");
  const unit = normalizeSpreadsheetText(row.unit ?? "");
  const quantity = normalizeSpreadsheetText(row.rawQuantity ?? "");

  return isCodeHeaderToken(code) && isDescriptionHeaderToken(description) && isUnitHeaderToken(unit) && isQuantityHeaderToken(quantity);
}

function isClipboardPreambleRowNormalized(row: ParsedClipboardRow) {
  const code = normalizeSpreadsheetText(row.code ?? "");
  const description = normalizeSpreadsheetText(row.description ?? "");
  const combined = [code, description].filter(Boolean).join(" ").trim();

  if (!combined) return true;

  return /^(presupuesto|presupuesto desagregado|proyecto:?|cliente:?|ubicacion:?|fecha base:?|moneda:?|subpresupuesto:?|especialidad:?|item:?|pagina:?|hoja:?)/.test(combined);
}

function isLikelyBudgetDataRow(row: ParsedClipboardRow) {
  if (isHierarchyCode(row.code ?? "")) return true;
  if (row.unit?.trim() && row.rawQuantity?.trim()) return true;
  if (row.description?.trim() && row.rawQuantity?.trim()) return true;
  return isIndentBasedLevelRow(row);
}

function isCodeBasedLevelRow(row: ParsedClipboardRow) {
  const description = row.description?.trim();
  if (!description) return false;
  if (row.unit?.trim() || row.rawQuantity?.trim()) return false;
  if (isClipboardPreambleRowNormalized(row)) return false;
  return Boolean(row.code && isHierarchyCode(row.code));
}

function isIndentBasedLevelRow(row: ParsedClipboardRow) {
  const description = row.description?.trim();
  if (!description) return false;

  const hasUnit = Boolean(row.unit?.trim());
  const hasQuantity = Boolean(row.rawQuantity?.trim());
  if (hasUnit || hasQuantity) return false;
  if (isClipboardPreambleRowNormalized(row)) return false;

  const leadingSpaces = getLeadingSpaces(row.rawDescription ?? "");
  return looksLikeLevelDescription(description, leadingSpaces);
}

function isImplicitTextLevelRow(row: ParsedClipboardRow) {
  if (row.code?.trim()) return false;
  if (row.unit?.trim() || row.rawQuantity?.trim()) return false;
  return isIndentBasedLevelRow(row);
}

function inferCodeDepth(code: string) {
  return Math.max(0, code.trim().split(".").length - 1);
}

function inferIndentDepth(rawDescription: string) {
  return Math.max(0, Math.floor(getLeadingSpaces(rawDescription) / 2));
}

function inferItemParentDepthFromCode(code: string, fallbackDepth: number) {
  if (isHierarchyCode(code)) {
    return Math.max(0, code.trim().split(".").length - 2);
  }

  return fallbackDepth;
}

function inferItemParentDepthFromIndent(rawDescription: string, fallbackDepth: number) {
  const indentDepth = Math.max(0, Math.floor(getLeadingSpaces(rawDescription) / 2) - 1);
  return Math.max(indentDepth, fallbackDepth);
}

function inferIndentLevelPlacement(
  parsedRows: ParsedClipboardRow[],
  existingEntries: BudgetPasteStructuredEntry[],
  row: ParsedClipboardRow,
  rowIndex: number,
) {
  const explicitDepth = inferIndentDepth(row.rawDescription ?? "");
  if (explicitDepth > 0) {
    return {
      depth: explicitDepth,
      levelType: inferLevelTypeFromCodeDepth(explicitDepth),
    };
  }

  const previousEntry = existingEntries.at(-1) ?? null;
  const nextRow = parsedRows[rowIndex + 1] ?? null;
  const nextStartsImplicitPair = nextRow ? isImplicitTextLevelRow(nextRow) : false;

  if (!previousEntry) {
    return {
      depth: 0,
      levelType: "TITLE" as const,
    };
  }

  if (previousEntry.kind === "level") {
    if (previousEntry.depth === 0) {
      return {
        depth: 1,
        levelType: "SUBTITLE" as const,
      };
    }

    return {
      depth: nextStartsImplicitPair ? 0 : 1,
      levelType: nextStartsImplicitPair ? ("TITLE" as const) : ("SUBTITLE" as const),
    };
  }

  return {
    depth: 0,
    levelType: "TITLE" as const,
  };
}

function inferLevelTypeFromCodeDepth(depth: number): BudgetLevelType {
  if (depth <= 0) return "TITLE";
  if (depth === 1) return "SUBTITLE";
  return "ITEM_GROUP";
}

function toPastedItemRow(row: ParsedClipboardRow): BudgetPasteItemRow {
  const item: BudgetPasteItemRow = {};

  if (row.code?.trim()) item.code = row.code.trim();
  if (row.description?.trim()) item.description = row.description.trim();
  if (row.unit?.trim()) item.unit = row.unit.trim();
  if (row.rawQuantity?.trim() && !row.quantityIsInvalid) item.quantity = row.quantity ?? 0;

  return item;
}

function trimTrailingEmptyCells(cells: string[]) {
  const nextCells = [...cells];

  while (nextCells.length > 0 && nextCells[nextCells.length - 1]?.trim() === "") {
    nextCells.pop();
  }

  return nextCells;
}

function normalizeSpreadsheetText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isCodeHeaderToken(token: string) {
  return token === "item" || token === "codigo" || token === "cod." || token === "cod" || token === "codigo item";
}

function isDescriptionHeaderToken(token: string) {
  return token === "partida" || token === "descripcion" || token === "detalle" || token === "subpartida";
}

function isUnitHeaderToken(token: string) {
  return token === "unidad" || token === "und" || token === "u.m." || token === "um" || token === "u";
}

function isQuantityHeaderToken(token: string) {
  return token === "metrado" || token === "cantidad" || token === "cant." || token === "cant" || token === "metr";
}

function parseSpreadsheetNumber(value: string) {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return { value: 0, isInvalid: false };

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");
  let normalized = trimmed;

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = trimmed.replaceAll(thousandsSeparator, "").replace(decimalSeparator, ".");
  } else if (lastComma !== -1) {
    normalized = trimmed.replaceAll(".", "").replace(",", ".");
  } else {
    normalized = trimmed.replaceAll(",", "");
  }

  if (!/^-?\d*(?:\.\d+)?$/.test(normalized)) {
    return { value: 0, isInvalid: true };
  }

  const nextValue = Number(normalized);
  return Number.isFinite(nextValue) ? { value: nextValue, isInvalid: false } : { value: 0, isInvalid: true };
}

function isHierarchyCode(value: string) {
  return /^\d+(?:\.\d+)*$/.test(value.trim());
}

function looksLikeSpreadsheetCodeValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isHierarchyCode(trimmed)) return true;
  return /^[A-Za-z]{1,6}-?\d+(?:[.\-][A-Za-z0-9]+)*$/.test(trimmed);
}

function getLeadingSpaces(value: string) {
  const match = value.match(/^\s+/);
  return match?.[0].length ?? 0;
}

function looksLikeLevelDescription(description: string, leadingSpaces: number) {
  const normalized = description.trim();
  if (!normalized) return false;

  const isUppercase = normalized === normalized.toUpperCase();
  const endsWithColon = normalized.endsWith(":");
  const isShortLabel = normalized.split(" ").length <= 6;

  return (leadingSpaces === 0 && isUppercase) || (leadingSpaces <= 2 && endsWithColon) || (leadingSpaces <= 2 && isShortLabel && isUppercase);
}
