/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetradoHistory } from "@/components/metrados/MetradoHistory";
import type { MetradoSheetRecord } from "@/types/metrado";

const sheet = {
  id: "sheet-1",
  name: "Metrado histórico",
  totalQuantity: 10,
  isActive: false,
  partidaLink: { budgetItemDescription: "Excavación manual" },
} as unknown as MetradoSheetRecord;

describe("MetradoHistory", () => {
  it("renders and reactivates a historical sheet", () => {
    const onReactivate = vi.fn().mockResolvedValue(undefined);
    render(<MetradoHistory sheets={[sheet]} onReactivate={onReactivate} />);
    expect(screen.getByText("Metrado histórico")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));
    expect(onReactivate).toHaveBeenCalledWith(sheet);
  });
});
