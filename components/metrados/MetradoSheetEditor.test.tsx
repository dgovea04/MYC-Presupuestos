/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetradoSheetEditor } from "@/components/metrados/MetradoSheetEditor";
import type { MetradoSheetRecord } from "@/types/metrado";

const sheet = { id: "sheet-1" } as MetradoSheetRecord;

describe("MetradoSheetEditor", () => {
  it("renders controlled editor regions", () => {
    render(
      <MetradoSheetEditor
        sheet={sheet}
        formulaBar={<div>Formula</div>}
        table={<div>Tabla</div>}
        summary={<div>Resumen</div>}
      />,
    );

    expect(screen.getByTestId("metrado-sheet-editor").getAttribute("data-sheet-id")).toBe("sheet-1");
    expect(screen.getByText("Formula")).toBeTruthy();
    expect(screen.getByText("Tabla")).toBeTruthy();
    expect(screen.getByText("Resumen")).toBeTruthy();
  });
});
