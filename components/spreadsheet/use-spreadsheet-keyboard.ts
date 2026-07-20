"use client";

import { useCallback } from "react";
import {
  getAdjacentEditableCell,
  type SpreadsheetCellAddress,
  type SpreadsheetRowDefinition,
} from "@/lib/spreadsheet/cell-address";

function shouldMoveHorizontally(input: HTMLInputElement, key: string): boolean {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  if (start !== end) {
    return false;
  }

  return key === "ArrowLeft" ? start === 0 : end === input.value.length;
}

type HandleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => void;

export type UseSpreadsheetKeyboardOptions = {
  rows: SpreadsheetRowDefinition[];
  activeCell: SpreadsheetCellAddress | null;
  focusCell: (cell: SpreadsheetCellAddress) => void;
  extendSelectionTo: (cell: SpreadsheetCellAddress) => void;
};

export function useSpreadsheetKeyboard({
  rows,
  activeCell,
  focusCell,
  extendSelectionTo,
}: UseSpreadsheetKeyboardOptions): {
  onCellKeyDown: HandleKeyDown;
} {
  const onCellKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!activeCell || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const direction =
        event.key === "ArrowUp"
          ? "up"
          : event.key === "ArrowDown" || event.key === "Enter"
            ? "down"
            : event.key === "ArrowLeft"
              ? "left"
              : event.key === "ArrowRight"
                ? "right"
                : null;

      if (!direction) {
        return;
      }

      if ((direction === "left" || direction === "right") && !shouldMoveHorizontally(event.currentTarget, event.key)) {
        return;
      }

      event.preventDefault();
      const nextCell = getAdjacentEditableCell({ rows, cell: activeCell, direction });
      if (!nextCell) {
        return;
      }

      if (event.shiftKey) {
        extendSelectionTo(nextCell);
        return;
      }

      focusCell(nextCell);
    },
    [activeCell, extendSelectionTo, focusCell, rows],
  );

  return { onCellKeyDown };
}
