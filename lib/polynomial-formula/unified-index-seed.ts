import type {
  UnifiedIndexSourceRow,
  UnifiedIndexWorkbookSource,
} from "@/lib/polynomial-formula/index-source";

type UnifiedIndexSeedPayloadRow = {
  code: string;
  name: string;
  geographicArea: string;
  month: number;
  year: number;
  value: string;
  source: string;
};

const getCompositeKey = (row: {
  code: string;
  geographicArea: string;
  month: number;
  year: number;
}): string => `${row.code}:${row.geographicArea}:${row.month}:${row.year}`;

const toSeedPayloadRow = (
  row: UnifiedIndexSourceRow,
  sourceFilename: string,
): UnifiedIndexSeedPayloadRow => ({
  code: row.code,
  name: row.name,
  geographicArea: row.geographicArea,
  month: row.month,
  year: row.year,
  value: row.value,
  source: sourceFilename,
});

const seedRowsMatch = (
  left: UnifiedIndexSeedPayloadRow,
  right: UnifiedIndexSeedPayloadRow,
): boolean =>
  left.code === right.code &&
  left.name === right.name &&
  left.geographicArea === right.geographicArea &&
  left.month === right.month &&
  left.year === right.year &&
  left.value === right.value &&
  left.source === right.source;

export const buildUnifiedIndexSeedPayload = (
  workbookSource: UnifiedIndexWorkbookSource,
  sourceFilename: string,
): UnifiedIndexSeedPayloadRow[] => {
  const rowsByCompositeKey = new Map<string, UnifiedIndexSeedPayloadRow>();

  [...workbookSource.baseRows, ...workbookSource.indexRows].forEach((row) => {
    const payloadRow = toSeedPayloadRow(row, sourceFilename);
    const compositeKey = getCompositeKey(payloadRow);
    const existingRow = rowsByCompositeKey.get(compositeKey);

    if (!existingRow) {
      rowsByCompositeKey.set(compositeKey, payloadRow);
      return;
    }

    if (!seedRowsMatch(existingRow, payloadRow)) {
      throw new Error(
        `Conflicting unified index seed rows for composite key "${compositeKey}"`,
      );
    }
  });

  return Array.from(rowsByCompositeKey.values());
};

export type { UnifiedIndexSeedPayloadRow };
