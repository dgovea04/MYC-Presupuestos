import { describe, expect, test } from "vitest";

import {
  getMetradoTemplateByType,
  metradoTemplates,
} from "@/lib/metrados/templates";

describe("metradoTemplates", () => {
  test("defines the required construction template types", () => {
    expect(metradoTemplates.map((template) => template.type)).toEqual([
      "CONCRETE",
      "REBAR",
      "FORMWORK",
      "MASONRY",
      "PLASTER",
      "PAINT",
      "EXCAVATION",
      "FLOORING",
      "ROOFING",
      "CUSTOM",
    ]);
  });

  test("exposes formulas and default units for concrete and rebar", () => {
    expect(getMetradoTemplateByType("CONCRETE")).toMatchObject({
      type: "CONCRETE",
      defaultUnit: "m3",
      formulaKeys: ["volume"],
    });
    expect(getMetradoTemplateByType("REBAR")).toMatchObject({
      type: "REBAR",
      defaultUnit: "kg",
      formulaKeys: ["rebarWeight"],
    });
  });

  test("returns null for an unknown template type", () => {
    expect(getMetradoTemplateByType("UNKNOWN")).toBeNull();
  });
});
