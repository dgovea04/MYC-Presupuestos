import { describe, expect, it } from "vitest";
import { createGuidedBudgetPaste } from "@/lib/budgets/paste-import";

describe("createGuidedBudgetPaste", () => {
  it("parses a flat valid block and keeps insert-below as the default action", () => {
    const result = createGuidedBudgetPaste({
      rawText: "IT-77\tPartida importada\tm2\t12,50",
      startColumn: "code",
      targetKind: "item",
      applyMode: "insert-below",
    });

    expect(result.detectedMode).toBe("flat");
    expect(result.selectedMode).toBe("flat");
    expect(result.applyMode).toBe("insert-below");
    expect(result.importedItems).toBe(1);
    expect(result.importedLevels).toBe(0);
    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([{ code: "IT-77", description: "Partida importada", unit: "m2", quantity: 12.5 }]);
  });

  it("detects a structured block by code and creates hierarchical entries", () => {
    const result = createGuidedBudgetPaste({
      rawText: "01\tOBRAS PRELIMINARES\n01.01\tTrazo y replanteo\tm2\t10",
      startColumn: "code",
      targetKind: "level",
      applyMode: "insert-inside-level",
    });

    expect(result.detectedMode).toBe("structured-by-code");
    expect(result.importedLevels).toBe(1);
    expect(result.importedItems).toBe(1);
    expect(result.entries).toEqual([
      { kind: "level", code: "01", name: "OBRAS PRELIMINARES", depth: 0, levelType: "TITLE", sourceRowIndex: 0 },
      {
        kind: "item",
        values: { code: "01.01", description: "Trazo y replanteo", unit: "m2", quantity: 10 },
        parentDepth: 0,
        sourceRowIndex: 1,
      },
    ]);
  });

  it("treats every top-level numeric code as a title when codes exist", () => {
    const result = createGuidedBudgetPaste({
      rawText: "1\tUNO\n2\tDOS\n3\tTRES\n3.1\tSUBTITULO",
      startColumn: "code",
      targetKind: "level",
      applyMode: "insert-inside-level",
    });

    expect(result.entries).toEqual([
      { kind: "level", code: "1", name: "UNO", depth: 0, levelType: "TITLE", sourceRowIndex: 0 },
      { kind: "level", code: "2", name: "DOS", depth: 0, levelType: "TITLE", sourceRowIndex: 1 },
      { kind: "level", code: "3", name: "TRES", depth: 0, levelType: "TITLE", sourceRowIndex: 2 },
      { kind: "level", code: "3.1", name: "SUBTITULO", depth: 1, levelType: "SUBTITLE", sourceRowIndex: 3 },
    ]);
  });

  it("does not downgrade later top-level numeric codes to subtitles just because they follow another title", () => {
    const result = createGuidedBudgetPaste({
      rawText: "1\tUNO\n2\tDOS\n3\tTRES",
      startColumn: "code",
      targetKind: "level",
      applyMode: "insert-inside-level",
    });

    expect(result.entries).toEqual([
      { kind: "level", code: "1", name: "UNO", depth: 0, levelType: "TITLE", sourceRowIndex: 0 },
      { kind: "level", code: "2", name: "DOS", depth: 0, levelType: "TITLE", sourceRowIndex: 1 },
      { kind: "level", code: "3", name: "TRES", depth: 0, levelType: "TITLE", sourceRowIndex: 2 },
    ]);
  });

  it("detects a structured block by indentation and warns when item rows omit codes", () => {
    const result = createGuidedBudgetPaste({
      rawText: "OBRAS PRELIMINARES\n  Trazo y replanteo\tm2\t10",
      startColumn: "description",
      targetKind: "level",
      applyMode: "insert-inside-level",
    });

    expect(result.detectedMode).toBe("structured-by-indent");
    expect(result.selectedMode).toBe("structured-by-indent");
    expect(result.importedLevels).toBe(1);
    expect(result.importedItems).toBe(1);
    expect(result.hasErrors).toBe(false);
    expect(result.issues.map((issue) => issue.message)).toContain("La fila no tiene codigo y se interpretara por indentacion.");
  });

  it("only starts a subtitle when the immediately previous text is a title, never after intervening items", () => {
    const result = createGuidedBudgetPaste({
      rawText: [
        "OBRAS PRELIMINARES",
        "MOVIMIENTO DE TIERRAS",
        "Excavacion manual\tm3\t5",
        "Relleno compactado\tm3\t3",
        "TRANSPORTE",
        "Eliminacion material\tm3\t2",
        "INSTALACIONES",
        "ELECTRICAS",
        "Tuberia PVC\tm\t4",
      ].join("\n"),
      startColumn: "description",
      targetKind: "level",
      applyMode: "insert-inside-level",
    });

    expect(result.entries).toEqual([
      { kind: "level", code: undefined, name: "OBRAS PRELIMINARES", depth: 0, levelType: "TITLE", sourceRowIndex: 0 },
      { kind: "level", code: undefined, name: "MOVIMIENTO DE TIERRAS", depth: 1, levelType: "SUBTITLE", sourceRowIndex: 1 },
      {
        kind: "item",
        values: { description: "Excavacion manual", unit: "m3", quantity: 5 },
        parentDepth: 1,
        sourceRowIndex: 2,
      },
      {
        kind: "item",
        values: { description: "Relleno compactado", unit: "m3", quantity: 3 },
        parentDepth: 1,
        sourceRowIndex: 3,
      },
      { kind: "level", code: undefined, name: "TRANSPORTE", depth: 0, levelType: "TITLE", sourceRowIndex: 4 },
      {
        kind: "item",
        values: { description: "Eliminacion material", unit: "m3", quantity: 2 },
        parentDepth: 0,
        sourceRowIndex: 5,
      },
      { kind: "level", code: undefined, name: "INSTALACIONES", depth: 0, levelType: "TITLE", sourceRowIndex: 6 },
      { kind: "level", code: undefined, name: "ELECTRICAS", depth: 1, levelType: "SUBTITLE", sourceRowIndex: 7 },
      {
        kind: "item",
        values: { description: "Tuberia PVC", unit: "m", quantity: 4 },
        parentDepth: 1,
        sourceRowIndex: 8,
      },
    ]);
  });

  it("blocks ambiguous blocks with invalid hierarchy jumps", () => {
    const result = createGuidedBudgetPaste({
      rawText: "01.01\tSubtitulo sin padre\n01.01.01\tPartida\tm2\t3",
      startColumn: "code",
      targetKind: "level",
      applyMode: "insert-inside-level",
    });

    expect(result.detectedMode).toBe("structured-by-code");
    expect(result.hasErrors).toBe(true);
    expect(result.issues.some((issue) => issue.severity === "error" && issue.message.includes("salta niveles"))).toBe(true);
  });

  it("ignores preamble/header rows and accepts decimal quantities with comma", () => {
    const result = createGuidedBudgetPaste({
      rawText:
        "Presupuesto:\tDemo\nSubpresupuesto:\tObras preliminares\nItem\tPartida\tUnidad\tMetrado\nIT-88\tCorte manual\tm3\t1,25",
      startColumn: "code",
      targetKind: "item",
      applyMode: "insert-below",
    });

    expect(result.rows).toEqual([{ code: "IT-88", description: "Corte manual", unit: "m3", quantity: 1.25 }]);
    expect(result.issues).toEqual([]);
  });

  it("reports blocking errors for non numeric quantities and non blocking warnings for missing units", () => {
    const result = createGuidedBudgetPaste({
      rawText: "IT-99\tPartida sin unidad\t\t4\nIT-100\tPartida invalida\tm2\tabc",
      startColumn: "code",
      targetKind: "item",
      applyMode: "insert-below",
    });

    expect(result.hasErrors).toBe(true);
    expect(result.issues.some((issue) => issue.severity === "warning" && issue.message.includes("unidad"))).toBe(true);
    expect(result.issues.some((issue) => issue.severity === "error" && issue.message.includes("metrado"))).toBe(true);
  });
});
