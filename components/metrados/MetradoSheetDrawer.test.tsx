/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MetradoSheetDrawer } from "@/components/metrados/MetradoSheetDrawer";

describe("MetradoSheetDrawer", () => {
  afterEach(() => cleanup());

  it("shows an explicit header action without closing the drawer", () => {
    const onClose = vi.fn();
    const onHeaderAction = vi.fn();

    render(
      <MetradoSheetDrawer
        sheet={null}
        open
        onClose={onClose}
        headerActionLabel="Enviar y volver"
        onHeaderAction={onHeaderAction}
      >
        <div>Contenido</div>
      </MetradoSheetDrawer>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar y volver" }));

    expect(onHeaderAction).toHaveBeenCalledWith();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Cerrar" })).toBeNull();
  });
});
