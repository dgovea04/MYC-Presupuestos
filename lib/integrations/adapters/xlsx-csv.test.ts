import { describe, expect, it } from "vitest";
import { stageXlsxCsv } from "./xlsx-csv";
describe("xlsx/csv staging", () => {
  it("normalizes values and reports duplicate external keys without writing budgets", async () => { const result = await stageXlsxCsv({ sourceName: "obra.csv", rows: [{ codigo: " A-01 ", cantidad: "1,25" }, { codigo: "A-01", cantidad: "2" }] }); expect(result.rows[0]?.externalKey).toBe("A-01"); expect(result.conflicts[0]?.kind).toBe("DUPLICATE_EXTERNAL_KEY"); expect(result.payloadHash).toMatch(/^[a-f0-9]{64}$/); });
});
