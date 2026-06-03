import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadUnifiedIndexWorkbook } from "@/lib/polynomial-formula/index-source";
import { unifiedIndexDictionaryData } from "@/lib/polynomial-formula/unified-index-dictionary-data";

const WORKBOOK_PATH = path.resolve(
  process.cwd(),
  "data-for-seed",
  "formula-polinomica",
  "07_indices_unificados_de_precios_de_la_construccion_ene26.xlsx",
);

describe("unifiedIndexDictionaryData", () => {
  it("matches the official workbook dictionary entries exactly", async () => {
    const workbook = await loadUnifiedIndexWorkbook(WORKBOOK_PATH);
    const expected = [...workbook.dictionaryEntries].sort((left, right) =>
      left.element.localeCompare(right.element, "es"),
    );

    expect(unifiedIndexDictionaryData).toEqual(expected);
  });
});
