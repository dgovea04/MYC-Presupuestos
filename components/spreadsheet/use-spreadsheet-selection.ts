"use client";

import { useCallback, useMemo, useState } from "react";
import {
  getCellKey,
  getRectangularCellRange,
  type SpreadsheetCellAddress,
  type SpreadsheetRowDefinition,
} from "@/lib/spreadsheet/cell-address";

export type UseSpreadsheetSelectionResult = {
  activeCell: SpreadsheetCellAddress | null;
  selectedCells: SpreadsheetCellAddress[];
  selectedCellKeys: Set<string>;
  isCellSelected: (cell: SpreadsheetCellAddress) => boolean;
  isCellActive: (cell: SpreadsheetCellAddress) => boolean;
  activateCell: (cell: SpreadsheetCellAddress) => void;
  extendSelectionTo: (cell: SpreadsheetCellAddress) => void;
  clearSelection: () => void;
};

export function useSpreadsheetSelection({
  rows,
}: {
  rows: SpreadsheetRowDefinition[];
}): UseSpreadsheetSelectionResult {
  const [activeCell, setActiveCell] = useState<SpreadsheetCellAddress | null>(null);
  const [anchorCell, setAnchorCell] = useState<SpreadsheetCellAddress | null>(null);
  const [focusCellState, setFocusCellState] = useState<SpreadsheetCellAddress | null>(null);

  const activateCell = useCallback((cell: SpreadsheetCellAddress) => {
    setActiveCell(cell);
    setAnchorCell(cell);
    setFocusCellState(cell);
  }, []);

  const extendSelectionTo = useCallback((cell: SpreadsheetCellAddress) => {
    setFocusCellState(cell);
  }, []);

  const clearSelection = useCallback(() => {
    setActiveCell(null);
    setAnchorCell(null);
    setFocusCellState(null);
  }, []);

  const selectedCells = useMemo(() => {
    if (!anchorCell || !focusCellState) {
      return activeCell ? [activeCell] : [];
    }

    return getRectangularCellRange({ rows, anchor: anchorCell, focus: focusCellState });
  }, [activeCell, anchorCell, focusCellState, rows]);

  const selectedCellKeys = useMemo(() => new Set(selectedCells.map(getCellKey)), [selectedCells]);

  const isCellSelected = useCallback(
    (cell: SpreadsheetCellAddress) => selectedCellKeys.has(getCellKey(cell)),
    [selectedCellKeys],
  );

  const isCellActive = useCallback(
    (cell: SpreadsheetCellAddress) =>
      activeCell !== null && activeCell.rowId === cell.rowId && activeCell.columnId === cell.columnId,
    [activeCell],
  );

  return {
    activeCell,
    selectedCells,
    selectedCellKeys,
    isCellSelected,
    isCellActive,
    activateCell,
    extendSelectionTo,
    clearSelection,
  };
}
