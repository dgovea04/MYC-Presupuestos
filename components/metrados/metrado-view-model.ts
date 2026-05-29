import type {
  MetradoFormulaInputKey,
  MetradoFormulaKey,
  MetradoRowRecord,
  MetradoUnit,
} from "@/types/metrado";

const CLIENT_ROW_ID_PREFIX = "client-metrado-row";

const cloneRow = (row: MetradoRowRecord): MetradoRowRecord => ({
  ...row,
  inputs: { ...row.inputs },
});

const resequenceRows = (
  rows: readonly MetradoRowRecord[],
): MetradoRowRecord[] =>
  rows.map((row, index) => ({
    ...cloneRow(row),
    sortOrder: index + 1,
  }));

const createClientRowId = (rows: readonly MetradoRowRecord[]): string => {
  const existingIds = new Set(rows.map((row) => row.id));
  let candidateIndex = rows.length + 1;
  let candidate = `${CLIENT_ROW_ID_PREFIX}-${candidateIndex}`;

  while (existingIds.has(candidate)) {
    candidateIndex += 1;
    candidate = `${CLIENT_ROW_ID_PREFIX}-${candidateIndex}`;
  }

  return candidate;
};

export const addMetradoRow = (
  rows: readonly MetradoRowRecord[],
  sheetId: string,
  unit: MetradoUnit,
  formulaKey: MetradoFormulaKey,
): MetradoRowRecord[] => {
  const row: MetradoRowRecord = {
    id: createClientRowId(rows),
    sheetId,
    sector: "",
    eje: "",
    nivel: "",
    description: "",
    unit,
    formulaKey,
    inputs: {},
    partial: 0,
    sortOrder: rows.length + 1,
  };

  return resequenceRows([...rows, row]);
};

export const duplicateMetradoRow = (
  rows: readonly MetradoRowRecord[],
  rowId: string,
): MetradoRowRecord[] => {
  const sourceIndex = rows.findIndex((row) => row.id === rowId);

  if (sourceIndex === -1) {
    return resequenceRows(rows);
  }

  const sourceRow = rows[sourceIndex];
  if (!sourceRow) {
    return resequenceRows(rows);
  }

  const duplicate: MetradoRowRecord = {
    ...cloneRow(sourceRow),
    id: createClientRowId(rows),
    partial: 0,
  };

  return resequenceRows([
    ...rows.slice(0, sourceIndex + 1),
    duplicate,
    ...rows.slice(sourceIndex + 1),
  ]);
};

export const deleteMetradoRow = (
  rows: readonly MetradoRowRecord[],
  rowId: string,
): MetradoRowRecord[] => {
  const nextRows = rows.filter((row) => row.id !== rowId);

  return resequenceRows(nextRows);
};

export const updateMetradoRowInput = (
  rows: readonly MetradoRowRecord[],
  rowId: string,
  key: MetradoFormulaInputKey,
  value: number,
): MetradoRowRecord[] =>
  resequenceRows(
    rows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            inputs: {
              ...row.inputs,
              [key]: value,
            },
          }
        : row,
    ),
  );

export const buildDefaultMetradoSheetName = ({
  templateName,
  partidaCode,
}: {
  templateName: string;
  partidaCode?: string | null;
}): string => {
  if (partidaCode?.trim()) {
    return `Metrado - ${templateName} - ${partidaCode.trim()}`;
  }

  return `Metrado - ${templateName}`;
};
