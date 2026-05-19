import { describe, expect, it } from "vitest";

import { normalizeResourceIuCode } from "@/lib/resources/iu";

describe("normalizeResourceIuCode", () => {
  it("extracts the numeric IU code and removes the description", () => {
    expect(normalizeResourceIuCode("47 : MANO DE OBRA (INCLUYE LEYES SOCIALES)")).toBe("47");
    expect(normalizeResourceIuCode("3 : ACERO DE CONSTRUCCION CORRUGADO")).toBe("03");
    expect(normalizeResourceIuCode("03")).toBe("03");
    expect(normalizeResourceIuCode(" 01 : ACEITE Y LUBRICANTE ")).toBe("01");
  });

  it("returns null for empty or invalid IU values", () => {
    expect(normalizeResourceIuCode("")).toBeNull();
    expect(normalizeResourceIuCode(" : ")).toBeNull();
    expect(normalizeResourceIuCode(null)).toBeNull();
  });
});
