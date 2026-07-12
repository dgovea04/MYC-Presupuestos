import { describe, expect, it } from "vitest";
import { detectConfirmation } from "./confirmation";

describe("detectConfirmation", () => {
  describe("affirmative — high confidence (short messages)", () => {
    it.each([
      "si",
      "sí",
      "ok",
      "okay",
      "dale",
      "procede",
      "adelante",
      "hazlo",
      "correcto",
      "confirmado",
      "de acuerdo",
      "vamos",
      "aplica",
      "yes",
    ])('detects "%s" as affirmative (high)', (msg) => {
      const result = detectConfirmation(msg);
      expect(result.kind).toBe("affirmative");
      expect(result.confidence).toBe("high");
    });
  });

  describe("affirmative — medium confidence (longer messages)", () => {
    it.each([
      "si por favor",
      "dale, hazlo",
      "ok, genera el presupuesto",
      "procede con eso",
    ])('detects "%s" as affirmative (medium)', (msg) => {
      const result = detectConfirmation(msg);
      expect(result.kind).toBe("affirmative");
      // These start with affirmative phrase followed by space/punctuation
      const confidences = ["high", "medium"];
      expect(confidences).toContain(result.confidence);
    });
  });

  describe("negative", () => {
    it.each([
      "no", "cancelar", "no gracias", "mejor no", "detente", "stop",
    ])('detects "%s" as negative', (msg) => {
      const result = detectConfirmation(msg);
      expect(result.kind).toBe("negative");
    });
  });

  describe("modify", () => {
    it("detects change requests", () => {
      const result = detectConfirmation("cambia el área a 150m2");
      expect(result.kind).toBe("modify");
      if (result.kind === "modify") {
        expect(result.requestedChange).toBe("el área a 150m2");
      }
    });

    it("detects 'en vez de' as modify", () => {
      const result = detectConfirmation("en vez de vivienda, usa edificio");
      expect(result.kind).toBe("modify");
    });

    it("detects 'prefiero' as modify", () => {
      const result = detectConfirmation("prefiero usar catálogo");
      expect(result.kind).toBe("modify");
    });
  });

  describe("unclear", () => {
    it.each([
      "hola",
      "gracias",
      "qué tal",
      "necesito ayuda con algo",
    ])('detects "%s" as unclear', (msg) => {
      const result = detectConfirmation(msg);
      expect(result.kind).toBe("unclear");
      expect(result.confidence).toBe("low");
    });
  });

  it("short negative is high confidence", () => {
    const result = detectConfirmation("no");
    expect(result.kind).toBe("negative");
    expect(result.confidence).toBe("high");
  });

  it("longer negative is medium confidence", () => {
    const result = detectConfirmation("no quiero hacer eso ahora, gracias");
    expect(result.kind).toBe("negative");
    expect(result.confidence).toBe("medium");
  });

  it("affirmative words inside longer text are not flagged as affirmative", () => {
    // "si" inside "necesito un presupuesto para una casa" should not be affirmative
    const result = detectConfirmation("necesito un presupuesto para una casa de 120m2");
    expect(result.kind).toBe("unclear");
  });
});
