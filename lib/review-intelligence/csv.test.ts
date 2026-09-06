import { describe, expect, it } from "vitest";
import { parseReviewCsv } from "./csv";
import { extractDocument } from "./extractors";

describe("review CSV parser", () => {
  it("parses quoted semicolon rows and preserves source row locations", () => {
    const result = parseReviewCsv(new TextEncoder().encode('Código;Descripción;Metrado\n01.01;"Muro; concreto";12.50\n'));
    expect(result.delimiter).toBe(";");
    expect(result.headers).toEqual(["Código", "Descripción", "Metrado"]);
    expect(result.rows[0]).toMatchObject({ values: ["01.01", "Muro; concreto", "12.50"], location: { row: 2, column: 1 } });
  });

  it("feeds CSV rows into the review extraction contract", async () => {
    const result = await extractDocument({ file: new File(["code,description,quantity\n01.01,Concrete,12.50\n"], "metrados.csv", { type: "text/csv" }) });
    expect(result.kind).toBe("CSV");
    expect(result.items[0]).toMatchObject({ extractionMethod: "CSV_CELL_RANGE", location: { row: 2 } });
  });
});
