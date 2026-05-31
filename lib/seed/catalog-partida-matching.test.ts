import { describe, expect, it } from "vitest";

import { findSeedPartidaApuMatch } from "@/lib/seed/catalog-partida-matching";

describe("findSeedPartidaApuMatch", () => {
  it("falls back to a unique description match when partida and APU units differ", () => {
    const apuByKey = new Map([
      ["POZO A TIERRA|UND", { description: "POZO A TIERRA", unit: "UND" }],
      ["OTRA PARTIDA|UND", { description: "OTRA PARTIDA", unit: "UND" }],
    ]);

    expect(
      findSeedPartidaApuMatch({
        description: "POZO A TIERRA",
        unit: "PTO",
        apuByKey,
        buildMatchKey: (description, unit) => `${description}|${unit}`,
        normalizeDescription: (description) => description,
      }),
    ).toEqual({
      key: "POZO A TIERRA|UND",
      apu: { description: "POZO A TIERRA", unit: "UND" },
      matchedBy: "description",
    });
  });

  it("does not use description fallback when the description is ambiguous", () => {
    const apuByKey = new Map([
      ["TABLERO|UND", { description: "TABLERO", unit: "UND" }],
      ["TABLERO|PTO", { description: "TABLERO", unit: "PTO" }],
    ]);

    expect(
      findSeedPartidaApuMatch({
        description: "TABLERO",
        unit: "GLB",
        apuByKey,
        buildMatchKey: (description, unit) => `${description}|${unit}`,
        normalizeDescription: (description) => description,
      }),
    ).toBeNull();
  });
});
