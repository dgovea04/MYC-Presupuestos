"use client";

import * as Dialog from "@radix-ui/react-dialog";
import dynamic from "next/dynamic";
import Link from "next/link";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ChevronLeft, ChevronRight, ExternalLink, GripVertical, MoreHorizontal, Plus, Rows3, Type } from "lucide-react";
import { buildDisplayRows, levelTypeLabel, type BudgetDisplayRow } from "@/lib/budget/structure";
import {
  attachPartidaSuggestionsToGuidedPaste,
  createGuidedBudgetPaste,
  type BudgetPasteApplyMode,
  type BudgetPasteMode,
  type BudgetPasteStructuredEntry,
  type GuidedBudgetPaste,
  type GuidedBudgetPasteWithSuggestions,
} from "@/lib/budgets/paste-import";
import { applyCatalogPartidaToDraftItem, resolveCatalogResource } from "@/lib/budgets/catalog-partida-application";
import { calculateBudgetQualitySummary, type BudgetItemQualityState, type BudgetQualitySummary } from "@/lib/budgets/budget-quality";
import { broadcastAppDataChange } from "@/lib/client/live-updates";
import { calculateBudgetRecord } from "@/lib/calculations/budget";
import { useVirtualTableWindow } from "@/hooks/use-virtual-table-window";
import { cn } from "@/lib/utils";
import { useBudgetViewMode } from "@/components/budget/view-mode-provider";
import { ViewModeToggle } from "@/components/budget/view-mode-toggle";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { BudgetLevelRecord, BudgetLevelType, BudgetRecord, BudgetItemRecord, BudgetStatePatch, BudgetTotals } from "@/types/budget";
import type { ResourceRecord } from "@/types/resource";
import { AnimatedCurrencyValue } from "@/components/ui/animated-currency-value";
import { BufferedInput } from "@/components/ui/buffered-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SaveStateBadge } from "@/components/ui/save-state-badge";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { CellValue } from "exceljs";
import type { BudgetPasteSuggestedMatch } from "@/lib/budgets/sub-budget-partida-suggestions";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type DragState = { kind: "level" | "item"; id: string } | null;
type DensityMode = "compact" | "comfortable";
type ActiveColumn = "code" | "description" | "unit" | "quantity" | "unitPrice" | "partial" | "actions" | null;
type EditableColumn = "code" | "description" | "unit" | "quantity";
type EditableCell = { rowId: string; column: EditableColumn };
type PastedItemRow = Partial<Pick<BudgetItemRecord, EditableColumn>>;
type PendingPaste = {
  rawText: string;
  guidedPaste: GuidedBudgetPasteWithSuggestions;
  rowResolutions: PendingPasteRowResolution[];
  targetRow: BudgetDisplayRow;
  startColumn: EditableColumn;
  source: "inline-paste" | "excel-import";
};
type PendingPasteRowResolution = {
  sourceRowIndex: number;
  selectedPartidaId: string | null;
};
type PendingPasteItemMatchPresentation = {
  matchKind: "exact" | "suggested" | "unresolved";
  exactMatch: CatalogPartidaRecord | null;
  bestSuggestion: CatalogPartidaRecord | null;
  suggestions: BudgetPasteSuggestedMatch[];
  isSuggestionApplied: boolean;
};
type PastePreviewRow = {
  kind: "level" | "item";
  description: string;
  code?: string;
  unit?: string;
  quantity?: string;
  depth: number;
  levelType?: string;
  entryIndex?: number;
  itemMatch?: PendingPasteItemMatchPresentation | null;
  sourceRowIndex: number;
};
type CatalogMenuState = {
  rowId: string;
  top: number;
  left: number;
  width: number;
};
type LevelActionMenuState = {
  rowId: string;
  kind: "add" | "more";
  top: number;
  left: number;
  trigger: HTMLElement | null;
};
type ItemActionMenuState = {
  rowId: string;
  top: number;
  left: number;
  trigger: HTMLElement | null;
};
type HeaderActionMenuState = {
  kind: "add" | "more";
  top: number;
  left: number;
  trigger: HTMLElement | null;
};
type FixedMenuSize = {
  width: number;
  height: number;
};
type InsertTarget = {
  kind: "level" | "item";
  id: string;
};
type ItemInsertion = {
  levelId: string | null;
  afterItemId: string | null;
};
type LevelInsertion = {
  parentId: string | null;
  afterLevelId: string | null;
};
type ApuSheetSession = {
  item: BudgetItemRecord;
  restoreFocusElement: HTMLElement | null;
};

const editableColumnOrder: EditableColumn[] = ["code", "description", "unit", "quantity"];
const pasteModeLabel: Record<BudgetPasteMode, string> = {
  flat: "Plano",
  "structured-by-code": "Jerárquico por código",
  "structured-by-indent": "Jerárquico por indentación",
};
const ApuEditorSheet = dynamic(() =>
  import("@/components/apu/apu-editor-sheet").then((module) => module.ApuEditorSheet),
);
const BUDGET_ROW_OVERSCAN = 10;
const BUDGET_TABLE_COLUMN_COUNT = 7;
const ACTION_MENU_OFFSET = 6;
const ACTION_MENU_VIEWPORT_PADDING = 12;
const LEVEL_ACTION_MENU_WIDTH = 192;
const ITEM_ACTION_MENU_WIDTH = 192;
const HEADER_ACTION_MENU_WIDTH = 208;
const LEVEL_ADD_MENU_ESTIMATED_HEIGHT = 152;
const LEVEL_MORE_MENU_ESTIMATED_HEIGHT = 336;
const ITEM_ACTION_MENU_ESTIMATED_HEIGHT = 146;
const HEADER_ADD_MENU_ESTIMATED_HEIGHT = 216;
const HEADER_MORE_MENU_ESTIMATED_HEIGHT = 112;
const EMPTY_CATALOG_SUGGESTIONS: CatalogPartidaRecord[] = [];

function getFixedMenuPosition(triggerRect: DOMRect, menuSize: FixedMenuSize) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = Math.max(ACTION_MENU_VIEWPORT_PADDING, viewportWidth - menuSize.width - ACTION_MENU_VIEWPORT_PADDING);
  const maxTop = Math.max(ACTION_MENU_VIEWPORT_PADDING, viewportHeight - menuSize.height - ACTION_MENU_VIEWPORT_PADDING);
  const spaceBelow = viewportHeight - triggerRect.bottom - ACTION_MENU_OFFSET - ACTION_MENU_VIEWPORT_PADDING;
  const spaceAbove = triggerRect.top - ACTION_MENU_OFFSET - ACTION_MENU_VIEWPORT_PADDING;
  const shouldOpenUpwards = spaceBelow < menuSize.height && spaceAbove > spaceBelow;

  return {
    left: Math.min(Math.max(triggerRect.right - menuSize.width, ACTION_MENU_VIEWPORT_PADDING), maxLeft),
    top: shouldOpenUpwards
      ? Math.max(triggerRect.top - menuSize.height - ACTION_MENU_OFFSET, ACTION_MENU_VIEWPORT_PADDING)
      : Math.min(triggerRect.bottom + ACTION_MENU_OFFSET, maxTop),
  };
}

function subscribeWindowPositionUpdates(updatePosition: () => void) {
  let frame = 0;

  const scheduleUpdate = () => {
    if (frame !== 0) return;

    frame = window.requestAnimationFrame(() => {
      frame = 0;
      updatePosition();
    });
  };

  scheduleUpdate();
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("scroll", scheduleUpdate, true);

  return () => {
    if (frame !== 0) {
      window.cancelAnimationFrame(frame);
    }
    window.removeEventListener("resize", scheduleUpdate);
    window.removeEventListener("scroll", scheduleUpdate, true);
  };
}

export function BudgetEditor({
  budget,
  resourcesCatalog,
  partidasCatalog,
  projectName,
}: {
  budget: BudgetRecord;
  resourcesCatalog: ResourceRecord[];
  partidasCatalog: CatalogPartidaRecord[];
  projectName?: string;
}) {
  const router = useRouter();
  const { currencyDecimals, excelRowHeight } = useFormattingSettings();
  const { isExcelMode } = useBudgetViewMode();
  const [state, setState] = useState(() => calculateBudgetRecord(budget));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pasteFeedback, setPasteFeedback] = useState("");
  const [pendingPaste, setPendingPaste] = useState<PendingPaste | null>(null);
  const [itemQualityStateById, setItemQualityStateById] = useState<Record<string, BudgetItemQualityState | undefined>>({});
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dragState, setDragState] = useState<DragState>(null);
  const [densityMode, setDensityMode] = useState<DensityMode>("compact");
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<ActiveColumn>(null);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [catalogSelectorRowId, setCatalogSelectorRowId] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogHighlightedIndex, setCatalogHighlightedIndex] = useState(0);
  const [catalogMenu, setCatalogMenu] = useState<CatalogMenuState | null>(null);
  const [levelActionMenu, setLevelActionMenu] = useState<LevelActionMenuState | null>(null);
  const [itemActionMenu, setItemActionMenu] = useState<ItemActionMenuState | null>(null);
  const [headerActionMenu, setHeaderActionMenu] = useState<HeaderActionMenuState | null>(null);
  const [catalogInsertTarget, setCatalogInsertTarget] = useState<InsertTarget | null>(null);
  const [catalogInsertQuery, setCatalogInsertQuery] = useState("");
  const [catalogSelectedIds, setCatalogSelectedIds] = useState<string[]>([]);
  const [excelImportTarget, setExcelImportTarget] = useState<InsertTarget | null>(null);
  const [excelImportText, setExcelImportText] = useState("");
  const [excelImportFileName, setExcelImportFileName] = useState("");
  const [excelImportLoading, setExcelImportLoading] = useState(false);
  const [clearSubBudgetDialogOpen, setClearSubBudgetDialogOpen] = useState(false);
  const [apuSheetSession, setApuSheetSession] = useState<ApuSheetSession | null>(null);
  const deferredCatalogQuery = useDeferredValue(catalogQuery);
  const deferredCatalogInsertQuery = useDeferredValue(catalogInsertQuery);
  const indexedPartidasCatalog = useMemo(
    () =>
      partidasCatalog.map((partida) => ({
        partida,
        searchText: `${partida.description} ${partida.unit} ${partida.performanceRate ?? ""}`.toLowerCase(),
      })),
    [partidasCatalog],
  );
  const partidasById = useMemo(() => new Map(partidasCatalog.map((partida) => [partida.id, partida])), [partidasCatalog]);
  const resourcesById = useMemo(() => new Map(resourcesCatalog.map((resource) => [resource.id, resource])), [resourcesCatalog]);
  const resourcesByDescriptionUnit = useMemo(
    () =>
      new Map(
        resourcesCatalog.map((resource) => [
          `${normalizeLookupText(resource.description)}|${normalizeLookupText(resource.unit)}`,
          resource,
        ]),
      ),
    [resourcesCatalog],
  );

  const summary = useMemo(() => calculateBudgetRecord(state), [state]);
  const qualitySummary = useMemo(
    () => calculateBudgetQualitySummary(summary.items, itemQualityStateById),
    [itemQualityStateById, summary.items],
  );
  const rows = useMemo(() => buildDisplayRows(summary), [summary]);
  const rowNavigationLookup = useMemo(() => {
    const rowIdToIndex = new Map<string, number>();
    const rowIdToColumns = new Map<string, EditableColumn[]>();
    const orderedEditableCells: EditableCell[] = [];
    const editableCellIndexByKey = new Map<string, number>();

    rows.forEach((row, rowIndex) => {
      const rowId = getRowId(row);
      const columns = getEditableColumnsForRow(row);

      rowIdToIndex.set(rowId, rowIndex);
      rowIdToColumns.set(rowId, columns);

      columns.forEach((column) => {
        const nextCell = { rowId, column } satisfies EditableCell;
        editableCellIndexByKey.set(getCellKey(rowId, column), orderedEditableCells.length);
        orderedEditableCells.push(nextCell);
      });
    });

    return {
      rowIdToIndex,
      rowIdToColumns,
      orderedEditableCells,
      editableCellIndexByKey,
    };
  }, [rows]);
  const catalogSuggestions = useMemo(() => {
    if (!catalogSelectorRowId) return [];

    const normalizedQuery = deferredCatalogQuery.trim().toLowerCase() === "nueva partida" ? "" : deferredCatalogQuery.trim().toLowerCase();

    return indexedPartidasCatalog
      .filter(({ searchText }) => {
        if (!normalizedQuery) return true;
        return searchText.includes(normalizedQuery);
      })
      .map(({ partida }) => partida)
      .slice(0, 8);
  }, [catalogSelectorRowId, deferredCatalogQuery, indexedPartidasCatalog]);
  const isCatalogMenuOpen = Boolean(catalogSelectorRowId && catalogSuggestions.length > 0 && catalogMenu);
  const catalogInsertSuggestions = useMemo(() => {
    if (!catalogInsertTarget) return [];

    const query = deferredCatalogInsertQuery.trim().toLowerCase();
    return indexedPartidasCatalog
      .filter(({ searchText }) => {
        if (!query) return true;
        return searchText.includes(query);
      })
      .map(({ partida }) => partida)
      .slice(0, 40);
  }, [catalogInsertTarget, deferredCatalogInsertQuery, indexedPartidasCatalog]);
  const editableCells = rowNavigationLookup.orderedEditableCells;
  const levelIdSet = useMemo(() => new Set(summary.levels.map((level) => level.id)), [summary.levels]);
  const effectiveDensityMode: DensityMode = isExcelMode ? "compact" : densityMode;
  const isDensityLockedToCompact = isExcelMode;
  const lastSavedSnapshot = useRef(summary);
  const isHydrated = useRef(false);
  const saveBudgetRef = useRef<((isAutosave?: boolean) => Promise<void>) | null>(null);
  const cellRefs = useRef(new Map<string, HTMLInputElement>());
  const editorRootRef = useRef<HTMLDivElement>(null);
  const activeRowIdRef = useRef<string | null>(null);
  const pendingUiTimeoutsRef = useRef<number[]>([]);
  const levelActionMenuRef = useRef<HTMLDivElement | null>(null);
  const itemActionMenuRef = useRef<HTMLDivElement | null>(null);
  const headerActionMenuRef = useRef<HTMLDivElement | null>(null);
  const estimatedBudgetRowHeight = isExcelMode ? excelRowHeight : 58;

  useEffect(() => {
    return () => {
      for (const timeoutId of pendingUiTimeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }
      pendingUiTimeoutsRef.current = [];
    };
  }, []);

  const scheduleUiTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(() => {
      pendingUiTimeoutsRef.current = pendingUiTimeoutsRef.current.filter((candidate) => candidate !== timeoutId);
      callback();
    }, delay);

    pendingUiTimeoutsRef.current.push(timeoutId);
  }, []);

  function closeLevelActionMenu(restoreFocus = false) {
    setLevelActionMenu((current) => {
      if (restoreFocus) {
        window.requestAnimationFrame(() => current?.trigger?.focus());
      }
      return null;
    });
  }

  function closeItemActionMenu(restoreFocus = false) {
    setItemActionMenu((current) => {
      if (restoreFocus) {
        window.requestAnimationFrame(() => current?.trigger?.focus());
      }
      return null;
    });
  }

  function closeHeaderActionMenu(restoreFocus = false) {
    setHeaderActionMenu((current) => {
      if (restoreFocus) {
        window.requestAnimationFrame(() => current?.trigger?.focus());
      }
      return null;
    });
  }
  const openApuSheet = useCallback((item: BudgetItemRecord) => {
    setApuSheetSession({
      item: ensureBudgetItemApu(item),
      restoreFocusElement: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    });
  }, []);
  const handleApuItemUpdate = useCallback((updatedItem: BudgetItemRecord) => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
    }));
  }, []);

  useEffect(() => {
    if (!isHydrated.current) {
      isHydrated.current = true;
      return;
    }

    if (summary !== lastSavedSnapshot.current) {
      setSaveState("dirty");
    }
  }, [summary]);

  useEffect(() => {
    if (!isHydrated.current || saveState !== "dirty") return;

    const timeout = setTimeout(() => {
      void saveBudgetRef.current?.(true);
    }, 1200);

    return () => clearTimeout(timeout);
  }, [saveState]);

  useEffect(() => {
    saveBudgetRef.current = saveBudget;
  });

  useEffect(() => {
    if (!pasteFeedback) return;

    const timeout = setTimeout(() => setPasteFeedback(""), 4000);
    return () => clearTimeout(timeout);
  }, [pasteFeedback]);

  const { scrollContainerRef: tableScrollRef, scrollProps: tableScrollProps, virtualRange: virtualBudgetRange } =
    useVirtualTableWindow({
      items: rows,
      rowHeight: estimatedBudgetRowHeight,
      overscan: BUDGET_ROW_OVERSCAN,
      fallbackVisibleRows: 12,
      resetKey: estimatedBudgetRowHeight,
    });

  useEffect(() => {
    if (!catalogSelectorRowId) return;

    const updatePosition = () => {
      const element = cellRefs.current.get(getCellKey(catalogSelectorRowId, "description"));
      if (!element) return;

      const rect = element.getBoundingClientRect();
      setCatalogMenu({
        rowId: catalogSelectorRowId,
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };

    return subscribeWindowPositionUpdates(updatePosition);
  }, [catalogSelectorRowId, rows]);

  useEffect(() => {
    if (!levelActionMenu) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-level-action-menu]")) return;
      if (target.closest("[data-level-action-trigger]")) return;
      closeLevelActionMenu(true);
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [levelActionMenu]);

  useEffect(() => {
    if (!levelActionMenu) return;

    const frame = window.requestAnimationFrame(() => {
      levelActionMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    });

    function handleEscape(event: KeyboardEvent) {
      if (handleMenuArrowNavigation(event, levelActionMenuRef.current)) return;
      if (event.key !== "Escape") return;
      closeLevelActionMenu(true);
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [levelActionMenu]);

  useEffect(() => {
    if (!itemActionMenu) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-item-action-menu]")) return;
      if (target.closest("[data-item-action-trigger]")) return;
      closeItemActionMenu(true);
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [itemActionMenu]);

  useEffect(() => {
    if (!itemActionMenu) return;

    const frame = window.requestAnimationFrame(() => {
      itemActionMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    });

    function handleEscape(event: KeyboardEvent) {
      if (handleMenuArrowNavigation(event, itemActionMenuRef.current)) return;
      if (event.key !== "Escape") return;
      closeItemActionMenu(true);
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [itemActionMenu]);

  useEffect(() => {
    if (!headerActionMenu) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-header-action-menu]")) return;
      if (target.closest("[data-header-action-trigger]")) return;
      closeHeaderActionMenu(true);
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [headerActionMenu]);

  useEffect(() => {
    if (!headerActionMenu) return;

    const frame = window.requestAnimationFrame(() => {
      headerActionMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    });

    function handleEscape(event: KeyboardEvent) {
      if (handleMenuArrowNavigation(event, headerActionMenuRef.current)) return;
      if (event.key !== "Escape") return;
      closeHeaderActionMenu(true);
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [headerActionMenu]);

  useEffect(() => {
    if (!levelActionMenu) return;

    const updatePosition = () => {
      if (!levelActionMenu.trigger?.isConnected) {
        closeLevelActionMenu();
        return;
      }

      const menuElement = levelActionMenuRef.current;
      const menuSize: FixedMenuSize = {
        width: menuElement?.offsetWidth ?? LEVEL_ACTION_MENU_WIDTH,
        height: menuElement?.offsetHeight ?? (levelActionMenu.kind === "add" ? LEVEL_ADD_MENU_ESTIMATED_HEIGHT : LEVEL_MORE_MENU_ESTIMATED_HEIGHT),
      };
      const nextPosition = getFixedMenuPosition(levelActionMenu.trigger.getBoundingClientRect(), menuSize);

      setLevelActionMenu((current) =>
        current && current.rowId === levelActionMenu.rowId && current.kind === levelActionMenu.kind
          ? { ...current, ...nextPosition }
          : current,
      );
    };

    return subscribeWindowPositionUpdates(updatePosition);
  }, [levelActionMenu]);

  useEffect(() => {
    if (!itemActionMenu) return;

    const updatePosition = () => {
      if (!itemActionMenu.trigger?.isConnected) {
        closeItemActionMenu();
        return;
      }

      const menuElement = itemActionMenuRef.current;
      const nextPosition = getFixedMenuPosition(itemActionMenu.trigger.getBoundingClientRect(), {
        width: menuElement?.offsetWidth ?? ITEM_ACTION_MENU_WIDTH,
        height: menuElement?.offsetHeight ?? ITEM_ACTION_MENU_ESTIMATED_HEIGHT,
      });

      setItemActionMenu((current) => (current && current.rowId === itemActionMenu.rowId ? { ...current, ...nextPosition } : current));
    };

    return subscribeWindowPositionUpdates(updatePosition);
  }, [itemActionMenu]);

  useEffect(() => {
    if (!headerActionMenu) return;

    const updatePosition = () => {
      if (!headerActionMenu.trigger?.isConnected) {
        closeHeaderActionMenu();
        return;
      }

      const menuElement = headerActionMenuRef.current;
      const menuSize: FixedMenuSize = {
        width: menuElement?.offsetWidth ?? HEADER_ACTION_MENU_WIDTH,
        height: menuElement?.offsetHeight ?? (headerActionMenu.kind === "add" ? HEADER_ADD_MENU_ESTIMATED_HEIGHT : HEADER_MORE_MENU_ESTIMATED_HEIGHT),
      };
      const nextPosition = getFixedMenuPosition(headerActionMenu.trigger.getBoundingClientRect(), menuSize);

      setHeaderActionMenu((current) =>
        current && current.kind === headerActionMenu.kind
          ? { ...current, ...nextPosition }
          : current,
      );
    };

    return subscribeWindowPositionUpdates(updatePosition);
  }, [headerActionMenu]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (apuSheetSession) return;

      const editorRoot = editorRootRef.current;
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const commandOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      if (commandOrCtrl && event.key === "Enter") {
        const targetRowId = activeRowIdRef.current ?? getFocusedBudgetRowId(editorRoot);
        if (!targetRowId) return;

        const activeItem = summary.items.find((item) => item.id === targetRowId);
        if (!activeItem) return;

        event.preventDefault();
        openApuSheet(activeItem);
        return;
      }

      if (!isFocusedWithinEditor(editorRoot)) return;

      if (commandOrCtrl && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveBudgetRef.current?.();
        return;
      }

      const focusedRowId = getFocusedBudgetRowId(editorRoot) ?? activeRowIdRef.current;
      if (!focusedRowId) return;

      if (event.altKey) {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          if (levelIdSet.has(focusedRowId)) {
            moveLevel(focusedRowId, "up");
          } else {
            moveItem(focusedRowId, "up");
          }
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          if (levelIdSet.has(focusedRowId)) {
            moveLevel(focusedRowId, "down");
          } else {
            moveItem(focusedRowId, "down");
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeRowId, apuSheetSession, levelIdSet, openApuSheet, summary]);

  function addLevel(type: BudgetLevelType, parentId?: string | null) {
    const insertion = resolveLevelInsertion(type, rows, state.levels, activeRowIdRef.current, parentId);

    setState((current) => {
      const nextLevel = {
        id: crypto.randomUUID(),
        budgetId: current.id,
        parentId: insertion.parentId,
        type,
        code: createLevelCode(current.levels, insertion.parentId, current.levels.length + 1),
        name: getDefaultLevelName(type),
        sortOrder: current.levels.length + 1,
      } satisfies BudgetLevelRecord;

      return {
        ...current,
        levels: insertLevelAtPosition(current.levels, nextLevel, insertion),
      };
    });
  }

  function addItem(levelId?: string | null) {
    const insertion = resolveItemInsertion(rows, activeRowIdRef.current, levelId);
    const parentLevelId = insertion.levelId;
    const nextItem = createBudgetItemDraft(state, {
      levelId: parentLevelId,
    });

    setState((current) => ({
      ...current,
      items: insertItemAtPosition(current.items, nextItem, insertion),
    }));

    activeRowIdRef.current = nextItem.id;
    setActiveRowId(nextItem.id);
    setActiveColumn("description");
    openCatalogSelector(nextItem.id);

    scheduleUiTimeout(() => {
      focusCell({ rowId: nextItem.id, column: "description" });
      openCatalogSelector(nextItem.id);
    }, 0);
  }

  function openCatalogInsert(target: InsertTarget | null) {
    const nextTarget = target ?? getDefaultInsertTarget(rows, activeRowIdRef.current);
    if (!nextTarget) {
      setError("Necesitas al menos un nivel o una partida activa para insertar desde el catálogo.");
      return;
    }

    setCatalogInsertTarget(nextTarget);
    setCatalogInsertQuery("");
    setCatalogSelectedIds([]);
  }

  function closeCatalogInsert() {
    setCatalogInsertTarget(null);
    setCatalogInsertQuery("");
    setCatalogSelectedIds([]);
  }

  function openExcelImport(target: InsertTarget | null) {
    const nextTarget = target ?? getDefaultInsertTarget(rows, activeRowIdRef.current);
    if (!nextTarget) {
      setError("Necesitas al menos un nivel o una partida activa para importar desde Excel.");
      return;
    }

    setExcelImportTarget(nextTarget);
    setExcelImportText("");
    setExcelImportFileName("");
  }

  function closeExcelImport() {
    setExcelImportTarget(null);
    setExcelImportText("");
    setExcelImportFileName("");
    setExcelImportLoading(false);
  }

  const updateLevel = useCallback((levelId: string, patch: Partial<BudgetLevelRecord>) => {
    setState((current) => ({
      ...current,
      levels: current.levels.map((level) => (level.id === levelId ? { ...level, ...patch } : level)),
    }));
  }, []);

  const updateItem = useCallback((itemId: string, patch: Partial<BudgetItemRecord>) => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
  }, []);

  function applyCatalogPartidaToItem(itemId: string, partida: CatalogPartidaRecord) {
    const unresolvedRows = partida.apuRows.filter((row) => !resolveCatalogResource(row, resourcesById, resourcesByDescriptionUnit));

    setState((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId
          ? applyCatalogPartidaToDraftItem({
              item,
              partida,
              resourcesById,
              resourcesByDescriptionUnit,
            })
          : item,
      ),
    }));

    setItemQualityStateById((current) => ({
      ...current,
      [itemId]: {
        requiresCatalogReview: false,
        resolvedFromSuggestion: false,
      },
    }));

    if (unresolvedRows.length > 0) {
      setPasteFeedback(
        `Se agregó la partida, pero ${unresolvedRows.length} ${unresolvedRows.length === 1 ? "insumo no existe" : "insumos no existen"} en el catálogo de insumos y se omitieron del APU.`,
      );
    }

    closeCatalogSelector();
  }

  function insertCatalogPartida(target: InsertTarget, partida: CatalogPartidaRecord) {
    insertCatalogPartidas(target, [partida]);
  }

  function insertCatalogPartidas(target: InsertTarget, partidas: CatalogPartidaRecord[]) {
    if (partidas.length === 0) return;

    setState((current) => {
      const insertion = resolveItemInsertionFromTarget(target, current.items);

      const nextItems = partidas.map((partida, index) => {
        const nextItem = createBudgetItemDraft(current, {
          levelId: insertion.levelId,
          overrides: {
            description: partida.description,
            unit: partida.unit,
            unitPrice: partida.unitPrice,
          },
          sortOrder: current.items.length + index + 1,
        });

        return applyCatalogPartidaToDraftItem({
          item: nextItem,
          partida,
          resourcesById,
          resourcesByDescriptionUnit,
        });
      });

      return {
        ...current,
        items: insertItemsAtPosition(current.items, nextItems, insertion),
      };
    });

    closeCatalogInsert();
    setPasteFeedback(
      partidas.length === 1
        ? `Partida agregada desde catálogo: ${partidas[0]?.description ?? "Partida"}.`
        : `${partidas.length} partidas agregadas desde el catálogo.`,
    );
  }

  function prepareExcelImportPreview() {
    if (!excelImportTarget) return;

    const targetRow = resolveTargetRow(rows, excelImportTarget);
    if (!targetRow) {
      setError("No se encontró el destino para la importación.");
      return;
    }

    const rawText = excelImportText;
    const guidedPaste = attachPartidaSuggestionsToGuidedPaste(
      createGuidedBudgetPaste({
        rawText,
        startColumn: "code",
        targetKind: targetRow.kind,
        applyMode: resolveDefaultPasteApplyMode(targetRow),
      }),
      partidasCatalog,
    );

    if (guidedPaste.rows.length === 0 && guidedPaste.entries.length === 0) {
      setError("No se encontraron filas validas para importar desde el bloque pegado.");
      return;
    }

    setError("");
    setPendingPaste({
      rawText,
      guidedPaste,
      rowResolutions: createPendingPasteRowResolutions(guidedPaste),
      targetRow,
      startColumn: "code",
      source: "excel-import",
    });
    closeExcelImport();
  }

  async function handleExcelFileSelected(file: File) {
    setExcelImportLoading(true);
    setError("");

    try {
      const { default: ExcelJS } = await import("exceljs");
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".csv") || lowerName.endsWith(".tsv")) {
        const text = await file.text();
        const normalized = lowerName.endsWith(".csv")
          ? text
              .replace(/\r\n/g, "\n")
              .split("\n")
              .map((line) => line.split(",").join("\t"))
              .join("\n")
          : text;

        if (!normalized.trim()) {
          throw new Error("No se encontraron celdas utiles en el archivo.");
        }

        setExcelImportText(normalized);
        setExcelImportFileName(file.name);
        return;
      }

      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets.find((sheet) => sheet.actualRowCount > 0) ?? workbook.worksheets[0];
      if (!worksheet) {
        throw new Error("El archivo no contiene hojas con datos.");
      }

      const lines =
        worksheet
          .getRows(1, worksheet.actualRowCount ?? worksheet.rowCount)
          ?.map((row) => {
            const values = Array.isArray(row.values) ? row.values.slice(1) : [];
            return values
              .map((value: CellValue | undefined) => formatWorkbookCellValue(value))
              .join("\t");
          })
          .filter((line) => line.split("\t").some((cell) => cell.trim().length > 0)) ?? [];

      const nextText = lines.join("\n");
      if (!nextText.trim()) {
        throw new Error("No se encontraron celdas utiles en el archivo.");
      }

      setExcelImportText(nextText);
      setExcelImportFileName(file.name);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "No se pudo leer el archivo de Excel.");
    } finally {
      setExcelImportLoading(false);
    }
  }

  const openCatalogSelector = useCallback((rowId: string, query = "") => {
    setCatalogSelectorRowId(rowId);
    setCatalogQuery(query);
    setCatalogHighlightedIndex(0);
  }, []);

  const closeCatalogSelector = useCallback(() => {
    setCatalogSelectorRowId(null);
    setCatalogQuery("");
    setCatalogMenu(null);
    setCatalogHighlightedIndex(0);
  }, []);

  const toggleLevelActionMenu = useCallback((rowId: string, kind: "add" | "more", trigger: HTMLElement) => {
    const rect = trigger.getBoundingClientRect();
    const initialPosition = getFixedMenuPosition(rect, {
      width: LEVEL_ACTION_MENU_WIDTH,
      height: kind === "add" ? LEVEL_ADD_MENU_ESTIMATED_HEIGHT : LEVEL_MORE_MENU_ESTIMATED_HEIGHT,
    });

    setLevelActionMenu((current) =>
      current?.rowId === rowId && current.kind === kind
        ? null
        : {
            rowId,
            kind,
            ...initialPosition,
            trigger,
          },
    );
  }, []);

  const toggleItemActionMenu = useCallback((rowId: string, trigger: HTMLElement) => {
    const rect = trigger.getBoundingClientRect();
    const initialPosition = getFixedMenuPosition(rect, {
      width: ITEM_ACTION_MENU_WIDTH,
      height: ITEM_ACTION_MENU_ESTIMATED_HEIGHT,
    });

    setItemActionMenu((current) =>
      current?.rowId === rowId
        ? null
        : {
            rowId,
            ...initialPosition,
            trigger,
          },
    );
  }, []);

  function toggleHeaderActionMenu(kind: "add" | "more", trigger: HTMLElement) {
    const rect = trigger.getBoundingClientRect();
    const initialPosition = getFixedMenuPosition(rect, {
      width: HEADER_ACTION_MENU_WIDTH,
      height: kind === "add" ? HEADER_ADD_MENU_ESTIMATED_HEIGHT : HEADER_MORE_MENU_ESTIMATED_HEIGHT,
    });

    setHeaderActionMenu((current) =>
      current?.kind === kind
        ? null
        : {
            kind,
            ...initialPosition,
            trigger,
          },
    );
  }

  function duplicateItem(itemId: string) {
    setState((current) => {
      const sourceItem = current.items.find((item) => item.id === itemId);
      if (!sourceItem) return current;

      return {
        ...current,
        items: normalizeItemSortOrders([
          ...current.items,
          {
            ...sourceItem,
            id: crypto.randomUUID(),
            code: `${sourceItem.code}-C`,
            description: `${sourceItem.description} (copia)`,
            sortOrder: current.items.length + 1,
            apu: sourceItem.apu
              ? {
                  ...sourceItem.apu,
                  id: crypto.randomUUID(),
                  budgetItemId: "",
                  resources: sourceItem.apu.resources.map((resource) => ({
                    ...resource,
                    id: crypto.randomUUID(),
                  })),
                }
              : sourceItem.apu,
          },
        ]),
      };
    });
  }

  function removeItem(itemId: string) {
    setState((current) => ({
      ...current,
      items: normalizeItemSortOrders(current.items.filter((currentItem) => currentItem.id !== itemId)),
    }));
  }

  function removeLevel(levelId: string) {
    setState((current) => {
      const descendantIds = collectDescendantLevelIds(current.levels, levelId);
      const toDelete = new Set([levelId, ...descendantIds]);

      return {
        ...current,
        levels: normalizeSortOrders(current.levels.filter((level) => !toDelete.has(level.id))),
        items: normalizeItemSortOrders(current.items.filter((item) => !item.levelId || !toDelete.has(item.levelId))),
      };
    });
  }

  function openClearSubBudgetDialog() {
    if (summary.levels.length === 0 && summary.items.length === 0) {
      setError("El sub presupuesto ya está vacío.");
      return;
    }

    setClearSubBudgetDialogOpen(true);
  }

  function clearSubBudget() {
    setError("");
    setCatalogSelectorRowId(null);
    closeCatalogSelector();
    closeCatalogInsert();
    closeExcelImport();
    activeRowIdRef.current = null;
    setActiveRowId(null);
    setActiveColumn(null);
    setState((current) => ({
      ...current,
      levels: [],
      items: [],
    }));
    setClearSubBudgetDialogOpen(false);
    setPasteFeedback("Sub presupuesto limpio. Los cambios se guardarán con autosave o al pulsar Guardar.");
  }

  function moveLevel(levelId: string, direction: "up" | "down") {
    setState((current) => ({
      ...current,
      levels: moveScopedEntity(current.levels, levelId, direction, (level) => level.parentId ?? null, resequenceLevels),
    }));
  }

  function moveItem(itemId: string, direction: "up" | "down") {
    setState((current) => ({
      ...current,
      items: moveScopedEntity(current.items, itemId, direction, (item) => item.levelId ?? null, resequenceItems),
    }));
  }

  const handleDropRow = useCallback((targetRow: BudgetDisplayRow) => {
    if (!dragState) return;

    if (dragState.kind === "level" && targetRow.kind === "level") {
      setState((current) => ({
        ...current,
        levels: moveScopedEntityToTarget(
          current.levels,
          dragState.id,
          targetRow.level.id,
          (level) => level.parentId ?? null,
          resequenceLevels,
        ),
      }));
    }

    if (dragState.kind === "item" && targetRow.kind === "item") {
      setState((current) => ({
        ...current,
        items: moveScopedEntityToTarget(
          current.items,
          dragState.id,
          targetRow.item.id,
          (item) => item.levelId ?? null,
          resequenceItems,
        ),
      }));
    }

    setDragState(null);
  }, [dragState]);

  const handlePasteRows = useCallback((
    event: React.ClipboardEvent<HTMLInputElement>,
    targetRow: BudgetDisplayRow,
    startColumn: EditableColumn,
  ) => {
    const rawText = event.clipboardData.getData("text");
    const guidedPaste = attachPartidaSuggestionsToGuidedPaste(
      createGuidedBudgetPaste({
        rawText,
        startColumn,
        targetKind: targetRow.kind,
        applyMode: resolveDefaultPasteApplyMode(targetRow),
      }),
      partidasCatalog,
    );
    if (guidedPaste.rows.length === 0 && guidedPaste.entries.length === 0) return;

    event.preventDefault();
    closeCatalogSelector();
    setPendingPaste({
      rawText,
      guidedPaste,
      rowResolutions: createPendingPasteRowResolutions(guidedPaste),
      targetRow,
      startColumn,
      source: "inline-paste",
    });
  }, [closeCatalogSelector, partidasCatalog]);

  function applyPendingPaste() {
    if (!pendingPaste) return;

    const { guidedPaste, targetRow } = pendingPaste;
    setPasteFeedback(getPasteFeedbackMessage(guidedPaste.importedItems, guidedPaste.importedLevels));
    const nextQualityStateById: Record<string, BudgetItemQualityState | undefined> = {};

    setState((current) => {
      const applySuggestedOrMatchedPartida = (
        item: BudgetItemRecord,
        sourceRowIndex: number,
        fallbackMatch: PendingPaste["guidedPaste"]["itemMatches"][number]["match"],
      ) => {
        const rowResolution = pendingPaste.rowResolutions.find((resolution) => resolution.sourceRowIndex === sourceRowIndex) ?? null;
        const rowMatch = guidedPaste.itemMatches.find((match) => match.sourceRowIndex === sourceRowIndex)?.match ?? fallbackMatch;
        const selectedPartida =
          rowMatch.matchKind === "exact"
            ? rowMatch.exactMatch
            : rowResolution?.selectedPartidaId
              ? partidasById.get(rowResolution.selectedPartidaId) ?? null
              : null;

        if (!selectedPartida) {
          nextQualityStateById[item.id] = {
            requiresCatalogReview: true,
            resolvedFromSuggestion: false,
          };
          return item;
        }

        nextQualityStateById[item.id] = {
          requiresCatalogReview: false,
          resolvedFromSuggestion: rowMatch.matchKind === "suggested",
        };

        return applyCatalogPartidaToDraftItem({
          item,
          partida: selectedPartida,
          resourcesById,
          resourcesByDescriptionUnit,
        });
      };

      if (guidedPaste.selectedMode !== "flat") {
        return importStructuredPaste(current, targetRow, guidedPaste.entries, (levelId, values, sortOrder, entryIndex, sourceRowIndex) => {
          const nextItem = createBudgetItemDraft(current, {
            levelId,
            overrides: values,
            sortOrder,
          });
          const rowMatch = guidedPaste.itemMatches.find((match) => match.entryIndex === entryIndex || match.sourceRowIndex === sourceRowIndex)?.match;

          return rowMatch ? applySuggestedOrMatchedPartida(nextItem, sourceRowIndex, rowMatch) : nextItem;
        });
      }

      const pastedRows = guidedPaste.rows;

      if (targetRow.kind === "item") {
        if (guidedPaste.applyMode === "replace-current") {
          const sortedItems = [...current.items].sort((left, right) => left.sortOrder - right.sortOrder);
          const targetIndex = sortedItems.findIndex((item) => item.id === targetRow.item.id);

          if (targetIndex === -1) return current;

          const firstRowMatch = guidedPaste.itemMatches.find((match) => match.rowIndex === 0)?.match;
          sortedItems[targetIndex] =
            firstRowMatch
              ? applySuggestedOrMatchedPartida(
                  applyPastedValuesToItem(sortedItems[targetIndex], pastedRows[0] ?? {}),
                  0,
                  firstRowMatch,
                )
              : applyPastedValuesToItem(sortedItems[targetIndex], pastedRows[0] ?? {});

          if (pastedRows.length > 1) {
            const extraItems = pastedRows.slice(1).map((row, index) =>
              applySuggestedOrMatchedPartida(
                createBudgetItemDraft(current, {
                  levelId: sortedItems[targetIndex]?.levelId ?? null,
                  overrides: row,
                  sortOrder: sortedItems[targetIndex]!.sortOrder + index + 1,
                }),
                index + 1,
                guidedPaste.itemMatches.find((match) => match.rowIndex === index + 1)?.match ?? {
                  matchKind: "unresolved",
                  exactMatch: null,
                  bestSuggestion: null,
                  suggestions: [],
                },
              ),
            );

            sortedItems.splice(targetIndex + 1, 0, ...extraItems);
          }

          return {
            ...current,
            items: resequenceItems(sortedItems),
          };
        }

        if (guidedPaste.applyMode === "insert-below") {
          const insertion = resolveItemInsertionFromTarget({ kind: "item", id: targetRow.item.id }, current.items);
          const extraItems = pastedRows.map((row, index) =>
            applySuggestedOrMatchedPartida(
              createBudgetItemDraft(current, {
                levelId: insertion.levelId,
                overrides: row,
                sortOrder: current.items.length + index + 1,
              }),
              index,
              guidedPaste.itemMatches.find((match) => match.rowIndex === index)?.match ?? {
                matchKind: "unresolved",
                exactMatch: null,
                bestSuggestion: null,
                suggestions: [],
              },
            ),
          );

          return {
            ...current,
            items: insertItemsAtPosition(current.items, extraItems, insertion),
          };
        }
      }

      if (targetRow.kind !== "level") {
        return current;
      }

      const insertion = resolveItemInsertionFromTarget({ kind: "level", id: targetRow.level.id }, current.items);
      const extraItems = pastedRows.map((row, index) =>
        applySuggestedOrMatchedPartida(
          createBudgetItemDraft(current, {
            levelId: insertion.levelId,
            overrides: row,
            sortOrder: current.items.length + index + 1,
          }),
          index,
          guidedPaste.itemMatches.find((match) => match.rowIndex === index)?.match ?? {
            matchKind: "unresolved",
            exactMatch: null,
            bestSuggestion: null,
            suggestions: [],
          },
        ),
      );

      return {
        ...current,
        items: insertItemsAtPosition(current.items, extraItems, insertion),
      };
    });

    setItemQualityStateById((current) => ({
      ...current,
      ...nextQualityStateById,
    }));

    setPendingPaste(null);
  }

  function closePastePreview() {
    setPendingPaste(null);
  }

  const setCellRef = useCallback((rowId: string, column: EditableColumn, element: HTMLInputElement | null) => {
    const key = getCellKey(rowId, column);

    if (!element) {
      cellRefs.current.delete(key);
      return;
    }

    cellRefs.current.set(key, element);
  }, []);

  const focusCell = useCallback((cell: EditableCell | null) => {
    if (!cell) return;

    const element = cellRefs.current.get(getCellKey(cell.rowId, cell.column));
    if (!element) return;

    element.focus();
    element.select();
  }, []);

  const getAdjacentCell = useCallback((rowId: string, column: EditableColumn, direction: "up" | "down") => {
    const rowIndex = rowNavigationLookup.rowIdToIndex.get(rowId) ?? -1;
    if (rowIndex === -1) return null;

    const step = direction === "up" ? -1 : 1;

    for (let currentIndex = rowIndex + step; currentIndex >= 0 && currentIndex < rows.length; currentIndex += step) {
      const nextRow = rows[currentIndex];
      const nextColumn = resolveTargetColumn(rowNavigationLookup.rowIdToColumns.get(getRowId(nextRow)) ?? [], column);

      if (nextColumn) {
        return { rowId: getRowId(nextRow), column: nextColumn };
      }
    }

    return null;
  }, [rowNavigationLookup.rowIdToColumns, rowNavigationLookup.rowIdToIndex, rows]);

  const handleSpreadsheetNavigation = useCallback((
    event: React.KeyboardEvent<HTMLInputElement>,
    rowId: string,
    column: EditableColumn,
  ) => {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusCell(getAdjacentCell(rowId, column, "up"));
      return;
    }

    if (event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      focusCell(getAdjacentCell(rowId, column, "down"));
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const currentIndex = rowNavigationLookup.editableCellIndexByKey.get(getCellKey(rowId, column)) ?? -1;
      if (currentIndex === -1) return;

      const nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
      focusCell(editableCells[nextIndex] ?? null);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (!shouldMoveHorizontally(event.currentTarget, event.key)) return;

      event.preventDefault();

      const columns = rowNavigationLookup.rowIdToColumns.get(rowId) ?? [];
      const columnIndex = columns.indexOf(column);
      if (columnIndex === -1) return;

      const nextColumn = event.key === "ArrowLeft" ? columns[columnIndex - 1] : columns[columnIndex + 1];
      if (!nextColumn) return;

      focusCell({ rowId, column: nextColumn });
    }
  }, [editableCells, focusCell, getAdjacentCell, rowNavigationLookup.editableCellIndexByKey, rowNavigationLookup.rowIdToColumns]);

  const handleRowFocus = useCallback((rowId: string) => {
    activeRowIdRef.current = rowId;
    setActiveRowId(rowId);
  }, []);

  const handleCellFocus = useCallback((rowId: string, column: ActiveColumn) => {
    activeRowIdRef.current = rowId;
    setActiveRowId(rowId);
    setActiveColumn(column);
  }, []);

  const updateGeneralExpensesRate = useCallback((value: number) => {
    setState((current) => ({ ...current, generalExpensesRate: value }));
  }, []);

  const updateUtilityRate = useCallback((value: number) => {
    setState((current) => ({ ...current, utilityRate: value }));
  }, []);

  const updateIgvRate = useCallback((value: number) => {
    setState((current) => ({ ...current, igvRate: value }));
  }, []);

  const toggleSummaryCollapsed = useCallback(() => {
    setSummaryCollapsed((current) => !current);
  }, []);

  const clearDragState = useCallback(() => {
    setDragState(null);
  }, []);

  const scheduleCatalogClose = useCallback((rowId: string) => {
    scheduleUiTimeout(() => {
      if (catalogSelectorRowId === rowId) {
        closeCatalogSelector();
      }
    }, 120);
  }, [catalogSelectorRowId, closeCatalogSelector, scheduleUiTimeout]);

  async function saveBudget(isAutosave = false) {
    if (saving) return;

    const incompleteApuResourceRow = findIncompleteApuResourceRow(summary);
    if (incompleteApuResourceRow) {
      setError("Asigna un insumo o elimina la fila manual vacia antes de guardar el APU.");
      setSaveState("error");
      return;
    }

    const patch = buildBudgetStatePatch(lastSavedSnapshot.current, summary);
    if (!patch) {
      setSaveState("saved");
      return;
    }

    setSaving(true);
    setError("");
    setSaveState("saving");

    const payload = JSON.stringify(patch);

    try {
      const response = await fetch(`/api/budgets/${budget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      if (!response.ok) {
        const data = await response.json().catch(async () => {
          const text = await response.text().catch(() => "");
          return text ? { error: text } : null;
        });
        const message = data?.error ?? "No se pudo guardar el presupuesto";
        setError(`${response.status} ${response.statusText}: ${message}`.trim());
        setSaveState("error");
        return;
      }

      const data = await response.json();

      lastSavedSnapshot.current = summary;
      setLastSavedAt(Date.now());
      setSaveState("saved");
      broadcastAppDataChange(["/dashboard", "/projects", "/budgets"], data.optimisticBudgets, {
        locallyHandledPaths: ["/budgets"],
      });

      if (!isAutosave) {
        router.refresh();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar el presupuesto");
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={editorRootRef}
      className={cn(
        "grid gap-5",
        isExcelMode ? "budget-excel-flow" : "budget-modern-flow",
        summaryCollapsed ? "xl:grid-cols-[minmax(0,1fr)_64px]" : "xl:grid-cols-[minmax(0,1fr)_320px]",
      )}
      data-view-mode-scope="budget-flow"
      data-density-mode={effectiveDensityMode}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;

        activeRowIdRef.current = null;
        setActiveRowId(null);
        setActiveColumn(null);
        setCatalogSelectorRowId(null);
      }}
    >
      <Card className={cn("overflow-hidden border-slate-200/90 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.28)]", isExcelMode && "rounded-md shadow-[0_10px_24px_-20px_rgba(15,23,42,0.18)]")}>
        <CardHeader className="flex flex-col gap-3 border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)]">
          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              {projectName ? <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">{projectName}</p> : null}
              <CardTitle className="tracking-tight text-slate-950">{budget.name}</CardTitle>
              <p className="text-xs leading-5 text-slate-500">Edición jerárquica con autosave y guardado manual.</p>
            </div>
            <div className="flex flex-col gap-1.5 xl:min-w-0 xl:items-end">
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <div className="group inline-flex self-end rounded-2xl border border-slate-200/90 bg-white/90 px-3 py-1.5 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.26)] transition hover:border-slate-300 hover:bg-white focus-within:border-slate-300 focus-within:bg-white">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Vista</p>
                      <ViewModeToggle />
                    </div>
                    <div className="hidden w-0 overflow-hidden transition-all duration-200 ease-out group-hover:w-5 group-focus-within:w-5 sm:flex sm:items-center sm:justify-center">
                      <div className="h-6 w-px bg-slate-200 opacity-0 transition duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100" />
                    </div>
                    <div className="flex max-h-0 max-w-0 translate-x-2 overflow-hidden opacity-0 transition-all duration-200 ease-out group-hover:max-h-16 group-hover:max-w-[220px] group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:max-h-16 group-focus-within:max-w-[220px] group-focus-within:translate-x-0 group-focus-within:opacity-100 sm:flex-row sm:items-center sm:gap-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Densidad</p>
                      <div className="inline-flex rounded-xl border border-slate-200/90 bg-white p-1 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.24)]">
                        <button
                          type="button"
                          onClick={() => setDensityMode("compact")}
                          aria-pressed={effectiveDensityMode === "compact"}
                          className={cn(
                            "rounded-lg px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                            effectiveDensityMode === "compact" ? "bg-slate-900 text-white" : "text-slate-500",
                          )}
                        >
                          Compacto
                        </button>
                        <button
                          type="button"
                          onClick={() => setDensityMode("comfortable")}
                          aria-pressed={!isDensityLockedToCompact && effectiveDensityMode === "comfortable"}
                          className={cn(
                            "rounded-lg px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                            !isDensityLockedToCompact && effectiveDensityMode === "comfortable" ? "bg-slate-900 text-white" : "text-slate-500",
                          )}
                        >
                          Cómodo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <div className="flex items-center">
                  <SaveBadge state={saveState} lastSavedAt={lastSavedAt} compact />
                </div>
                <Link
                  href={`/budgets/${budget.id}/risk-analysis`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 text-[11px] font-semibold tracking-[0.08em] text-sky-700 shadow-[0_12px_24px_-22px_rgba(37,99,235,0.32)] transition hover:border-sky-300 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <Activity className="h-4 w-4" />
                  Riesgos
                </Link>
                <Button
                  variant="secondary"
                  onClick={() => void saveBudget()}
                  disabled={saving}
                  className="h-8 rounded-full px-4 text-[11px] font-semibold tracking-[0.08em] shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
                <div className="flex items-center gap-1 rounded-full border border-slate-200/90 bg-white/90 px-1 py-1 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.22)] transition hover:border-slate-300 hover:bg-white">
                  <button
                    type="button"
                    data-header-action-trigger
                    className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-semibold tracking-[0.08em] text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    onClick={(event) => toggleHeaderActionMenu("add", event.currentTarget)}
                    title="Agregar partida, título, subtítulo o subpartida"
                    aria-label="Agregar partida, título, subtítulo o subpartida"
                    aria-haspopup="menu"
                    aria-expanded={headerActionMenu?.kind === "add"}
                    aria-controls="budget-header-add-menu"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar
                  </button>
                  <IconButton
                    label="Abrir acciones globales del sub presupuesto"
                    onClick={(event) => toggleHeaderActionMenu("more", event.currentTarget)}
                    className="h-8 w-8 rounded-full"
                    dataActionTrigger
                    dataHeaderActionTrigger
                    ariaExpanded={headerActionMenu?.kind === "more"}
                    ariaControls="budget-header-more-menu"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </IconButton>
                </div>
                <div className="hidden" aria-hidden="true">
                  <Button variant="outline" onClick={() => addLevel("TITLE")}>
                    Agregar título
                  </Button>
                  <Button variant="outline" onClick={() => addLevel("SUBTITLE")}>
                    Agregar subtítulo
                  </Button>
                  <Button variant="outline" onClick={() => openCatalogInsert(null)}>
                    Desde catálogo
                  </Button>
                  <Button variant="outline" onClick={() => openExcelImport(null)}>
                    Importar Excel
                  </Button>
                  <Button onClick={() => addItem()}>Agregar partida</Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <BudgetTableSection
          error={error}
          pasteFeedback={pasteFeedback}
          tableScrollRef={tableScrollRef}
          tableScrollProps={tableScrollProps}
          densityMode={effectiveDensityMode}
          isExcelMode={isExcelMode}
          activeColumn={activeColumn}
          activeRowId={activeRowId}
          dragState={dragState}
          levelActionMenu={levelActionMenu}
          itemActionMenu={itemActionMenu}
          catalogSelectorRowId={catalogSelectorRowId}
          catalogSuggestions={catalogSuggestions}
          catalogHighlightedIndex={catalogHighlightedIndex}
          onCatalogHighlightChange={setCatalogHighlightedIndex}
          currency={budget.currency}
          totalAmount={summary.totals.totalAmount}
          virtualBudgetRange={virtualBudgetRange}
          onDragStart={setDragState}
          onDragEnd={clearDragState}
          onDropRow={handleDropRow}
          onRowFocus={handleRowFocus}
          onCellFocus={handleCellFocus}
          onUpdateLevel={updateLevel}
          onUpdateItem={updateItem}
          onSetCellRef={setCellRef}
          onNavigate={handleSpreadsheetNavigation}
          onPasteRows={handlePasteRows}
          onToggleLevelActionMenu={toggleLevelActionMenu}
          onToggleItemActionMenu={toggleItemActionMenu}
          onOpenCatalogSelector={openCatalogSelector}
          onCloseCatalogSelector={closeCatalogSelector}
          onScheduleCatalogClose={scheduleCatalogClose}
          onApplyCatalogPartida={applyCatalogPartidaToItem}
          onOpenApuSheet={openApuSheet}
          itemQualityStateById={itemQualityStateById}
        />
      </Card>

      <BudgetSummaryPanel
        budgetId={budget.id}
        currency={budget.currency}
        densityMode={effectiveDensityMode}
        isExcelMode={isExcelMode}
        summaryCollapsed={summaryCollapsed}
        generalExpensesRate={state.generalExpensesRate}
        utilityRate={state.utilityRate}
        igvRate={state.igvRate}
        totals={summary.totals}
        qualitySummary={qualitySummary}
        onToggleCollapsed={toggleSummaryCollapsed}
        onGeneralExpensesRateChange={updateGeneralExpensesRate}
        onUtilityRateChange={updateUtilityRate}
        onIgvRateChange={updateIgvRate}
      />

      {apuSheetSession ? (
        <ApuSheetController
          key={apuSheetSession.item.id}
          initialItem={apuSheetSession.item}
          initialRestoreFocusElement={apuSheetSession.restoreFocusElement}
          resourcesCatalog={resourcesCatalog}
          densityMode={effectiveDensityMode}
          onClose={() => {
            setApuSheetSession(null);
          }}
          onUpdate={handleApuItemUpdate}
        />
      ) : null}

      {isCatalogMenuOpen && catalogMenu?.rowId === catalogSelectorRowId ? (
        <div
          className="fixed z-[90] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          style={{
            top: catalogMenu.top,
            left: catalogMenu.left,
            width: catalogMenu.width,
          }}
        >
          <div className="border-b border-slate-100 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Catalogo de partidas
          </div>
          <div className="max-h-72 overflow-auto py-1">
            {catalogSuggestions.map((partida, index) => (
              <button
                key={partida.id}
                type="button"
                className={cn(
                  "flex w-full items-start justify-between gap-3 px-3 py-2 text-left",
                  index === catalogHighlightedIndex ? "bg-sky-100" : "hover:bg-sky-50",
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (!catalogSelectorRowId) return;
                  applyCatalogPartidaToItem(catalogSelectorRowId, partida);
                }}
                onMouseEnter={() => setCatalogHighlightedIndex(index)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{partida.description}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {partida.unit} · {partida.apuRows.length} insumos · {partida.performanceRate ?? `${partida.performance} ${partida.unit}/DIA`}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs font-semibold text-slate-700">
                  {formatCurrency(partida.unitPrice, budget.currency, currencyDecimals)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {levelActionMenu ? (
        <div
          ref={levelActionMenuRef}
          id={`budget-level-${levelActionMenu.kind}-menu-${levelActionMenu.rowId}`}
          data-level-action-menu
          role="menu"
          aria-label={levelActionMenu.kind === "add" ? "Agregar contenido al nivel" : "Acciones del nivel"}
          className="fixed z-[92] w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xl"
          style={{
            top: levelActionMenu.top,
            left: levelActionMenu.left,
          }}
        >
          {levelActionMenu.kind === "add" ? (
            <LevelActionMenuButton
              label="Agregar partida"
              onClick={() => {
                addItem(levelActionMenu.rowId);
                closeLevelActionMenu(true);
              }}
            />
          ) : null}
          {levelActionMenu.kind === "add" && findLevelRow(rows, levelActionMenu.rowId)?.level.type === "TITLE" ? (
            <LevelActionMenuButton
              label="Agregar subtítulo"
              onClick={() => {
                addLevel("SUBTITLE", levelActionMenu.rowId);
                closeLevelActionMenu(true);
              }}
            />
          ) : null}
          {levelActionMenu.kind === "add" &&
          (() => {
            const levelRow = findLevelRow(rows, levelActionMenu.rowId);
            return levelRow ? levelRow.level.type === "SUBTITLE" || levelRow.level.type === "ITEM_GROUP" : false;
          })() ? (
            <LevelActionMenuButton
              label="Agregar subpartida"
              onClick={() => {
                addLevel("ITEM_GROUP", levelActionMenu.rowId);
                closeLevelActionMenu(true);
              }}
            />
          ) : null}

          {levelActionMenu.kind === "more" ? (
            <>
              <LevelActionMenuButton
                label="Mover arriba"
                onClick={() => {
                  moveLevel(levelActionMenu.rowId, "up");
                  closeLevelActionMenu(true);
                }}
              />
              <LevelActionMenuButton
                label="Mover abajo"
                onClick={() => {
                  moveLevel(levelActionMenu.rowId, "down");
                  closeLevelActionMenu(true);
                }}
              />
              <div className="my-1 border-t border-slate-100" />
              <LevelActionMenuButton
                label="Cambiar a título"
                onClick={() => {
                  updateLevel(levelActionMenu.rowId, { type: "TITLE" });
                  closeLevelActionMenu(true);
                }}
              />
              <LevelActionMenuButton
                label="Cambiar a subtítulo"
                onClick={() => {
                  updateLevel(levelActionMenu.rowId, { type: "SUBTITLE" });
                  closeLevelActionMenu(true);
                }}
              />
              <LevelActionMenuButton
                label="Cambiar a subpartida"
                onClick={() => {
                  updateLevel(levelActionMenu.rowId, { type: "ITEM_GROUP" });
                  closeLevelActionMenu(true);
                }}
              />
              <div className="my-1 border-t border-slate-100" />
              <LevelActionMenuButton
                label="Insertar desde catálogo"
                onClick={() => {
                  openCatalogInsert({ kind: "level", id: levelActionMenu.rowId });
                  closeLevelActionMenu(true);
                }}
              />
              <LevelActionMenuButton
                label="Importar desde Excel"
                onClick={() => {
                  openExcelImport({ kind: "level", id: levelActionMenu.rowId });
                  closeLevelActionMenu(true);
                }}
              />
              <div className="my-1 border-t border-slate-100" />
              <LevelActionMenuButton
                label="Eliminar nivel"
                onClick={() => {
                  removeLevel(levelActionMenu.rowId);
                  closeLevelActionMenu(true);
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {itemActionMenu ? (
        <div
          ref={itemActionMenuRef}
          id={`budget-item-menu-${itemActionMenu.rowId}`}
          data-item-action-menu
          role="menu"
          aria-label="Acciones de la partida"
          className="fixed z-[92] w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xl"
          style={{
            top: itemActionMenu.top,
            left: itemActionMenu.left,
          }}
        >
          <LevelActionMenuButton
            label="Mover arriba"
            onClick={() => {
              moveItem(itemActionMenu.rowId, "up");
              closeItemActionMenu(true);
            }}
          />
          <LevelActionMenuButton
            label="Mover abajo"
            onClick={() => {
              moveItem(itemActionMenu.rowId, "down");
              closeItemActionMenu(true);
            }}
          />
          <div className="my-1 border-t border-slate-100" />
          <LevelActionMenuButton
            label="Duplicar partida"
            onClick={() => {
              duplicateItem(itemActionMenu.rowId);
              closeItemActionMenu(true);
            }}
          />
          <LevelActionMenuButton
            label="Eliminar partida"
            onClick={() => {
              removeItem(itemActionMenu.rowId);
              closeItemActionMenu(true);
            }}
          />
        </div>
      ) : null}

      {headerActionMenu ? (
        <div
          ref={headerActionMenuRef}
          id={headerActionMenu.kind === "add" ? "budget-header-add-menu" : "budget-header-more-menu"}
          data-header-action-menu
          role="menu"
          aria-label={headerActionMenu.kind === "add" ? "Agregar contenido al sub presupuesto" : "Acciones globales del sub presupuesto"}
          className="fixed z-[92] w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xl"
          style={{
            top: headerActionMenu.top,
            left: headerActionMenu.left,
          }}
        >
          {headerActionMenu.kind === "add" ? (
            <>
              <LevelActionMenuButton
                label="Agregar partida"
                icon={<Plus className="h-4 w-4" />}
                className="bg-slate-50 font-semibold text-slate-900 hover:bg-slate-100"
                onClick={() => {
                  addItem();
                  closeHeaderActionMenu(true);
                }}
              />
              <div className="my-1 border-t border-slate-100" />
              <LevelActionMenuButton
                label="Agregar título"
                icon={<Type className="h-4 w-4" />}
                onClick={() => {
                  addLevel("TITLE");
                  closeHeaderActionMenu(true);
                }}
              />
              <LevelActionMenuButton
                label="Agregar subtítulo"
                icon={<Rows3 className="h-4 w-4" />}
                onClick={() => {
                  addLevel("SUBTITLE");
                  closeHeaderActionMenu(true);
                }}
              />
              <LevelActionMenuButton
                label="Agregar subpartida"
                icon={<GripVertical className="h-4 w-4" />}
                onClick={() => {
                  addLevel("ITEM_GROUP");
                  closeHeaderActionMenu(true);
                }}
              />
            </>
          ) : null}
          {headerActionMenu.kind === "more" ? (
            <>
              <LevelActionMenuButton
                label="Insertar desde catálogo"
                onClick={() => {
                  openCatalogInsert(null);
                  closeHeaderActionMenu(true);
                }}
              />
              <LevelActionMenuButton
                label="Importar desde Excel"
                onClick={() => {
                  openExcelImport(null);
                  closeHeaderActionMenu(true);
                }}
              />
              <div className="my-1 border-t border-slate-100" />
              <LevelActionMenuButton
                label="Limpiar sub presupuesto"
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => {
                  closeHeaderActionMenu();
                  openClearSubBudgetDialog();
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {clearSubBudgetDialogOpen ? (
        <ClearSubBudgetDialog
          open
          levelsCount={summary.levels.length}
          itemsCount={summary.items.length}
          onClose={() => setClearSubBudgetDialogOpen(false)}
          onConfirm={clearSubBudget}
        />
      ) : null}

      {catalogInsertTarget ? (
        <CatalogInsertSheet
          open
          query={catalogInsertQuery}
          suggestions={catalogInsertSuggestions}
          selectedIds={catalogSelectedIds}
          target={catalogInsertTarget}
          onClose={closeCatalogInsert}
          onQueryChange={setCatalogInsertQuery}
          onToggleSelect={(partidaId) =>
            setCatalogSelectedIds((current) =>
              current.includes(partidaId) ? current.filter((id) => id !== partidaId) : [...current, partidaId],
            )
          }
          onSelect={(partida) => {
            insertCatalogPartida(catalogInsertTarget, partida);
          }}
          onInsertSelected={() => {
            insertCatalogPartidas(
              catalogInsertTarget,
              catalogSelectedIds
                .map((partidaId) => partidasById.get(partidaId))
                .filter((partida): partida is CatalogPartidaRecord => partida !== undefined),
            );
          }}
        />
      ) : null}

      {excelImportTarget ? (
        <ExcelImportSheet
          open
          target={excelImportTarget}
          value={excelImportText}
          fileName={excelImportFileName}
          loading={excelImportLoading}
          onChange={setExcelImportText}
          onClose={closeExcelImport}
          onConfirm={prepareExcelImportPreview}
          onFileSelect={handleExcelFileSelected}
        />
      ) : null}

      {pendingPaste ? (
        <PastePreviewSheet
          pendingPaste={pendingPaste}
          onClose={closePastePreview}
          onConfirm={applyPendingPaste}
          onModeChange={(mode) => {
            setPendingPaste((current) => {
              if (!current) return current;

              const guidedPaste = attachPartidaSuggestionsToGuidedPaste(
                createGuidedBudgetPaste({
                  rawText: current.rawText,
                  startColumn: current.startColumn,
                  targetKind: current.targetRow.kind,
                  selectedMode: mode,
                  applyMode: current.guidedPaste.applyMode,
                }),
                partidasCatalog,
              );

              return {
                ...current,
                guidedPaste,
                rowResolutions: createPendingPasteRowResolutions(guidedPaste),
              };
            });
          }}
          onApplyModeChange={(applyMode) => {
            setPendingPaste((current) => {
              if (!current) return current;

              return {
                ...current,
                guidedPaste: {
                  ...current.guidedPaste,
                  applyMode,
                },
              };
            });
          }}
          onLevelTypeChange={(entryIndex, levelType) => {
            setPendingPaste((current) => {
              if (!current || current.guidedPaste.selectedMode === "flat") return current;

              const entries = current.guidedPaste.entries.map((entry, index) =>
                index === entryIndex && entry.kind === "level"
                  ? {
                      ...entry,
                      levelType,
                    }
                  : entry,
              );

              return {
                ...current,
                guidedPaste: {
                  ...current.guidedPaste,
                  entries,
                },
              };
            });
          }}
          onApplySuggestion={(sourceRowIndex, partidaId) => {
            setPendingPaste((current) => {
              if (!current) return current;

              return {
                ...current,
                rowResolutions: current.rowResolutions.map((resolution) =>
                  resolution.sourceRowIndex === sourceRowIndex
                    ? {
                        ...resolution,
                        selectedPartidaId: resolution.selectedPartidaId === partidaId ? null : partidaId,
                      }
                    : resolution,
                ),
              };
            });
          }}
        />
      ) : null}
    </div>
  );
}

function ApuSheetController({
  initialItem,
  initialRestoreFocusElement,
  densityMode,
  onClose,
  onUpdate,
  resourcesCatalog,
}: {
  initialItem: BudgetItemRecord;
  initialRestoreFocusElement: HTMLElement | null;
  densityMode: DensityMode;
  onClose: () => void;
  onUpdate: (item: BudgetItemRecord) => void;
  resourcesCatalog: ResourceRecord[];
}) {
  const [draftItem, setDraftItem] = useState<BudgetItemRecord | null>(initialItem);
  const [restoreFocusElement, setRestoreFocusElement] = useState<HTMLElement | null>(initialRestoreFocusElement);
  const openedItemSnapshotRef = useRef(JSON.stringify(initialItem));

  const closeSheet = useCallback(() => {
    if (draftItem && openedItemSnapshotRef.current !== JSON.stringify(draftItem)) {
      onUpdate(draftItem);
    }

    setDraftItem(null);
    setRestoreFocusElement(null);
    onClose();
  }, [draftItem, onClose, onUpdate]);

  return (
    <ApuEditorSheet
      item={draftItem}
      open={draftItem !== null}
      onClose={closeSheet}
      onUpdate={setDraftItem}
      resourcesCatalog={resourcesCatalog}
      restoreFocusElement={restoreFocusElement}
      densityMode={densityMode}
    />
  );
}

function IconButton({
  label,
  onClick,
  className,
  dataActionTrigger = false,
  dataHeaderActionTrigger = false,
  ariaExpanded,
  ariaControls,
  children,
}: {
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  dataActionTrigger?: boolean;
  dataHeaderActionTrigger?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      data-level-action-trigger={dataActionTrigger ? "true" : undefined}
      data-header-action-trigger={dataHeaderActionTrigger ? "true" : undefined}
      className={cn("h-8 w-8 rounded-lg px-0 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2", className)}
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0">
        {children}
      </span>
    </Button>
  );
}

function SaveBadge({ state, lastSavedAt, compact = false }: { state: SaveState; lastSavedAt: number | null; compact?: boolean }) {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    if (!lastSavedAt) return;

    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [lastSavedAt]);

  return (
    <SaveStateBadge
      state={state}
      lastSavedLabel={formatLastSavedLabel(lastSavedAt, currentTime)}
      compact={compact}
      bordered
      className={compact ? "min-w-[116px]" : "min-w-[132px]"}
    />
  );
}

function LevelActionMenuButton({
  label,
  onClick,
  icon,
  className,
}: {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1", className)}
    >
      {icon ? <span className="shrink-0 text-slate-400">{icon}</span> : null}
      {label}
    </button>
  );
}

function focusMenuItem(container: HTMLDivElement | null, index: number) {
  if (!container) return;
  const items = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  items[index]?.focus();
}

function handleMenuArrowNavigation(event: KeyboardEvent, container: HTMLDivElement | null) {
  if (!container) return false;

  const items = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
  if (items.length === 0) return false;

  const currentIndex = Math.max(
    0,
    items.findIndex((item) => item === document.activeElement),
  );

  if (event.key === "ArrowDown") {
    event.preventDefault();
    focusMenuItem(container, Math.min(currentIndex + 1, items.length - 1));
    return true;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    focusMenuItem(container, Math.max(currentIndex - 1, 0));
    return true;
  }

  if (event.key === "Home") {
    event.preventDefault();
    focusMenuItem(container, 0);
    return true;
  }

  if (event.key === "End") {
    event.preventDefault();
    focusMenuItem(container, items.length - 1);
    return true;
  }

  return false;
}

function SummaryRow({ label, value, currency, compact = false }: { label: string; value: number; currency: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between bg-slate-50", compact ? "rounded-md px-3 py-2" : "rounded-2xl px-4 py-3")}>
      <p className={cn("text-slate-500", compact ? "text-xs" : "text-sm")}>{label}</p>
      <AnimatedCurrencyValue value={value} currency={currency} className="justify-end px-0 py-0 font-semibold text-slate-900" />
    </div>
  );
}

function RateField({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn(compact ? "space-y-1.5" : "space-y-2")}>
      <p className={cn("font-medium text-slate-700", compact ? "text-xs" : "text-sm")}>{label}</p>
      <Input
        type="number"
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={compact ? "h-8 rounded-sm border-slate-300 px-2 text-xs shadow-none" : undefined}
      />
    </div>
  );
}

function PastePreviewSheet({
  pendingPaste,
  onClose,
  onConfirm,
  onModeChange,
  onApplyModeChange,
  onLevelTypeChange,
  onApplySuggestion,
}: {
  pendingPaste: PendingPaste | null;
  onClose: () => void;
  onConfirm: () => void;
  onModeChange: (mode: BudgetPasteMode) => void;
  onApplyModeChange: (mode: BudgetPasteApplyMode) => void;
  onLevelTypeChange: (entryIndex: number, levelType: BudgetLevelType) => void;
  onApplySuggestion: (sourceRowIndex: number, partidaId: string) => void;
}) {
  const { isExcelMode } = useBudgetViewMode();
  const popupContainerRef = useRef<HTMLDivElement | null>(null);
  const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);

  const handlePopupContainerRef = useCallback((element: HTMLDivElement | null) => {
    popupContainerRef.current = element;
    setPopupContainer(element);
  }, []);

  if (!pendingPaste) return null;

  const previewRows = getPastePreviewRows(pendingPaste);
  const targetLabel = pendingPaste.targetRow.kind === "level" ? "nivel" : "partida";
  const issueMap = groupPasteIssuesByRow(pendingPaste.guidedPaste.issues);
  const applyModeOptions =
    pendingPaste.targetRow.kind === "level"
      ? [{ value: "insert-inside-level", label: "Insertar dentro del nivel" }]
      : [
          { value: "insert-below", label: "Insertar debajo" },
          { value: "replace-current", label: "Reemplazar fila actual" },
        ];

  return (
    <div className={cn("fixed inset-0 z-50 bg-slate-950/30", isExcelMode ? "backdrop-blur-0" : "backdrop-blur-sm")}>
      <div
        ref={handlePopupContainerRef}
        className={cn(
          "relative mx-auto mt-10 w-[min(960px,calc(100%-2rem))] overflow-hidden border border-slate-200 bg-white",
          isExcelMode ? "rounded-md border-slate-300 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.18)]" : "rounded-3xl shadow-2xl",
        )}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm text-slate-500">Previsualización de pegado</p>
            <h3 className="text-2xl font-semibold text-slate-900">Revisa antes de importar</h3>
            <p className="mt-1 text-sm text-slate-500">
              Destino: {targetLabel} desde columna <span className="font-medium text-slate-700">{pendingPaste.startColumn}</span>
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>

        <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 md:grid-cols-3">
          <PreviewStat label="Modo detectado" value={pasteModeLabel[pendingPaste.guidedPaste.detectedMode]} />
          <PreviewStat label="Niveles" value={String(pendingPaste.guidedPaste.importedLevels)} />
          <PreviewStat label="Partidas" value={String(pendingPaste.guidedPaste.importedItems)} />
        </div>

        <div className="grid gap-4 border-b border-slate-200 px-6 py-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Modo de importación</span>
            <Select
              value={pendingPaste.guidedPaste.selectedMode}
              onChange={(event) => onModeChange(event.target.value as BudgetPasteMode)}
              className="h-10 w-full rounded-xl"
              portal
              portalContainer={popupContainer ?? undefined}
              contentPosition="popper"
              contentSideOffset={4}
              contentClassName="w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] max-w-[min(32rem,var(--radix-select-trigger-width))]"
              disableBodyScrollLockCompensation
            >
              <option value="flat">Plano</option>
              <option value="structured-by-code">Jerárquico por código</option>
              <option value="structured-by-indent">Jerárquico por indentación</option>
            </Select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Acción al aplicar</span>
            <Select
              value={pendingPaste.guidedPaste.applyMode}
              onChange={(event) => onApplyModeChange(event.target.value as BudgetPasteApplyMode)}
              className="h-10 w-full rounded-xl"
              portal
              portalContainer={popupContainer ?? undefined}
              contentPosition="popper"
              contentSideOffset={4}
              contentClassName="w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] max-w-[min(24rem,var(--radix-select-trigger-width))]"
              disableBodyScrollLockCompensation
            >
              {applyModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="max-h-[52vh] overflow-auto px-6 py-5">
          <div className={getTableFrameClassName(isExcelMode)}>
            <Table className="table-fixed w-full">
              <colgroup>
                <col className="w-[150px]" />
                <col className="w-[84px]" />
                <col className="w-[376px]" />
                <col className="w-[90px]" />
                <col className="w-[110px]" />
              </colgroup>
              <THead>
                <TR className="bg-slate-50 hover:bg-slate-50">
                  <TH>Tipo</TH>
                  <TH>Código</TH>
                  <TH>Descripción</TH>
                  <TH className="text-center">Unidad</TH>
                  <TH className="text-right">Metrado</TH>
                </TR>
              </THead>
              <TBody>
                {previewRows.map((row, index) => (
                  <TR key={`${row.kind}-${index}`} className={row.kind === "level" ? "bg-slate-50/80" : ""}>
                    <TD className="py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {row.kind === "level" && row.entryIndex !== undefined ? (
                        <div className="min-w-0 space-y-1 normal-case tracking-normal">
                          <Select
                            value={resolvePreviewLevelTypeValue(row.levelType)}
                            onChange={(event) => onLevelTypeChange(row.entryIndex ?? 0, event.target.value as BudgetLevelType)}
                            className="h-8 w-full min-w-0 max-w-full rounded-lg px-2 text-xs"
                            portal
                            portalContainer={popupContainer ?? undefined}
                            contentPosition="popper"
                            contentSideOffset={4}
                            contentClassName="w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)]"
                            disableBodyScrollLockCompensation
                          >
                            <option value="TITLE">Título</option>
                            <option value="SUBTITLE">Subtítulo</option>
                            <option value="ITEM_GROUP">Subpartida</option>
                          </Select>
                          {pendingPaste.guidedPaste.selectedMode === "structured-by-indent" && !row.code ? (
                            <p className="text-[11px] text-slate-500">
                              {getPatternInferenceLabel(previewRows, index)}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        row.kind === "level" ? row.levelType : "Partida"
                      )}
                    </TD>
                    <TD className="py-2 text-sm text-slate-600">{row.code ?? "-"}</TD>
                    <TD className="py-2">
                      <div className="space-y-1">
                        <div className="truncate text-sm text-slate-800" style={{ paddingLeft: `${row.depth * 18}px` }}>
                          {row.description}
                        </div>
                        {row.kind === "item" && row.itemMatch ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                                  row.itemMatch.matchKind === "exact"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : row.itemMatch.matchKind === "suggested"
                                      ? "bg-sky-100 text-sky-700"
                                      : "bg-slate-100 text-slate-600",
                                )}
                              >
                                {row.itemMatch.matchKind === "exact"
                                  ? "Match exacto"
                                  : row.itemMatch.matchKind === "suggested"
                                    ? "Sugerencia disponible"
                                    : "Sin match claro"}
                              </span>
                              {row.itemMatch.isSuggestionApplied ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                  Sugerencia aplicada
                                </span>
                              ) : null}
                            </div>
                            {row.itemMatch.bestSuggestion ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                <p className="font-medium text-slate-700">Sugerencia recomendada</p>
                                <p className="mt-1 text-sm text-slate-900">{row.itemMatch.bestSuggestion.description}</p>
                                <p className="mt-1">
                                  {row.itemMatch.bestSuggestion.unit} ·{" "}
                                  {formatCurrency(row.itemMatch.bestSuggestion.unitPrice, "PEN", 2)}
                                </p>
                                {row.itemMatch.matchKind === "suggested" ? (
                                  <div className="mt-2 flex gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={row.itemMatch.isSuggestionApplied ? "secondary" : "outline"}
                                      onClick={() => onApplySuggestion(row.sourceRowIndex, row.itemMatch?.bestSuggestion?.id ?? "")}
                                    >
                                      {row.itemMatch.isSuggestionApplied ? "Quitar sugerencia" : "Aplicar sugerencia"}
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {issueMap.get(row.sourceRowIndex)?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {issueMap.get(row.sourceRowIndex)?.map((issue, issueIndex) => (
                              <span
                                key={`${row.sourceRowIndex}-${issueIndex}`}
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                                  issue.severity === "error"
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-amber-100 text-amber-700",
                                )}
                              >
                                {issue.severity === "error" ? "Error" : "Aviso"}: {issue.message}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </TD>
                    <TD className="py-2 text-center text-sm text-slate-600">{row.unit ?? "-"}</TD>
                    <TD className="py-2 text-right text-sm tabular-nums text-slate-700">{row.quantity ?? "-"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          {previewRows.length === 0 ? <p className="text-sm text-slate-500">No hay filas para mostrar.</p> : null}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">
            {pendingPaste.guidedPaste.hasErrors
              ? "Corrige los errores del bloque o cambia el modo antes de importar."
              : "Solo se aplicará al confirmar."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Seguir revisando después
            </Button>
            <Button onClick={onConfirm} disabled={pendingPaste.guidedPaste.hasErrors}>
              Confirmar importación
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  const { isExcelMode } = useBudgetViewMode();

  return (
    <div className={cn("border border-slate-200 bg-white px-4 py-3", isExcelMode ? "rounded-md border-slate-300" : "rounded-2xl")}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function resolvePreviewLevelTypeValue(levelType: string | undefined): BudgetLevelType {
  if (levelTypeLabel.TITLE === levelType) return "TITLE";
  if (levelTypeLabel.SUBTITLE === levelType) return "SUBTITLE";
  if (levelTypeLabel.ITEM_GROUP === levelType) return "ITEM_GROUP";
  return "TITLE";
}

function CatalogInsertSheet({
  open,
  query,
  suggestions,
  selectedIds,
  target,
  onClose,
  onQueryChange,
  onToggleSelect,
  onSelect,
  onInsertSelected,
}: {
  open: boolean;
  query: string;
  suggestions: CatalogPartidaRecord[];
  selectedIds: string[];
  target: InsertTarget | null;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onToggleSelect: (partidaId: string) => void;
  onSelect: (partida: CatalogPartidaRecord) => void;
  onInsertSelected: () => void;
}) {
  const { isExcelMode } = useBudgetViewMode();
  const { currencyDecimals } = useFormattingSettings();

  if (!open || !target) return null;

  return (
    <div className={cn("fixed inset-0 z-[95] bg-slate-950/30", isExcelMode ? "backdrop-blur-0" : "backdrop-blur-sm")}>
      <div className={cn("mx-auto mt-10 w-[min(1080px,calc(100%-2rem))] overflow-hidden border border-slate-200 bg-white", isExcelMode ? "rounded-md border-slate-300 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.18)]" : "rounded-3xl shadow-2xl")}>
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm text-slate-500">Insertar desde catálogo</p>
            <h3 className="text-2xl font-semibold text-slate-900">Selecciona una partida base</h3>
            <p className="mt-1 text-sm text-slate-500">Destino: {target.kind === "level" ? "nivel" : "partida"}.</p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Input
              placeholder="Buscar por partida, unidad o rendimiento"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="max-w-2xl"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{selectedIds.length} seleccionadas</span>
              <Button variant="outline" onClick={() => onQueryChange("")}>
                Limpiar filtro
              </Button>
              <Button onClick={onInsertSelected} disabled={selectedIds.length === 0}>
                Insertar seleccionadas
              </Button>
            </div>
          </div>
        </div>

        <div className="max-h-[62vh] overflow-auto px-6 py-5">
          <div className={getTableFrameClassName(isExcelMode)}>
            <Table className="table-fixed w-full">
              <colgroup>
                <col className="w-[58px]" />
                <col className="w-[52%]" />
                <col className="w-[90px]" />
                <col className="w-[140px]" />
                <col className="w-[170px]" />
                <col className="w-[84px]" />
              </colgroup>
              <THead>
                <TR className="bg-slate-50 hover:bg-slate-50">
                  <TH className="text-center">Sel.</TH>
                  <TH>Partida</TH>
                  <TH className="text-center">Unidad</TH>
                  <TH className="text-right">P. Unitario</TH>
                  <TH>Rendimiento</TH>
                  <TH className="text-right">Acción</TH>
                </TR>
              </THead>
              <TBody>
                {suggestions.map((partida) => (
                  <TR key={partida.id}>
                    <TD className="py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(partida.id)}
                        onChange={() => onToggleSelect(partida.id)}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                    </TD>
                    <TD className="py-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{partida.description}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{partida.apuRows.length} insumos en APU</p>
                      </div>
                    </TD>
                    <TD className="py-2 text-center text-sm text-slate-700">{partida.unit}</TD>
                    <TD className="py-2 text-right text-sm font-medium tabular-nums text-slate-900">
                      {formatNumber(partida.unitPrice, currencyDecimals)}
                    </TD>
                    <TD className="py-2 text-sm text-slate-600">{partida.performanceRate ?? `${partida.performance} ${partida.unit}/DÍA`}</TD>
                    <TD className="py-2 text-right">
                      <Button size="sm" onClick={() => onSelect(partida)}>
                        Insertar
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          {suggestions.length === 0 ? <p className="mt-4 text-sm text-slate-500">No se encontraron partidas para ese filtro.</p> : null}
        </div>
      </div>
    </div>
  );
}

function ExcelImportSheet({
  open,
  target,
  value,
  fileName,
  loading,
  onChange,
  onClose,
  onConfirm,
  onFileSelect,
}: {
  open: boolean;
  target: InsertTarget | null;
  value: string;
  fileName: string;
  loading: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onFileSelect: (file: File) => Promise<void>;
}) {
  const { isExcelMode } = useBudgetViewMode();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open || !target) return null;

  return (
    <div className={cn("fixed inset-0 z-[95] bg-slate-950/30", isExcelMode ? "backdrop-blur-0" : "backdrop-blur-sm")}>
      <div className={cn("mx-auto mt-10 w-[min(980px,calc(100%-2rem))] overflow-hidden border border-slate-200 bg-white", isExcelMode ? "rounded-md border-slate-300 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.18)]" : "rounded-3xl shadow-2xl")}>
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm text-slate-500">Importación desde Excel</p>
            <h3 className="text-2xl font-semibold text-slate-900">Pega subpartidas y partidas</h3>
            <p className="mt-1 text-sm text-slate-500">
              Destino: {target.kind === "level" ? "nivel" : "partida"}. Puedes pegar columnas tipo código, descripción, unidad y metrado.
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className={cn("border border-dashed border-slate-300 bg-slate-50 px-4 py-4", isExcelMode ? "rounded-md" : "rounded-2xl")}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Cargar archivo Excel</p>
                <p className="mt-1 text-sm text-slate-500">Acepta `.xlsx`, `.xls`, `.csv` o `.tsv`.</p>
                {fileName ? <p className="mt-1 text-xs text-sky-700">Archivo cargado: {fileName}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void onFileSelect(file);
                    event.currentTarget.value = "";
                  }}
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                  {loading ? "Leyendo archivo..." : "Seleccionar archivo"}
                </Button>
              </div>
            </div>
          </div>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={"Pega aquí el bloque desde Excel...\n01\tOBRAS PRELIMINARES\n01.01\tLIMPIEZA DE TERRENO\tM2\t120.00"}
            className={cn(
              "min-h-[320px] w-full border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200",
              isExcelMode ? "rounded-md border-slate-300 shadow-none" : "rounded-2xl shadow-sm",
            )}
          />
          <div className={cn("border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600", isExcelMode ? "rounded-md border-slate-300" : "rounded-2xl")}>
            El sistema detecta jerarquía cuando pegas códigos como <span className="font-medium text-slate-800">01</span>, <span className="font-medium text-slate-800">01.01</span>, <span className="font-medium text-slate-800">01.01.01</span> o cuando la descripción viene indentada.
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">Se abrirá una previsualización antes de importar.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={onConfirm} disabled={!value.trim()}>
              Revisar importación
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClearSubBudgetDialog({
  open,
  levelsCount,
  itemsCount,
  onClose,
  onConfirm,
}: {
  open: boolean;
  levelsCount: number;
  itemsCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { isExcelMode } = useBudgetViewMode();

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn("fixed inset-0 z-[96] bg-slate-950/30", isExcelMode ? "backdrop-blur-0" : "backdrop-blur-sm")} />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[97] w-[min(560px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-slate-200 bg-white outline-none",
            isExcelMode ? "rounded-md border-slate-300 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.18)]" : "rounded-3xl shadow-2xl",
          )}
          data-testid="clear-sub-budget-dialog"
        >
          <div className="border-b border-slate-200 px-6 py-5">
            <Dialog.Title asChild>
              <h3 className="text-2xl font-semibold text-slate-900">Limpiar sub presupuesto</h3>
            </Dialog.Title>
            <Dialog.Description asChild>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Se eliminarán todas las filas insertadas en este sub presupuesto, incluyendo títulos, subtítulos, subpartidas y partidas.
              </p>
            </Dialog.Description>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className={cn("grid gap-3 sm:grid-cols-2", isExcelMode ? "" : "")}>
              <PreviewStat label="Niveles a eliminar" value={String(levelsCount)} />
              <PreviewStat label="Partidas a eliminar" value={String(itemsCount)} />
            </div>
            <div className={cn("border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700", isExcelMode ? "rounded-md" : "rounded-2xl")}>
              Esta acción vacía la estructura visible del sub presupuesto actual. Luego podrás guardar o dejar que el autosave persista el cambio.
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onConfirm}>
              Sí, eliminar todo
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function buildBudgetStatePatch(
  previous: BudgetRecord & { totals: BudgetTotals },
  current: BudgetRecord & { totals: BudgetTotals },
): BudgetStatePatch | null {
  const levelPatch = buildEntityPatch(previous.levels, current.levels);
  const itemPatch = buildEntityPatch(previous.items, current.items);
  const budgetChanges = getBudgetFieldChanges(previous, current);

  if (
    Object.keys(budgetChanges).length === 0 &&
    levelPatch.create.length === 0 &&
    levelPatch.update.length === 0 &&
    levelPatch.delete.length === 0 &&
    itemPatch.create.length === 0 &&
    itemPatch.update.length === 0 &&
    itemPatch.delete.length === 0
  ) {
    return null;
  }

  return {
    budget: budgetChanges,
    levels: levelPatch,
    items: itemPatch,
  };
}

function findIncompleteApuResourceRow(budget: BudgetRecord & { totals: BudgetTotals }) {
  return budget.items.find((item) =>
    item.apu?.resources.some((resource) => resource.resourceId.trim().length === 0),
  );
}

function buildEntityPatch<T extends { id: string }>(previous: T[], current: T[]) {
  const previousById = new Map(previous.map((entity) => [entity.id, entity]));
  const currentById = new Map(current.map((entity) => [entity.id, entity]));

  const create = current.filter((entity) => !previousById.has(entity.id));

  const update = current.flatMap((entity) => {
    const previousEntity = previousById.get(entity.id);
    if (!previousEntity) return [];

    const changes = getChangedFields(previousEntity, entity);
    return Object.keys(changes).length > 0 ? [{ id: entity.id, changes }] : [];
  });

  const deleteIds = previous.filter((entity) => !currentById.has(entity.id)).map((entity) => entity.id);

  return { create, update, delete: deleteIds };
}

function getBudgetFieldChanges(
  previous: BudgetRecord & { totals: BudgetTotals },
  current: BudgetRecord & { totals: BudgetTotals },
) {
  return getChangedFields(
    {
      name: previous.name,
      currency: previous.currency,
      igvRate: previous.igvRate,
      generalExpensesRate: previous.generalExpensesRate,
      utilityRate: previous.utilityRate,
      totalDirectCost: previous.totalDirectCost,
      totalGeneralExpenses: previous.totalGeneralExpenses,
      totalUtility: previous.totalUtility,
      totalTax: previous.totalTax,
      totalAmount: previous.totalAmount,
    },
    {
      name: current.name,
      currency: current.currency,
      igvRate: current.igvRate,
      generalExpensesRate: current.generalExpensesRate,
      utilityRate: current.utilityRate,
      totalDirectCost: current.totalDirectCost,
      totalGeneralExpenses: current.totalGeneralExpenses,
      totalUtility: current.totalUtility,
      totalTax: current.totalTax,
      totalAmount: current.totalAmount,
    },
  );
}

function getChangedFields<T extends Record<string, unknown>>(previous: T, current: T): Partial<T> {
  const changes: Partial<T> = {};

  for (const key of Object.keys(current) as Array<keyof T>) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
      changes[key] = current[key];
    }
  }

  return changes;
}

function formatLastSavedLabel(lastSavedAt: number | null, currentTime: number) {
  if (!lastSavedAt) return null;

  const seconds = Math.max(0, Math.floor((currentTime - lastSavedAt) / 1000));
  if (seconds < 60) {
    return `Último guardado hace ${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Último guardado hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }

  const hours = Math.floor(minutes / 60);
  return `Último guardado hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
}

function getDefaultLevelName(type: BudgetLevelType) {
  if (type === "TITLE") return "Nuevo título";
  if (type === "SUBTITLE") return "Nuevo subtítulo";
  if (type === "ITEM_GROUP") return "Nueva subpartida";
  return "Nuevo subitem";
}

function createLevelCode(levels: BudgetLevelRecord[], parentId: string | null, fallback: number) {
  if (!parentId) {
    const rootCount = levels.filter((level) => !level.parentId).length + 1;
    return `${rootCount}`.padStart(2, "0");
  }

  const parent = levels.find((level) => level.id === parentId);
  if (!parent) {
    return `${fallback}`;
  }

  const siblingCount = levels.filter((level) => level.parentId === parentId).length + 1;
  return `${parent.code}.${String(siblingCount).padStart(2, "0")}`;
}

function collectDescendantLevelIds(levels: BudgetLevelRecord[], parentId: string): string[] {
  const children = levels.filter((level) => level.parentId === parentId);
  return children.flatMap((child) => [child.id, ...collectDescendantLevelIds(levels, child.id)]);
}

function getLevelRowTone(type: BudgetLevelType, isExcelMode = false) {
  if (type === "TITLE") return "bg-slate-50";
  if (type === "SUBTITLE") return isExcelMode ? "bg-sky-50/50" : "bg-sky-50/60";
  return isExcelMode ? "bg-amber-50/50" : "bg-amber-50/70";
}

function getStickyActionTone(type: BudgetLevelType, isExcelMode = false) {
  if (type === "TITLE") return "bg-slate-50";
  if (type === "SUBTITLE") return isExcelMode ? "bg-sky-50/50" : "bg-sky-50/60";
  return isExcelMode ? "bg-amber-50/50" : "bg-amber-50/70";
}

function getInputDensityClass(mode: DensityMode, isExcelMode = false) {
  if (isExcelMode) return "h-8 rounded-sm border-slate-300 px-2 text-xs shadow-none";
  return mode === "compact" ? "h-8 rounded-lg px-2 text-xs" : "h-9 rounded-xl px-3 text-sm";
}

function getCellPadding(mode: DensityMode) {
  return mode === "compact" ? "py-1.5" : "py-3";
}

function createBudgetItemDraft(
  budget: BudgetRecord,
  options?: {
    levelId?: string | null;
    overrides?: Partial<BudgetItemRecord>;
    sortOrder?: number;
  },
): BudgetItemRecord {
  const code = options?.overrides?.code?.trim() ? options.overrides.code : `IT-${options?.sortOrder ?? budget.items.length + 1}`;
  const unit = options?.overrides?.unit?.trim() ? options.overrides.unit : "m2";

  return {
    id: crypto.randomUUID(),
    budgetId: budget.id,
    levelId: options?.levelId ?? null,
    code,
    description: options?.overrides?.description ?? "Nueva partida",
    unit,
    quantity: options?.overrides?.quantity ?? 0,
    unitPrice: options?.overrides?.unitPrice ?? 0,
    partial: 0,
    sortOrder: options?.sortOrder ?? budget.items.length + 1,
    apu: {
      id: crypto.randomUUID(),
      budgetItemId: "",
      name: "Nuevo APU",
      unit,
      performance: 1,
      totalUnitCost: 0,
      resources: [],
    },
  };
}

function ensureBudgetItemApu(item: BudgetItemRecord): BudgetItemRecord {
  if (item.apu) return item;

  return {
    ...item,
    apu: {
      id: `apu-${item.id}`,
      budgetItemId: item.id,
      name: item.description || "Nuevo APU",
      unit: item.unit,
      performance: 1,
      totalUnitCost: 0,
      resources: [],
    },
  };
}

function applyPastedValuesToItem(item: BudgetItemRecord, row: PastedItemRow): BudgetItemRecord {
  const nextUnit = row.unit !== undefined ? row.unit : item.unit;

  return {
    ...item,
    ...row,
    unit: nextUnit,
    apu: item.apu
      ? {
          ...item.apu,
          unit: nextUnit,
        }
      : item.apu,
  };
}

function importStructuredPaste(
  current: BudgetRecord & { totals: BudgetTotals },
  targetRow: BudgetDisplayRow,
  entries: BudgetPasteStructuredEntry[],
  createItem: (
    levelId: string | null,
    values: PastedItemRow,
    sortOrder: number,
    entryIndex: number,
    sourceRowIndex: number,
  ) => BudgetItemRecord,
) {
  const nextLevels = [...current.levels];
  const nextItems = [...current.items];
  let nextLevelSort = nextLevels.reduce((max, level) => Math.max(max, level.sortOrder), 0) + 1;
  let nextItemSort = nextItems.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;

  const baseParentId = targetRow.kind === "level" ? targetRow.level.id : targetRow.item.levelId ?? null;
  const baseParentDepth = baseParentId ? getLevelDepth(current.levels, baseParentId) + 1 : 0;
  const minDepth = Math.min(...entries.map((entry) => (entry.kind === "level" ? entry.depth : entry.parentDepth)));
  const levelStack = new Map<number, string | null>();
  const importedLevelCountsByDepth = new Map<number, number>();

  for (const [entryIndex, entry] of entries.entries()) {
    if (entry.kind === "level") {
      const normalizedDepth = entry.depth - minDepth;
      const absoluteDepth = baseParentDepth + normalizedDepth;
      const parentId = normalizedDepth === 0 ? baseParentId : levelStack.get(absoluteDepth - 1) ?? baseParentId;
      const levelType = entry.levelType ?? getImportedLevelType(normalizedDepth, importedLevelCountsByDepth.get(normalizedDepth) ?? 0);
      const level: BudgetLevelRecord = {
        id: crypto.randomUUID(),
        budgetId: current.id,
        parentId,
        type: levelType,
        code: entry.code?.trim() || createLevelCode(nextLevels, parentId, nextLevelSort),
        name: entry.name,
        sortOrder: nextLevelSort++,
      };

      nextLevels.push(level);
      levelStack.set(absoluteDepth, level.id);
      importedLevelCountsByDepth.set(normalizedDepth, (importedLevelCountsByDepth.get(normalizedDepth) ?? 0) + 1);
      clearDeeperLevels(levelStack, absoluteDepth);
      continue;
    }

    const normalizedParentDepth = entry.parentDepth - minDepth;
    const absoluteParentDepth = baseParentDepth + normalizedParentDepth;
    const levelId = levelStack.get(absoluteParentDepth) ?? baseParentId ?? null;

    nextItems.push(createItem(levelId, entry.values, nextItemSort++, entryIndex, entry.sourceRowIndex));
  }

  return {
    ...current,
    levels: normalizeSortOrders(nextLevels),
    items: normalizeItemSortOrders(nextItems),
  };
}

const BudgetLevelTableRow = memo(function BudgetLevelTableRow({
  row,
  densityMode,
  isExcelMode,
  activeRowId,
  activeColumn,
  isDragging,
  isActionAddOpen,
  isActionMoreOpen,
  onDragStart,
  onDragEnd,
  onDropRow,
  onRowFocus,
  onCellFocus,
  onUpdateLevel,
  onSetCellRef,
  onNavigate,
  onPasteRows,
  onToggleLevelActionMenu,
}: {
  row: Extract<BudgetDisplayRow, { kind: "level" }>;
  densityMode: DensityMode;
  isExcelMode: boolean;
  activeRowId: string | null;
  activeColumn: ActiveColumn;
  isDragging: boolean;
  isActionAddOpen: boolean;
  isActionMoreOpen: boolean;
  onDragStart: React.Dispatch<React.SetStateAction<DragState>>;
  onDragEnd: () => void;
  onDropRow: (row: BudgetDisplayRow) => void;
  onRowFocus: (rowId: string) => void;
  onCellFocus: (rowId: string, column: ActiveColumn) => void;
  onUpdateLevel: (levelId: string, patch: Partial<BudgetLevelRecord>) => void;
  onSetCellRef: (rowId: string, column: EditableColumn, element: HTMLInputElement | null) => void;
  onNavigate: (event: React.KeyboardEvent<HTMLInputElement>, rowId: string, column: EditableColumn) => void;
  onPasteRows: (event: React.ClipboardEvent<HTMLInputElement>, targetRow: BudgetDisplayRow, startColumn: EditableColumn) => void;
  onToggleLevelActionMenu: (rowId: string, kind: "add" | "more", trigger: HTMLElement) => void;
}) {
  return (
    <TR
      data-budget-row-id={row.level.id}
      draggable
      onDragStart={() => onDragStart({ kind: "level", id: row.level.id })}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={() => onDropRow(row)}
      onDragEnd={onDragEnd}
      onFocusCapture={() => onRowFocus(row.level.id)}
      className={cn(
        "group hover:bg-transparent",
        getLevelRowTone(row.level.type, isExcelMode),
        isDragging ? "scale-[0.995] opacity-60 ring-2 ring-sky-300" : "",
        activeRowId === row.level.id ? (isExcelMode ? "bg-sky-50/80 ring-1 ring-sky-200" : "ring-2 ring-sky-200") : "",
      )}
    >
      <TD className={getBodyCellClass("code", activeColumn, "align-[initial]", densityMode, isExcelMode)}>
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 cursor-grab text-slate-400" />
          <BufferedInput
            value={row.level.code}
            onCommit={(value) => onUpdateLevel(row.level.id, { code: value })}
            className={getInputDensityClass(densityMode, isExcelMode)}
            ref={(element) => onSetCellRef(row.level.id, "code", element)}
            onKeyDown={(event) => onNavigate(event, row.level.id, "code")}
            onPaste={(event) => onPasteRows(event, row, "code")}
            onFocus={() => onCellFocus(row.level.id, "code")}
          />
        </div>
      </TD>
      <TD className={getBodyCellClass("description", activeColumn, "align-[initial]", densityMode, isExcelMode)}>
        <div className="flex items-center gap-3" style={{ paddingLeft: `${row.depth * 18}px` }}>
          <BufferedInput
            value={row.level.name}
            onCommit={(value) => onUpdateLevel(row.level.id, { name: value })}
            className={cn(getInputDensityClass(densityMode, isExcelMode), "flex-1")}
            ref={(element) => onSetCellRef(row.level.id, "description", element)}
            onKeyDown={(event) => onNavigate(event, row.level.id, "description")}
            onPaste={(event) => onPasteRows(event, row, "description")}
            onFocus={() => onCellFocus(row.level.id, "description")}
          />
          <span
            className={cn(
              "shrink-0 bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600",
              isExcelMode ? "rounded-sm border border-slate-200" : "rounded-full",
            )}
          >
            {levelTypeLabel[row.level.type]}
          </span>
        </div>
      </TD>
      <TD className={getBodyCellClass("unit", activeColumn, "", densityMode, isExcelMode)} colSpan={4} />
      <TD
        className={cn(
          getBodyCellClass("actions", activeColumn, "sticky right-0 align-[initial]", densityMode, isExcelMode),
          getStickyActionTone(row.level.type, isExcelMode),
        )}
      >
        <div className="ml-auto flex justify-end gap-1 px-1 py-0.5 opacity-80 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            data-level-action-trigger
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            onClick={(event) => onToggleLevelActionMenu(row.level.id, "add", event.currentTarget)}
            title="Agregar contenido debajo de este nivel"
            aria-label="Agregar contenido debajo de este nivel"
            aria-haspopup="menu"
            aria-expanded={isActionAddOpen}
            aria-controls={isActionAddOpen ? `budget-level-add-menu-${row.level.id}` : undefined}
          >
            <Plus className="h-4 w-4" />
          </button>
          <IconButton
            label="Abrir acciones del nivel"
            onClick={(event) => onToggleLevelActionMenu(row.level.id, "more", event.currentTarget)}
            dataActionTrigger
            ariaExpanded={isActionMoreOpen}
            ariaControls={isActionMoreOpen ? `budget-level-more-menu-${row.level.id}` : undefined}
          >
            <MoreHorizontal className="h-4 w-4" />
          </IconButton>
        </div>
      </TD>
    </TR>
  );
});

type BudgetItemTableRowProps = {
  row: Extract<BudgetDisplayRow, { kind: "item" }>;
  densityMode: DensityMode;
  isExcelMode: boolean;
  activeRowId: string | null;
  activeColumn: ActiveColumn;
  currency: BudgetRecord["currency"];
  isDragging: boolean;
  isActionOpen: boolean;
  isCatalogActive: boolean;
  catalogSuggestions: CatalogPartidaRecord[];
  catalogHighlightedIndex: number;
  onCatalogHighlightChange: React.Dispatch<React.SetStateAction<number>>;
  onDragStart: React.Dispatch<React.SetStateAction<DragState>>;
  onDragEnd: () => void;
  onDropRow: (row: BudgetDisplayRow) => void;
  onRowFocus: (rowId: string) => void;
  onCellFocus: (rowId: string, column: ActiveColumn) => void;
  onUpdateItem: (itemId: string, patch: Partial<BudgetItemRecord>) => void;
  onSetCellRef: (rowId: string, column: EditableColumn, element: HTMLInputElement | null) => void;
  onNavigate: (event: React.KeyboardEvent<HTMLInputElement>, rowId: string, column: EditableColumn) => void;
  onPasteRows: (event: React.ClipboardEvent<HTMLInputElement>, targetRow: BudgetDisplayRow, startColumn: EditableColumn) => void;
  onOpenCatalogSelector: (rowId: string, query?: string) => void;
  onCloseCatalogSelector: () => void;
  onScheduleCatalogClose: (rowId: string) => void;
  onApplyCatalogPartida: (itemId: string, partida: CatalogPartidaRecord) => void;
  onOpenApuSheet: (item: BudgetItemRecord) => void;
  onToggleItemActionMenu: (rowId: string, trigger: HTMLElement) => void;
  qualityState?: BudgetItemQualityState;
};

const BudgetItemTableRow = memo(function BudgetItemTableRow({
  row,
  densityMode,
  isExcelMode,
  activeRowId,
  activeColumn,
  currency,
  isDragging,
  isActionOpen,
  isCatalogActive,
  catalogSuggestions,
  catalogHighlightedIndex,
  onCatalogHighlightChange,
  onDragStart,
  onDragEnd,
  onDropRow,
  onRowFocus,
  onCellFocus,
  onUpdateItem,
  onSetCellRef,
  onNavigate,
  onPasteRows,
  onOpenCatalogSelector,
  onCloseCatalogSelector,
  onScheduleCatalogClose,
  onApplyCatalogPartida,
  onOpenApuSheet,
  onToggleItemActionMenu,
  qualityState,
}: BudgetItemTableRowProps) {
  const hasNoUsefulUnitPrice = row.item.unitPrice <= 0;
  const hasNoApu = !row.item.apu;
  const requiresCatalogReview = qualityState?.requiresCatalogReview ?? !row.item.apu;
  const itemWarningTone = hasNoUsefulUnitPrice
    ? isExcelMode
      ? "bg-rose-50/80 ring-1 ring-rose-200"
      : "bg-rose-50/70 ring-2 ring-rose-200"
    : requiresCatalogReview
      ? isExcelMode
        ? "bg-amber-50/80 ring-1 ring-amber-200"
        : "bg-amber-50/70 ring-2 ring-amber-200"
      : "";

  return (
    <TR
      data-budget-row-id={row.item.id}
      draggable
      onDragStart={() => onDragStart({ kind: "item", id: row.item.id })}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={() => onDropRow(row)}
      onDragEnd={onDragEnd}
      onFocusCapture={() => onRowFocus(row.item.id)}
      className={cn(
        "group",
        isExcelMode && "bg-white",
        isDragging ? "scale-[0.995] opacity-60 ring-2 ring-sky-300" : "",
        itemWarningTone,
        activeRowId === row.item.id ? (isExcelMode ? "bg-sky-50/80 ring-1 ring-sky-200" : "bg-sky-50/60 ring-2 ring-sky-200") : "",
      )}
    >
      <TD className={getBodyCellClass("code", activeColumn, "align-[initial]", densityMode, isExcelMode)}>
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 cursor-grab text-slate-400" />
          <BufferedInput
            value={row.item.code}
            onCommit={(value) => onUpdateItem(row.item.id, { code: value })}
            className={getInputDensityClass(densityMode, isExcelMode)}
            ref={(element) => onSetCellRef(row.item.id, "code", element)}
            onKeyDown={(event) => onNavigate(event, row.item.id, "code")}
            onPaste={(event) => onPasteRows(event, row, "code")}
            onFocus={() => onCellFocus(row.item.id, "code")}
          />
        </div>
      </TD>
      <TD className={getBodyCellClass("description", activeColumn, "align-[initial]", densityMode, isExcelMode)}>
        <div style={{ paddingLeft: `${row.depth * 18}px` }}>
          <div className="relative flex min-w-0 flex-wrap items-center gap-2 space-y-1">
            <div className="min-w-0 flex-1">
              <BufferedInput
                value={row.item.description}
                onCommit={(value) => onUpdateItem(row.item.id, { description: value })}
                onValueChange={(value) => {
                  onOpenCatalogSelector(row.item.id, value);
                }}
                syncWhileFocused
                className={cn(getInputDensityClass(densityMode, isExcelMode), "min-w-0")}
                ref={(element) => onSetCellRef(row.item.id, "description", element)}
                onKeyDown={(event) => {
                  if (isCatalogActive && catalogSuggestions.length > 0) {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      onCatalogHighlightChange((current) => Math.min(current + 1, catalogSuggestions.length - 1));
                      return;
                    }

                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      onCatalogHighlightChange((current) => Math.max(current - 1, 0));
                      return;
                    }

                    if (event.key === "Enter") {
                      event.preventDefault();
                      const selectedSuggestion = catalogSuggestions[catalogHighlightedIndex];
                      if (selectedSuggestion) {
                        onApplyCatalogPartida(row.item.id, selectedSuggestion);
                      }
                      return;
                    }
                  }

                  if (event.key === "Escape") {
                    onCloseCatalogSelector();
                    return;
                  }

                  onNavigate(event, row.item.id, "description");
                }}
                onPaste={(event) => onPasteRows(event, row, "description")}
                onFocus={() => {
                  onCellFocus(row.item.id, "description");
                  onOpenCatalogSelector(row.item.id, row.item.description);
                }}
                onBlur={() => onScheduleCatalogClose(row.item.id)}
              />
            </div>
            {hasNoApu ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                Sin APU
              </span>
            ) : null}
            {hasNoUsefulUnitPrice || requiresCatalogReview ? (
              <div className="flex flex-wrap gap-2">
                {hasNoUsefulUnitPrice ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">Sin PU</span>
                ) : null}
                {requiresCatalogReview && !hasNoApu ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    Revisar match
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </TD>
      <TD className={getBodyCellClass("unit", activeColumn, "align-[initial]", densityMode, isExcelMode)}>
        <BufferedInput
          value={row.item.unit}
          onCommit={(value) => onUpdateItem(row.item.id, { unit: value })}
          className={cn(getInputDensityClass(densityMode, isExcelMode), "text-center")}
          ref={(element) => onSetCellRef(row.item.id, "unit", element)}
          onKeyDown={(event) => onNavigate(event, row.item.id, "unit")}
          onPaste={(event) => onPasteRows(event, row, "unit")}
          onFocus={() => onCellFocus(row.item.id, "unit")}
        />
      </TD>
      <TD className={getBodyCellClass("quantity", activeColumn, "align-[initial]", densityMode, isExcelMode)}>
        <BufferedInput
          type="text"
          inputMode="decimal"
          value={row.item.quantity}
          onCommit={(value) => onUpdateItem(row.item.id, { quantity: parseSpreadsheetNumber(value) })}
          className={cn(getInputDensityClass(densityMode, isExcelMode), "text-right tabular-nums")}
          ref={(element) => onSetCellRef(row.item.id, "quantity", element)}
          onKeyDown={(event) => onNavigate(event, row.item.id, "quantity")}
          onPaste={(event) => onPasteRows(event, row, "quantity")}
          onFocus={() => onCellFocus(row.item.id, "quantity")}
        />
      </TD>
      <TD
        className={getBodyCellClass(
          "unitPrice",
          activeColumn,
          "align-[initial] whitespace-nowrap text-right text-xs font-medium tabular-nums text-slate-800",
          densityMode,
          isExcelMode,
        )}
      >
        <AnimatedCurrencyValue value={row.item.unitPrice} currency={currency} className="justify-end px-0 py-0 text-inherit" />
      </TD>
      <TD
        className={getBodyCellClass(
          "partial",
          activeColumn,
          "align-[initial] whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-900",
          densityMode,
          isExcelMode,
        )}
      >
        <AnimatedCurrencyValue value={row.item.partial} currency={currency} className="justify-end px-0 py-0 text-inherit" />
      </TD>
      <TD
        className={getBodyCellClass(
          "actions",
          activeColumn,
          cn("sticky right-0 align-[initial]", isExcelMode ? "bg-white/95" : "bg-white"),
          densityMode,
          isExcelMode,
        )}
      >
        <div className="ml-auto flex justify-end gap-1 px-1 py-0.5 opacity-80 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenApuSheet(row.item)}
            className="h-7 gap-1.5 rounded-full border border-slate-200 bg-white/85 px-2.5 text-[10px] font-medium tracking-[0.08em] text-slate-600 shadow-[0_10px_18px_-18px_rgba(15,23,42,0.25)] hover:border-slate-300 hover:bg-white"
            title="Abrir editor APU de esta partida"
            aria-label="Abrir editor APU de esta partida"
          >
            <ExternalLink className="h-4 w-4" />
            APU
          </Button>
          <IconButton
            label="Abrir acciones de la partida"
            onClick={(event) => onToggleItemActionMenu(row.item.id, event.currentTarget)}
            dataActionTrigger
            ariaExpanded={isActionOpen}
            ariaControls={isActionOpen ? `budget-item-menu-${row.item.id}` : undefined}
          >
            <MoreHorizontal className="h-4 w-4" />
          </IconButton>
        </div>
      </TD>
    </TR>
  );
}, areBudgetItemRowPropsEqual);

function areBudgetItemRowPropsEqual(
  previous: Readonly<BudgetItemTableRowProps>,
  current: Readonly<BudgetItemTableRowProps>,
) {
  return (
    previous.row === current.row &&
    previous.densityMode === current.densityMode &&
    previous.isExcelMode === current.isExcelMode &&
    previous.activeRowId === current.activeRowId &&
    previous.activeColumn === current.activeColumn &&
    previous.currency === current.currency &&
    previous.isDragging === current.isDragging &&
    previous.isActionOpen === current.isActionOpen &&
    previous.isCatalogActive === current.isCatalogActive &&
    previous.catalogSuggestions === current.catalogSuggestions &&
    previous.catalogHighlightedIndex === current.catalogHighlightedIndex &&
    previous.qualityState === current.qualityState
  );
}

function QualityStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "neutral" | "info";
}) {
  const toneClassName =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "info"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={cn("rounded-2xl border px-3 py-2", toneClassName)}>
      <p className="text-[11px] font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

const BudgetTableSection = memo(function BudgetTableSection({
  error,
  pasteFeedback,
  tableScrollRef,
  tableScrollProps,
  densityMode,
  isExcelMode,
  activeColumn,
  activeRowId,
  dragState,
  levelActionMenu,
  itemActionMenu,
  catalogSelectorRowId,
  catalogSuggestions,
  catalogHighlightedIndex,
  onCatalogHighlightChange,
  currency,
  totalAmount,
  virtualBudgetRange,
  onDragStart,
  onDragEnd,
  onDropRow,
  onRowFocus,
  onCellFocus,
  onUpdateLevel,
  onUpdateItem,
  onSetCellRef,
  onNavigate,
  onPasteRows,
  onToggleLevelActionMenu,
  onToggleItemActionMenu,
  onOpenCatalogSelector,
  onCloseCatalogSelector,
  onScheduleCatalogClose,
  onApplyCatalogPartida,
  onOpenApuSheet,
  itemQualityStateById,
}: {
  error: string;
  pasteFeedback: string;
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
  tableScrollProps: React.HTMLAttributes<HTMLDivElement>;
  densityMode: DensityMode;
  isExcelMode: boolean;
  activeColumn: ActiveColumn;
  activeRowId: string | null;
  dragState: DragState;
  levelActionMenu: LevelActionMenuState | null;
  itemActionMenu: ItemActionMenuState | null;
  catalogSelectorRowId: string | null;
  catalogSuggestions: CatalogPartidaRecord[];
  catalogHighlightedIndex: number;
  onCatalogHighlightChange: React.Dispatch<React.SetStateAction<number>>;
  currency: BudgetRecord["currency"];
  totalAmount: number;
  virtualBudgetRange: {
    visibleRows: BudgetDisplayRow[];
    topSpacerHeight: number;
    bottomSpacerHeight: number;
  };
  onDragStart: React.Dispatch<React.SetStateAction<DragState>>;
  onDragEnd: () => void;
  onDropRow: (row: BudgetDisplayRow) => void;
  onRowFocus: (rowId: string) => void;
  onCellFocus: (rowId: string, column: ActiveColumn) => void;
  onUpdateLevel: (levelId: string, patch: Partial<BudgetLevelRecord>) => void;
  onUpdateItem: (itemId: string, patch: Partial<BudgetItemRecord>) => void;
  onSetCellRef: (rowId: string, column: EditableColumn, element: HTMLInputElement | null) => void;
  onNavigate: (event: React.KeyboardEvent<HTMLInputElement>, rowId: string, column: EditableColumn) => void;
  onPasteRows: (event: React.ClipboardEvent<HTMLInputElement>, targetRow: BudgetDisplayRow, startColumn: EditableColumn) => void;
  onToggleLevelActionMenu: (rowId: string, kind: "add" | "more", trigger: HTMLElement) => void;
  onToggleItemActionMenu: (rowId: string, trigger: HTMLElement) => void;
  onOpenCatalogSelector: (rowId: string, query?: string) => void;
  onCloseCatalogSelector: () => void;
  onScheduleCatalogClose: (rowId: string) => void;
  onApplyCatalogPartida: (itemId: string, partida: CatalogPartidaRecord) => void;
  onOpenApuSheet: (item: BudgetItemRecord) => void;
  itemQualityStateById: Record<string, BudgetItemQualityState | undefined>;
}) {
  return (
    <CardContent className={cn("space-y-4", isExcelMode && "space-y-3")}>
      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {pasteFeedback ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{pasteFeedback}</p> : null}

      <div
        ref={tableScrollRef}
        data-testid="budget-table-surface"
        data-density-mode={densityMode}
        className={getTableFrameClassName(
          isExcelMode,
          cn("max-h-[72vh] overflow-auto", !isExcelMode ? "shadow-[0_18px_36px_-30px_rgba(15,23,42,0.22)]" : undefined),
        )}
        {...tableScrollProps}
      >
        <Table
          className={cn(
            "table-fixed min-w-[1100px] w-full",
            isExcelMode && "[&_td]:px-2 [&_th]:px-2 [&_tr]:border-b [&_tr]:border-slate-200",
          )}
        >
          <colgroup>
            <col className="w-[130px]" />
            <col className="w-[420px]" />
            <col className="w-[90px]" />
            <col className="w-[92px]" />
            <col className="w-[96px]" />
            <col className="w-[96px]" />
            <col className="w-[110px]" />
          </colgroup>
          <THead className={cn(isExcelMode && "[&_th]:bg-slate-100 [&_th]:text-[11px] [&_th]:font-semibold")}>
            <TR className={cn("hover:bg-slate-50", isExcelMode ? "bg-slate-100/90" : "bg-slate-50")}>
              <TH className={getHeaderCellClass("code", activeColumn, isExcelMode)}>Código</TH>
              <TH className={getHeaderCellClass("description", activeColumn, isExcelMode)}>Descripción</TH>
              <TH className={getHeaderCellClass("unit", activeColumn, isExcelMode, "text-center")}>Unidad</TH>
              <TH className={getHeaderCellClass("quantity", activeColumn, isExcelMode, "text-right")}>Metrado</TH>
              <TH className={getHeaderCellClass("unitPrice", activeColumn, isExcelMode, "text-right")}>P. Unitario</TH>
              <TH className={getHeaderCellClass("partial", activeColumn, isExcelMode, "text-right")}>Parcial</TH>
              <TH className={getHeaderCellClass("actions", activeColumn, isExcelMode, "right-0 text-right")}>
                <span className="inline-flex w-full items-center justify-end">
                  <MoreHorizontal className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <span className="sr-only">Acciones</span>
                </span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {virtualBudgetRange.topSpacerHeight > 0 ? (
              <TR aria-hidden="true" className="hover:bg-transparent focus-within:bg-transparent">
                <TD colSpan={BUDGET_TABLE_COLUMN_COUNT} className="p-0" style={{ height: virtualBudgetRange.topSpacerHeight }} />
              </TR>
            ) : null}
            {virtualBudgetRange.visibleRows.map((row) =>
              row.kind === "level" ? (
                <BudgetLevelTableRow
                  key={row.level.id}
                  row={row}
                  densityMode={densityMode}
                  isExcelMode={isExcelMode}
                  activeRowId={activeRowId}
                  activeColumn={activeColumn}
                  isDragging={dragState?.kind === "level" && dragState.id === row.level.id}
                  isActionAddOpen={levelActionMenu?.rowId === row.level.id && levelActionMenu.kind === "add"}
                  isActionMoreOpen={levelActionMenu?.rowId === row.level.id && levelActionMenu.kind === "more"}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDropRow={onDropRow}
                  onRowFocus={onRowFocus}
                  onCellFocus={onCellFocus}
                  onUpdateLevel={onUpdateLevel}
                  onSetCellRef={onSetCellRef}
                  onNavigate={onNavigate}
                  onPasteRows={onPasteRows}
                  onToggleLevelActionMenu={onToggleLevelActionMenu}
                />
              ) : (
                <BudgetItemTableRow
                  key={row.item.id}
                  row={row}
                  densityMode={densityMode}
                  isExcelMode={isExcelMode}
                  activeRowId={activeRowId}
                  activeColumn={activeColumn}
                  currency={currency}
                  isDragging={dragState?.kind === "item" && dragState.id === row.item.id}
                  isActionOpen={itemActionMenu?.rowId === row.item.id}
                  isCatalogActive={catalogSelectorRowId === row.item.id}
                  catalogSuggestions={catalogSelectorRowId === row.item.id ? catalogSuggestions : EMPTY_CATALOG_SUGGESTIONS}
                  catalogHighlightedIndex={catalogSelectorRowId === row.item.id ? catalogHighlightedIndex : 0}
                  onCatalogHighlightChange={onCatalogHighlightChange}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDropRow={onDropRow}
                  onRowFocus={onRowFocus}
                  onCellFocus={onCellFocus}
                  onUpdateItem={onUpdateItem}
                  onSetCellRef={onSetCellRef}
                  onNavigate={onNavigate}
                  onPasteRows={onPasteRows}
                  onOpenCatalogSelector={onOpenCatalogSelector}
                  onCloseCatalogSelector={onCloseCatalogSelector}
                  onScheduleCatalogClose={onScheduleCatalogClose}
                  onApplyCatalogPartida={onApplyCatalogPartida}
                  onOpenApuSheet={onOpenApuSheet}
                  onToggleItemActionMenu={onToggleItemActionMenu}
                  qualityState={itemQualityStateById[row.item.id]}
                />
              ),
            )}
            {virtualBudgetRange.bottomSpacerHeight > 0 ? (
              <TR aria-hidden="true" className="hover:bg-transparent focus-within:bg-transparent">
                <TD colSpan={BUDGET_TABLE_COLUMN_COUNT} className="p-0" style={{ height: virtualBudgetRange.bottomSpacerHeight }} />
              </TR>
            ) : null}
          </TBody>
        </Table>
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center justify-between border border-sky-100 bg-[linear-gradient(180deg,rgba(240,249,255,0.98)_0%,rgba(224,242,254,0.9)_100%)] shadow-[0_14px_30px_-26px_rgba(2,132,199,0.28)]",
          isExcelMode ? "rounded-md px-3 py-2" : "rounded-2xl px-4 py-3",
        )}
      >
        <p className={cn("font-medium text-sky-900", isExcelMode && "text-sm")}>Total visible y actualizado automáticamente</p>
        <AnimatedCurrencyValue
          value={totalAmount}
          currency={currency}
          className={cn("px-0 py-0 font-semibold text-sky-700", isExcelMode ? "text-xl" : "text-2xl")}
        />
      </div>
    </CardContent>
  );
});

const BudgetSummaryPanel = memo(function BudgetSummaryPanel({
  budgetId,
  currency,
  densityMode,
  isExcelMode,
  summaryCollapsed,
  generalExpensesRate,
  utilityRate,
  igvRate,
  totals,
  qualitySummary,
  onToggleCollapsed,
  onGeneralExpensesRateChange,
  onUtilityRateChange,
  onIgvRateChange,
}: {
  budgetId: string;
  currency: BudgetRecord["currency"];
  densityMode: DensityMode;
  isExcelMode: boolean;
  summaryCollapsed: boolean;
  generalExpensesRate: number;
  utilityRate: number;
  igvRate: number;
  totals: BudgetTotals;
  qualitySummary: BudgetQualitySummary;
  onToggleCollapsed: () => void;
  onGeneralExpensesRateChange: (value: number) => void;
  onUtilityRateChange: (value: number) => void;
  onIgvRateChange: (value: number) => void;
}) {
  return (
    <Card
      data-testid="budget-summary-panel"
      data-density-mode={densityMode}
      className={cn(
        "h-fit overflow-hidden border-slate-200/90 shadow-[0_20px_42px_-34px_rgba(15,23,42,0.24)] xl:sticky xl:top-4",
        isExcelMode && "rounded-md border-slate-300 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.18)]",
      )}
    >
      <CardHeader
        className={cn(
          "flex flex-row items-center border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)]",
          summaryCollapsed ? "justify-center px-2 py-3" : "justify-between",
          isExcelMode && !summaryCollapsed && "px-3 py-2",
        )}
      >
        {!summaryCollapsed ? <CardTitle>Resumen</CardTitle> : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={summaryCollapsed ? "Expandir resumen" : "Colapsar resumen"}
          title={summaryCollapsed ? "Expandir resumen" : "Colapsar resumen"}
          className="h-8 w-8 px-0"
          onClick={onToggleCollapsed}
        >
          {summaryCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {!summaryCollapsed ? (
        <CardContent className={cn(isExcelMode ? "space-y-3 px-3 py-3" : "space-y-4")}>
          <div className={cn("grid gap-2", isExcelMode ? "grid-cols-1" : "grid-cols-2")}>
            <QualityStatCard label="Partidas sin PU útil" value={qualitySummary.itemsWithoutUsefulUnitPrice} tone="danger" />
            <QualityStatCard label="Partidas por revisar" value={qualitySummary.itemsRequiringCatalogReview} tone="warning" />
            <QualityStatCard label="Sin APU" value={qualitySummary.itemsWithoutApu} tone="neutral" />
            <QualityStatCard label="Resueltas por sugerencia" value={qualitySummary.itemsResolvedFromSuggestion} tone="info" />
          </div>
          <RateField label="Gastos generales" value={generalExpensesRate} onChange={onGeneralExpensesRateChange} compact={isExcelMode} />
          <RateField label="Utilidad" value={utilityRate} onChange={onUtilityRateChange} compact={isExcelMode} />
          <RateField label="IGV" value={igvRate} onChange={onIgvRateChange} compact={isExcelMode} />
          <SummaryRow label="Costo directo" value={totals.totalDirectCost} currency={currency} compact={isExcelMode} />
          <SummaryRow label="Gastos generales" value={totals.totalGeneralExpenses} currency={currency} compact={isExcelMode} />
          <SummaryRow label="Utilidad" value={totals.totalUtility} currency={currency} compact={isExcelMode} />
          <SummaryRow label="IGV" value={totals.totalTax} currency={currency} compact={isExcelMode} />
          <div className={cn("bg-slate-900 text-white shadow-[0_18px_36px_-26px_rgba(15,23,42,0.45)]", isExcelMode ? "rounded-md px-3 py-3" : "rounded-2xl px-4 py-4")}>
            <p className={cn("text-slate-300", isExcelMode ? "text-xs" : "text-sm")}>Total presupuesto</p>
            <AnimatedCurrencyValue
              value={totals.totalAmount}
              currency={currency}
              className={cn("mt-1 px-0 py-0 font-semibold", isExcelMode ? "text-2xl" : "text-3xl")}
            />
          </div>
          <div className="grid gap-2">
            <a href={`/api/reports/budget/${budgetId}/excel`} className="inline-flex">
              <Button variant="outline" className={cn("w-full", isExcelMode && "h-8 text-xs")}>
                Exportar Excel
              </Button>
            </a>
            <a href={`/api/reports/apu/${budgetId}/excel`} className="inline-flex">
              <Button variant="outline" className={cn("w-full", isExcelMode && "h-8 text-xs")}>
                Exportar APU Excel
              </Button>
            </a>
            <a href={`/api/reports/budget/${budgetId}/pdf`} className="inline-flex">
              <Button variant="secondary" className={cn("w-full", isExcelMode && "h-8 text-xs")}>
                Exportar PDF
              </Button>
            </a>
          </div>
          <div className={cn("border border-slate-200/90 bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(241,245,249,0.92)_100%)] text-xs text-slate-500", isExcelMode ? "rounded-md px-3 py-2" : "rounded-2xl px-4 py-3")}>
            Atajos: <span className="font-medium text-slate-700">Ctrl/Cmd + S</span> guardar, <span className="font-medium text-slate-700">Alt + ↑/↓</span> mover fila activa, <span className="font-medium text-slate-700">↑ ↓ Enter Tab</span> navegar celdas, <span className="font-medium text-slate-700">Pegar</span> importa filas desde Excel.
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
});

function formatWorkbookCellValue(value: CellValue | undefined) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value && value.result !== undefined && value.result !== null) return String(value.result);
    if ("formula" in value && typeof value.formula === "string" && "result" in value && value.result === undefined) {
      return value.formula;
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
  }

  return String(value);
}

function getPasteFeedbackMessage(importedItems: number, importedLevels: number) {
  if (importedLevels > 0) {
    return `Pegado listo: ${importedLevels} ${importedLevels === 1 ? "nivel" : "niveles"} y ${importedItems} ${importedItems === 1 ? "partida" : "partidas"} importadas.`;
  }

  return `Pegado listo: ${importedItems} ${importedItems === 1 ? "partida importada" : "partidas importadas"}.`;
}

function createPendingPasteRowResolutions(guidedPaste: GuidedBudgetPasteWithSuggestions): PendingPasteRowResolution[] {
  return guidedPaste.itemMatches.map((itemMatch) => ({
    sourceRowIndex: itemMatch.sourceRowIndex,
    selectedPartidaId: null,
  }));
}

function getPendingPasteSelectedPartidaId(pendingPaste: PendingPaste, sourceRowIndex: number) {
  return pendingPaste.rowResolutions.find((resolution) => resolution.sourceRowIndex === sourceRowIndex)?.selectedPartidaId ?? null;
}

function getPastePreviewRows(pendingPaste: PendingPaste): PastePreviewRow[] {
  const { guidedPaste } = pendingPaste;

  if (guidedPaste.selectedMode === "flat") {
    return guidedPaste.rows.slice(0, 20).map((row, index) => ({
      kind: "item",
      description: row.description ?? "Nueva partida",
      code: row.code,
      unit: row.unit,
      quantity: row.quantity !== undefined ? String(row.quantity) : undefined,
      depth: 0,
      itemMatch: resolvePendingPasteItemMatchPresentation(pendingPaste, index),
      sourceRowIndex: index,
    }));
  }

  const minDepth = guidedPaste.entries.length
    ? Math.min(...guidedPaste.entries.map((entry) => (entry.kind === "level" ? entry.depth : entry.parentDepth)))
    : 0;
  const importedLevelCountsByDepth = new Map<number, number>();

  return guidedPaste.entries.slice(0, 24).map((entry, entryIndex) => {
    if (entry.kind === "level") {
      const normalizedDepth = entry.depth - minDepth;
      const levelType = getImportedLevelType(normalizedDepth, importedLevelCountsByDepth.get(normalizedDepth) ?? 0);
      const resolvedLevelType = entry.levelType ?? levelType;
      importedLevelCountsByDepth.set(normalizedDepth, (importedLevelCountsByDepth.get(normalizedDepth) ?? 0) + 1);

      return {
        kind: "level",
        description: entry.name,
        code: entry.code,
        depth: entry.depth,
        levelType: levelTypeLabel[resolvedLevelType],
        entryIndex,
        sourceRowIndex: entry.sourceRowIndex,
      };
    }

    return {
      kind: "item",
      description: entry.values.description ?? "Nueva partida",
      code: entry.values.code,
      unit: entry.values.unit,
      quantity: entry.values.quantity !== undefined ? String(entry.values.quantity) : undefined,
      depth: entry.parentDepth + 1,
      itemMatch: resolvePendingPasteItemMatchPresentation(pendingPaste, entry.sourceRowIndex),
      sourceRowIndex: entry.sourceRowIndex,
    };
  });
}

function resolvePendingPasteItemMatchPresentation(
  pendingPaste: PendingPaste,
  sourceRowIndex: number,
): PendingPasteItemMatchPresentation | null {
  const itemMatch = pendingPaste.guidedPaste.itemMatches.find((match) => match.sourceRowIndex === sourceRowIndex) ?? null;
  if (!itemMatch) return null;

  return {
    ...itemMatch.match,
    isSuggestionApplied:
      itemMatch.match.matchKind === "suggested" &&
      getPendingPasteSelectedPartidaId(pendingPaste, sourceRowIndex) === itemMatch.match.bestSuggestion?.id,
  };
}

function groupPasteIssuesByRow(issues: GuidedBudgetPaste["issues"]) {
  const issueMap = new Map<number, GuidedBudgetPaste["issues"]>();

  issues.forEach((issue) => {
    const current = issueMap.get(issue.rowIndex) ?? [];
    current.push(issue);
    issueMap.set(issue.rowIndex, current);
  });

  return issueMap;
}

function getPatternInferenceLabel(previewRows: PastePreviewRow[], rowIndex: number) {
  const row = previewRows[rowIndex];
  if (!row || row.kind !== "level") return "";

  const previousRow = rowIndex > 0 ? previewRows[rowIndex - 1] : null;

  if (!previousRow) {
    return "Inferido por patrón: primer texto del bloque.";
  }

  if (previousRow.kind === "level" && previousRow.depth === 0 && row.depth === 1) {
    return "Inferido por patrón: texto inmediato después del título.";
  }

  if (previousRow.kind === "item" && row.depth === 1) {
    return "Inferido por patrón: texto después de partidas del mismo bloque.";
  }

  if (previousRow.kind === "item" && row.depth === 0) {
    return "Inferido por patrón: texto después de partidas, inicia un nuevo título.";
  }

  if (previousRow.kind === "level" && previousRow.depth === 1 && row.depth === 0) {
    return "Inferido por patrón: inicio de un nuevo bloque de textos.";
  }

  return "Inferido por patrón.";
}

function parseSpreadsheetNumber(value: string) {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return 0;

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    const normalized = trimmed.replaceAll(thousandsSeparator, "").replace(decimalSeparator, ".");
    return Number(normalized) || 0;
  }

  if (lastComma !== -1) {
    return Number(trimmed.replaceAll(".", "").replace(",", ".")) || 0;
  }

  return Number(trimmed.replaceAll(",", "")) || 0;
}

function resolveDefaultItemLevelId(rows: BudgetDisplayRow[], activeRowId: string | null) {
  if (activeRowId) {
    const activeRowIndex = rows.findIndex((row) => getRowId(row) === activeRowId);
    if (activeRowIndex >= 0) {
      return resolveContextLevelIdFromRowIndex(rows, activeRowIndex);
    }
  }

  return resolveContextLevelIdFromRowIndex(rows, rows.length - 1);
}

function resolveDefaultLevelParentId(
  type: BudgetLevelType,
  rows: BudgetDisplayRow[],
  levels: BudgetLevelRecord[],
  activeRowId: string | null,
) {
  if (type === "TITLE") return null;
  if (type !== "SUBTITLE") return null;

  const contextLevelId = resolveDefaultItemLevelId(rows, activeRowId);
  if (!contextLevelId) return null;

  const contextLevel = levels.find((level) => level.id === contextLevelId) ?? null;
  if (!contextLevel) return null;

  if (contextLevel.type === "TITLE") return contextLevel.id;

  return findAncestorLevelIdByType(levels, contextLevel.parentId ?? null, "TITLE");
}

function resolveItemInsertion(rows: BudgetDisplayRow[], activeRowId: string | null, explicitLevelId?: string | null): ItemInsertion {
  if (explicitLevelId !== undefined) {
    return {
      levelId: explicitLevelId ?? null,
      afterItemId: null,
    };
  }

  const contextRow = resolveActiveOrLastRow(rows, activeRowId);
  if (!contextRow) {
    return {
      levelId: null,
      afterItemId: null,
    };
  }

  if (contextRow.kind === "item") {
    return {
      levelId: contextRow.item.levelId ?? null,
      afterItemId: contextRow.item.id,
    };
  }

  return {
    levelId: contextRow.level.id,
    afterItemId: null,
  };
}

function resolveItemInsertionFromTarget(target: InsertTarget, items: BudgetItemRecord[]): ItemInsertion {
  if (target.kind === "level") {
    return {
      levelId: target.id,
      afterItemId: null,
    };
  }

  const targetItem = items.find((item) => item.id === target.id) ?? null;
  return {
    levelId: targetItem?.levelId ?? null,
    afterItemId: target.id,
  };
}

function resolveLevelInsertion(
  type: BudgetLevelType,
  rows: BudgetDisplayRow[],
  levels: BudgetLevelRecord[],
  activeRowId: string | null,
  explicitParentId?: string | null,
): LevelInsertion {
  if (explicitParentId !== undefined) {
    return {
      parentId: explicitParentId ?? null,
      afterLevelId: null,
    };
  }

  if (type === "TITLE") {
    return {
      parentId: null,
      afterLevelId: resolveContextLevelAnchorId(rows, levels, activeRowId, "TITLE"),
    };
  }

  if (type === "SUBTITLE") {
    const contextRow = resolveActiveOrLastRow(rows, activeRowId);
    const parentId = resolveDefaultLevelParentId(type, rows, levels, activeRowId);

    if (!parentId) {
      return {
        parentId: null,
        afterLevelId: null,
      };
    }

    if (contextRow?.kind === "level" && contextRow.level.type === "TITLE") {
      return {
        parentId,
        afterLevelId: null,
      };
    }

    const subtitleAnchorId = resolveContextLevelAnchorId(rows, levels, activeRowId, "SUBTITLE");
    return {
      parentId,
      afterLevelId: subtitleAnchorId,
    };
  }

  return {
    parentId: explicitParentId ?? null,
    afterLevelId: null,
  };
}

function resolveContextLevelAnchorId(
  rows: BudgetDisplayRow[],
  levels: BudgetLevelRecord[],
  activeRowId: string | null,
  type: BudgetLevelType,
) {
  const contextRow = resolveActiveOrLastRow(rows, activeRowId);
  if (!contextRow) return null;

  if (contextRow.kind === "level") {
    if (contextRow.level.type === type) return contextRow.level.id;
    return findAncestorLevelIdByType(levels, contextRow.level.parentId ?? null, type);
  }

  return findAncestorLevelIdByType(levels, contextRow.item.levelId ?? null, type);
}

function resolveActiveOrLastRow(rows: BudgetDisplayRow[], activeRowId: string | null) {
  if (activeRowId) {
    const activeRow = rows.find((row) => getRowId(row) === activeRowId);
    if (activeRow) return activeRow;
  }

  return rows.at(-1) ?? null;
}

function resolveContextLevelIdFromRowIndex(rows: BudgetDisplayRow[], rowIndex: number) {
  for (let index = rowIndex; index >= 0; index -= 1) {
    const row = rows[index];
    if (!row) continue;

    if (row.kind === "item" && row.item.levelId) {
      return row.item.levelId;
    }

    if (row.kind === "level") {
      return row.level.id;
    }
  }

  return null;
}

function findAncestorLevelIdByType(levels: BudgetLevelRecord[], levelId: string | null, type: BudgetLevelType): string | null {
  let currentId = levelId;

  while (currentId) {
    const current = levels.find((level) => level.id === currentId) ?? null;
    if (!current) return null;
    if (current.type === type) return current.id;
    currentId = current.parentId ?? null;
  }

  return null;
}

function insertItemAtPosition(items: BudgetItemRecord[], nextItem: BudgetItemRecord, insertion: ItemInsertion) {
  return insertItemsAtPosition(items, [nextItem], insertion);
}

function insertItemsAtPosition(items: BudgetItemRecord[], nextItems: BudgetItemRecord[], insertion: ItemInsertion) {
  const sorted = [...items].sort((left, right) => left.sortOrder - right.sortOrder);

  if (insertion.afterItemId) {
    const anchorIndex = sorted.findIndex((item) => item.id === insertion.afterItemId);
    if (anchorIndex >= 0) {
      sorted.splice(anchorIndex + 1, 0, ...nextItems);
      return resequenceItems(sorted);
    }
  }

  if (insertion.levelId) {
    const firstSiblingIndex = sorted.findIndex((item) => item.levelId === insertion.levelId);
    if (firstSiblingIndex >= 0) {
      sorted.splice(firstSiblingIndex, 0, ...nextItems);
      return resequenceItems(sorted);
    }
  }

  return resequenceItems([...sorted, ...nextItems]);
}

function insertLevelAtPosition(levels: BudgetLevelRecord[], nextLevel: BudgetLevelRecord, insertion: LevelInsertion) {
  const sorted = [...levels].sort((left, right) => left.sortOrder - right.sortOrder);

  if (insertion.afterLevelId) {
    const anchorIndex = sorted.findIndex((level) => level.id === insertion.afterLevelId);
    if (anchorIndex >= 0) {
      sorted.splice(anchorIndex + 1, 0, nextLevel);
      return resequenceLevels(sorted);
    }
  }

  if (insertion.parentId) {
    const firstSiblingIndex = sorted.findIndex((level) => level.parentId === insertion.parentId);
    if (firstSiblingIndex >= 0) {
      sorted.splice(firstSiblingIndex, 0, nextLevel);
      return resequenceLevels(sorted);
    }
  }

  return resequenceLevels([...sorted, nextLevel]);
}

function getDefaultInsertTarget(rows: BudgetDisplayRow[], activeRowId: string | null): InsertTarget | null {
  if (activeRowId) {
    const activeRow = rows.find((row) => getRowId(row) === activeRowId);
    if (activeRow) {
      return activeRow.kind === "level" ? { kind: "level", id: activeRow.level.id } : { kind: "item", id: activeRow.item.id };
    }
  }

  const lastLevel = [...rows].reverse().find((row) => row.kind === "level");
  if (lastLevel && lastLevel.kind === "level") {
    return { kind: "level", id: lastLevel.level.id };
  }

  const firstItem = rows.find((row) => row.kind === "item");
  if (firstItem && firstItem.kind === "item") {
    return { kind: "item", id: firstItem.item.id };
  }

  return null;
}

function resolveTargetRow(rows: BudgetDisplayRow[], target: InsertTarget) {
  return rows.find((row) => row.kind === target.kind && getRowId(row) === target.id) ?? null;
}

function findLevelRow(rows: BudgetDisplayRow[], levelId: string): Extract<BudgetDisplayRow, { kind: "level" }> | null {
  return rows.find((row): row is Extract<BudgetDisplayRow, { kind: "level" }> => row.kind === "level" && row.level.id === levelId) ?? null;
}

function resolveDefaultPasteApplyMode(targetRow: BudgetDisplayRow): BudgetPasteApplyMode {
  return targetRow.kind === "level" ? "insert-inside-level" : "insert-below";
}

function clearDeeperLevels(levelStack: Map<number, string | null>, currentDepth: number) {
  for (const depth of [...levelStack.keys()]) {
    if (depth > currentDepth) {
      levelStack.delete(depth);
    }
  }
}

function getLevelDepth(levels: BudgetLevelRecord[], levelId: string) {
  let depth = 0;
  let current = levels.find((level) => level.id === levelId) ?? null;

  while (current?.parentId) {
    depth += 1;
    current = levels.find((level) => level.id === current?.parentId) ?? null;
  }

  return depth;
}

function getImportedLevelType(depth: number, levelIndexAtDepth: number): BudgetLevelType {
  if (depth <= 0) {
    return levelIndexAtDepth === 0 ? "TITLE" : "SUBTITLE";
  }

  if (depth === 1) return "SUBTITLE";
  return "ITEM_GROUP";
}

function getCellKey(rowId: string, column: EditableColumn) {
  return `${rowId}:${column}`;
}

function normalizeLookupText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getRowId(row: BudgetDisplayRow) {
  return row.kind === "level" ? row.level.id : row.item.id;
}

function isFocusedWithinEditor(root: HTMLDivElement | null) {
  const activeElement = document.activeElement;
  return !!(root && activeElement instanceof HTMLElement && root.contains(activeElement));
}

function getFocusedBudgetRowId(root: HTMLDivElement | null) {
  const activeElement = document.activeElement;
  if (!(root && activeElement instanceof HTMLElement && root.contains(activeElement))) return null;

  const row = activeElement.closest<HTMLElement>("[data-budget-row-id]");
  return row?.dataset.budgetRowId ?? null;
}

function getEditableColumnsForRow(row: BudgetDisplayRow | null): EditableColumn[] {
  if (!row) return [];
  return row.kind === "level" ? ["code", "description"] : ["code", "description", "unit", "quantity"];
}

function resolveTargetColumn(columns: EditableColumn[], preferred: EditableColumn) {
  if (columns.includes(preferred)) return preferred;

  const preferredIndex = editableColumnOrder.indexOf(preferred);
  const rankedColumns = [...columns].sort(
    (left, right) =>
      Math.abs(editableColumnOrder.indexOf(left) - preferredIndex) - Math.abs(editableColumnOrder.indexOf(right) - preferredIndex),
  );

  return rankedColumns[0] ?? null;
}

function shouldMoveHorizontally(input: HTMLInputElement, key: "ArrowLeft" | "ArrowRight") {
  if (input.type === "number") return true;

  const selectionStart = input.selectionStart ?? 0;
  const selectionEnd = input.selectionEnd ?? 0;
  const hasSelection = selectionStart !== selectionEnd;

  if (hasSelection) return false;

  if (key === "ArrowLeft") {
    return selectionStart === 0;
  }

  return selectionEnd === input.value.length;
}

function moveScopedEntity<T extends { id: string; sortOrder: number }, TScope>(
  items: T[],
  id: string,
  direction: "up" | "down",
  getScope: (item: T) => TScope,
  resequence: (items: T[]) => T[],
): T[] {
  const sorted = [...items].sort((left, right) => left.sortOrder - right.sortOrder);
  const index = sorted.findIndex((item) => item.id === id);

  if (index === -1) return items;

  const currentItem = sorted[index];
  if (!currentItem) return items;

  const scope = getScope(currentItem);
  const siblingIndexes = sorted.reduce<number[]>((indexes, item, currentIndex) => {
    if (getScope(item) === scope) {
      indexes.push(currentIndex);
    }
    return indexes;
  }, []);
  const siblingPosition = siblingIndexes.indexOf(index);

  if (siblingPosition === -1) return items;

  const targetSiblingPosition = direction === "up" ? siblingPosition - 1 : siblingPosition + 1;
  if (targetSiblingPosition < 0 || targetSiblingPosition >= siblingIndexes.length) return items;

  const targetIndex = siblingIndexes[targetSiblingPosition];
  if (targetIndex === undefined) return items;

  [sorted[index], sorted[targetIndex]] = [sorted[targetIndex], sorted[index]];

  return resequence(sorted);
}

function moveScopedEntityToTarget<T extends { id: string; sortOrder: number }, TScope>(
  items: T[],
  sourceId: string,
  targetId: string,
  getScope: (item: T) => TScope,
  resequence: (items: T[]) => T[],
): T[] {
  const sorted = [...items].sort((left, right) => left.sortOrder - right.sortOrder);
  const sourceIndex = sorted.findIndex((item) => item.id === sourceId);
  const targetIndex = sorted.findIndex((item) => item.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return items;

  const sourceItem = sorted[sourceIndex];
  const targetItem = sorted[targetIndex];
  if (!sourceItem || !targetItem) return items;
  if (getScope(sourceItem) !== getScope(targetItem)) return items;

  const [source] = sorted.splice(sourceIndex, 1);
  if (!source) return items;

  sorted.splice(targetIndex, 0, source);

  return resequence(sorted);
}

function normalizeSortOrders(levels: BudgetLevelRecord[]) {
  return [...levels]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((level, index) => ({
      ...level,
      sortOrder: index + 1,
    }));
}

function normalizeItemSortOrders(items: BudgetItemRecord[]) {
  return [...items]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }));
}

function resequenceLevels(levels: BudgetLevelRecord[]) {
  return levels.map((level, index) => ({
    ...level,
    sortOrder: index + 1,
  }));
}

function resequenceItems(items: BudgetItemRecord[]) {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
  }));
}

function getHeaderCellClass(column: ActiveColumn, activeColumn: ActiveColumn, isExcelMode: boolean, extraClassName?: string) {
  return cn(
    "budget-sticky-header sticky top-0 h-10 text-xs uppercase tracking-wide",
    isExcelMode ? "z-30 border-b border-slate-300 bg-slate-100 text-[11px] font-semibold text-slate-700" : "z-20 bg-slate-50",
    activeColumn === column ? "bg-sky-100 text-sky-900" : "",
    column === "actions" ? "z-30" : "",
    extraClassName,
  );
}

function getBodyCellClass(
  column: ActiveColumn,
  activeColumn: ActiveColumn,
  extraClassName: string,
  densityMode: DensityMode,
  isExcelMode: boolean,
) {
  return cn(
    getCellPadding(densityMode),
    isExcelMode ? "border-b border-slate-200 text-xs" : "",
    activeColumn === column ? "bg-sky-50/70" : "",
    extraClassName,
  );
}
