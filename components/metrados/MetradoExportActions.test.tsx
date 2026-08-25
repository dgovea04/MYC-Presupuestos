/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MetradoExportActions } from "@/components/metrados/MetradoExportActions";

describe("MetradoExportActions", () => {
  afterEach(() => cleanup());

  it("invokes save without forwarding the click event", () => {
    const onSaveDraft = vi.fn();

    render(
      <MetradoExportActions
        exportHref={null}
        actionState="idle"
        canSave
        canSend
        canImport={false}
        onSaveDraft={onSaveDraft}
        onImportFile={vi.fn()}
        onSendToPartida={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSaveDraft).toHaveBeenCalledWith();
  });

  it("shows the contextual send label", () => {
    render(
      <MetradoExportActions
        exportHref={null}
        actionState="idle"
        canSave
        canSend
        canImport={false}
        onSaveDraft={vi.fn()}
        onImportFile={vi.fn()}
        onSendToPartida={vi.fn()}
        sendLabel="Enviar y volver"
      />,
    );

    expect(screen.getByRole("button", { name: "Enviar y volver" })).toBeTruthy();
  });
});
