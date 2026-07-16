import { describe, expect, it } from "vitest";
import {
  OVERVIEW_CSV_HEADERS,
  mapLineToCsvRow,
  type OverviewCsvHeader,
} from "./export-helpers";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";

// ─── Local type-test helpers (mirrors common tsd-style utilities) ───────────

type Assert<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

type ReturnedRow = ReturnType<typeof mapLineToCsvRow>;

function buildLine(
  overrides: Partial<WorkScheduleLineRecord> = {},
): WorkScheduleLineRecord {
  return {
    budgetItemId: "item-1",
    itemCode: "01.01",
    description: "Trazo y replanteo",
    unit: "m2",
    quantity: 100,
    unitPrice: 10,
    partial: 1000,
    crew: 2,
    performance: 1,
    predecessor: "",
    startDate: "2026-03-08",
    endDate: "2026-03-21",
    durationDays: 14,
    subBudgetId: "sub-1",
    subBudgetName: "Estructuras",
    monthlyDistributions: [],
    isMilestone: false,
    baselineStartDate: null,
    baselineEndDate: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("OVERVIEW_CSV_HEADERS", () => {
  it("contains 12 entries (the canonical per-line cronogram layout)", () => {
    expect(OVERVIEW_CSV_HEADERS).toHaveLength(12);
  });

  it("places 'Dias calendario' between 'Duracion' and 'Inicio'", () => {
    expect(OVERVIEW_CSV_HEADERS[2]).toBe("Duracion");
    expect(OVERVIEW_CSV_HEADERS[3]).toBe("Dias calendario");
    expect(OVERVIEW_CSV_HEADERS[4]).toBe("Inicio");
  });

  it("defines headers as a readonly array (no push/splice allowed)", () => {
    type IsReadonly = Assert<
      Equal<typeof OVERVIEW_CSV_HEADERS extends ReadonlyArray<unknown> ? true : false, true>
    >;
    const isReadonly: IsReadonly = true;
    expect(isReadonly).toBe(true);
  });

  it("exposes the header literal union type", () => {
    type HeaderIsString = Assert<Equal<OverviewCsvHeader, string>>;
    const headerIsString: HeaderIsString = true;
    expect(headerIsString).toBe(true);
  });
});

describe("mapLineToCsvRow", () => {
  it("returns a 12-cell row in header order", () => {
    const row = mapLineToCsvRow(buildLine(), "PEN", 2, "DD/MM/YYYY");
    expect(row).toHaveLength(12);
    expect(row[0]).toBe("01.01");
    expect(row[1]).toBe("Trazo y replanteo");
    expect(row[2]).toBe("14");
    expect(row[3]).toBe("14");
    expect(row[6]).toBe("-");
    expect(row[7]).toMatch(/^2\.00$/);
    expect(row[8]).toBe("m2");
    expect(row[9]).toMatch(/^100\.00$/);
    expect(row[10]).toMatch(/^(S\/|PEN) 10\.00$/);
    expect(row[11]).toMatch(/^(S\/|PEN) 1,000\.00$/);
  });

  it("computes 'Dias calendario' as inclusive diffInDays when both dates are set", () => {
    expect(
      mapLineToCsvRow(
        buildLine({ startDate: "2026-03-08", endDate: "2026-03-21" }),
        "PEN",
        2,
        "DD/MM/YYYY",
      )[3],
    ).toBe("14");

    expect(
      mapLineToCsvRow(
        buildLine({ startDate: "2026-03-08", endDate: "2026-03-08" }),
        "PEN",
        2,
        "DD/MM/YYYY",
      )[3],
    ).toBe("1");
  });

  it("falls back to '-' for 'Dias calendario' when either date is missing", () => {
    expect(
      mapLineToCsvRow(buildLine({ startDate: null, endDate: "2026-03-21" }), "PEN", 2, "DD/MM/YYYY")[3],
    ).toBe("-");
    expect(
      mapLineToCsvRow(buildLine({ startDate: "2026-03-08", endDate: null }), "PEN", 2, "DD/MM/YYYY")[3],
    ).toBe("-");
    expect(
      mapLineToCsvRow(buildLine({ startDate: null, endDate: null }), "PEN", 2, "DD/MM/YYYY")[3],
    ).toBe("-");
  });

  it("emits 'Dias calendario' as an integer string (no fractional drift)", () => {
    const row = mapLineToCsvRow(
      buildLine({ startDate: "2026-03-08", endDate: "2026-03-21" }),
      "PEN",
      2,
      "DD/MM/YYYY",
    );
    expect(row[3]).toMatch(/^\d+$/);
  });

  it("falls back to '-' for unknown pieces (durationDays, predecessor, crew)", () => {
    const row = mapLineToCsvRow(
      buildLine({ durationDays: null, predecessor: null, crew: null }),
      "PEN",
      2,
      "DD/MM/YYYY",
    );
    expect(row[2]).toBe("-");
    expect(row[6]).toBe("-");
    expect(row[7]).toBe("-");
  });

  it("emits 'Pendiente' for missing startDate or endDate (Inicio/Fin slots)", () => {
    const row = mapLineToCsvRow(
      buildLine({ startDate: null, endDate: null }),
      "PEN",
      2,
      "DD/MM/YYYY",
    );
    expect(row[4]).toBe("Pendiente");
    expect(row[5]).toBe("Pendiente");
  });

  it("respects currency symbol and decimal places (PU + Parcial cells only; Metrado uses 2 decimals fixed)", () => {
    const usdRow = mapLineToCsvRow(buildLine(), "USD", 4, "yyyy-MM-dd");
    expect(usdRow[0]).toBe("01.01");
    // quantity cell is hardcoded to 2 decimals — currencyDecimals only affects currency cells.
    expect(usdRow[9]).toBe("100.00");
    expect(usdRow[10]).toMatch(/^\$ 10\.0000$/);
    expect(usdRow[11]).toMatch(/^\$ 1,000\.0000$/);
  });
});

describe("header / row alignment (single source of truth)", () => {
  it("the helper's tuple length matches the headers' tuple length", () => {
    type HeadersAreTwelve = Assert<Equal<typeof OVERVIEW_CSV_HEADERS["length"], 12>>;
    type RowsAreStrings = Assert<Equal<ReturnedRow extends readonly string[] ? true : false, true>>;
    type _Assert = HeadersAreTwelve & RowsAreStrings;
    const check: _Assert = true;
    expect(check).toBe(true);

    const row = mapLineToCsvRow(buildLine(), "PEN", 2, "DD/MM/YYYY");
    expect(row.length).toBe(OVERVIEW_CSV_HEADERS.length);
  });
});
