/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetradoCell } from "@/components/metrados/MetradoCell";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a>,
}));

describe("MetradoCell", () => {
  it("saves the value and exposes the advanced action", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onOpenAdvanced = vi.fn();
    render(
      <MetradoCell
        itemId="item-1"
        description="Excavación"
        projectId="project-1"
        budgetId="budget-1"
        quantity={10}
        onSave={onSave}
        onOpenAdvanced={onOpenAdvanced}
      />,
    );

    const input = screen.getByLabelText("Metrado de Excavación");
    fireEvent.change(input, { target: { value: "12,5" } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole("button", { name: "Abrir metrados avanzados" }));

    expect(onSave).toHaveBeenCalledWith("12,5");
    expect(onOpenAdvanced).toHaveBeenCalled();
  });

  it("renders an advanced quantity as an actionable locked field", () => {
    const onRequestManualOverride = vi.fn();
    render(
      <MetradoCell
        itemId="item-1"
        description="Excavacion"
        projectId="project-1"
        budgetId="budget-1"
        quantity={10}
        advancedQuantity={10}
        hasAdvancedSheet
        onSave={vi.fn().mockResolvedValue(undefined)}
        onRequestManualOverride={onRequestManualOverride}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Metrado de Excavacion" }));

    expect(onRequestManualOverride).toHaveBeenCalledWith("10.00");
  });
});
