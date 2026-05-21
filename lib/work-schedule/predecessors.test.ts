import { describe, expect, it } from "vitest";
import {
  formatGeneratedPredecessor,
  parseWorkSchedulePredecessors,
  validateWorkSchedulePredecessors,
} from "@/lib/work-schedule/predecessors";

describe("parseWorkSchedulePredecessors", () => {
  it("parses multiple MS Project-style predecessors", () => {
    expect(parseWorkSchedulePredecessors("01.01FS,02.03SS+2d,03.01FF-1d")).toEqual([
      { code: "01.01", relation: "FS", lagDays: 0 },
      { code: "02.03", relation: "SS", lagDays: 2 },
      { code: "03.01", relation: "FF", lagDays: -1 },
    ]);
  });

  it("accepts a bare code and defaults it to FS", () => {
    expect(parseWorkSchedulePredecessors("01.01")).toEqual([{ code: "01.01", relation: "FS", lagDays: 0 }]);
  });

  it("rejects malformed syntax", () => {
    expect(() => parseWorkSchedulePredecessors("01.01XY")).toThrow("Ingresa una predecesora valida");
    expect(() => parseWorkSchedulePredecessors("01.01FS+")).toThrow("Ingresa una predecesora valida");
  });
});

describe("validateWorkSchedulePredecessors", () => {
  it("rejects references to missing item codes", () => {
    expect(() =>
      validateWorkSchedulePredecessors("01.01FS,99.99SS", {
        allowedCodes: new Set(["01.01", "02.01"]),
        currentItemCode: "02.01",
      }),
    ).toThrow("La predecesora 99.99 no existe en este cronograma");
  });

  it("rejects self references", () => {
    expect(() =>
      validateWorkSchedulePredecessors("02.01FS", {
        allowedCodes: new Set(["01.01", "02.01"]),
        currentItemCode: "02.01",
      }),
    ).toThrow("La partida no puede ser predecesora de si misma");
  });
});

describe("formatGeneratedPredecessor", () => {
  it("formats a generated predecessor using FS relation", () => {
    expect(formatGeneratedPredecessor("01.01")).toBe("01.01FS");
  });
});
