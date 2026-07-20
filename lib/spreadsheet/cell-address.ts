export type SpreadsheetCellAddress = {
  rowId: string;
  columnId: string;
};

export type SpreadsheetColumnDefinition = {
  id: string;
  editable: boolean;
};

export type SpreadsheetRowDefinition = {
  id: string;
  columns: SpreadsheetColumnDefinition[];
};

const CELL_KEY_SEPARATOR = "::";

export function getCellKey(cell: SpreadsheetCellAddress): string {
  return `${cell.rowId}${CELL_KEY_SEPARATOR}${cell.columnId}`;
}

export function parseCellKey(key: string): SpreadsheetCellAddress | null {
  const separatorIndex = key.indexOf(CELL_KEY_SEPARATOR);
  if (separatorIndex <= 0 || separatorIndex >= key.length - CELL_KEY_SEPARATOR.length) {
    return null;
  }

  return {
    rowId: key.slice(0, separatorIndex),
    columnId: key.slice(separatorIndex + CELL_KEY_SEPARATOR.length),
  };
}

export function getOrderedEditableCells(rows: SpreadsheetRowDefinition[]): SpreadsheetCellAddress[] {
  return rows.flatMap((row) =>
    row.columns
      .filter((column) => column.editable)
      .map((column) => ({
        rowId: row.id,
        columnId: column.id,
      })),
  );
}

export function getAdjacentEditableCell({
  rows,
  cell,
  direction,
}: {
  rows: SpreadsheetRowDefinition[];
  cell: SpreadsheetCellAddress;
  direction: "up" | "down" | "left" | "right";
}): SpreadsheetCellAddress | null {
  const rowIndex = rows.findIndex((row) => row.id === cell.rowId);
  if (rowIndex === -1) {
    return null;
  }

  const currentRow = rows[rowIndex];
  if (!currentRow) {
    return null;
  }

  if (direction === "left" || direction === "right") {
    const editableColumns = currentRow.columns.filter((column) => column.editable);
    const columnIndex = editableColumns.findIndex((column) => column.id === cell.columnId);
    if (columnIndex === -1) {
      return null;
    }

    const nextColumn = editableColumns[direction === "left" ? columnIndex - 1 : columnIndex + 1];
    return nextColumn ? { rowId: currentRow.id, columnId: nextColumn.id } : null;
  }

  const step = direction === "up" ? -1 : 1;
  for (let nextRowIndex = rowIndex + step; nextRowIndex >= 0 && nextRowIndex < rows.length; nextRowIndex += step) {
    const candidateRow = rows[nextRowIndex];
    if (!candidateRow) {
      continue;
    }
    const matchingColumn = candidateRow.columns.find((column) => column.id === cell.columnId && column.editable);
    if (matchingColumn) {
      return { rowId: candidateRow.id, columnId: matchingColumn.id };
    }
  }

  return null;
}

export function getRectangularCellRange({
  rows,
  anchor,
  focus,
}: {
  rows: SpreadsheetRowDefinition[];
  anchor: SpreadsheetCellAddress;
  focus: SpreadsheetCellAddress;
}): SpreadsheetCellAddress[] {
  const anchorRowIndex = rows.findIndex((row) => row.id === anchor.rowId);
  const focusRowIndex = rows.findIndex((row) => row.id === focus.rowId);
  if (anchorRowIndex === -1 || focusRowIndex === -1) {
    return [];
  }

  const allColumnIds = rows[anchorRowIndex]?.columns.map((column) => column.id) ?? [];
  const anchorColumnIndex = allColumnIds.indexOf(anchor.columnId);
  const focusColumnIndex = allColumnIds.indexOf(focus.columnId);
  if (anchorColumnIndex === -1 || focusColumnIndex === -1) {
    return [];
  }

  const rowStart = Math.min(anchorRowIndex, focusRowIndex);
  const rowEnd = Math.max(anchorRowIndex, focusRowIndex);
  const columnStart = Math.min(anchorColumnIndex, focusColumnIndex);
  const columnEnd = Math.max(anchorColumnIndex, focusColumnIndex);
  const selected: SpreadsheetCellAddress[] = [];

  for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) {
      continue;
    }

    for (let columnIndex = columnStart; columnIndex <= columnEnd; columnIndex += 1) {
      const column = row.columns[columnIndex];
      if (column?.editable) {
        selected.push({ rowId: row.id, columnId: column.id });
      }
    }
  }

  return selected;
}
