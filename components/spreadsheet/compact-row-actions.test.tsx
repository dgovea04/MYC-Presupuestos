/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BotMessageSquare } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompactRowActions } from "@/components/spreadsheet/compact-row-actions";

afterEach(() => {
  cleanup();
});

describe("CompactRowActions", () => {
  it("opens compact row actions and triggers an action", async () => {
    const onSelect = vi.fn();
    render(
      <CompactRowActions
        actions={[
          {
            id: "ai",
            label: "Explicar con IA",
            icon: <BotMessageSquare aria-hidden="true" />,
            onSelect,
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Abrir acciones de fila" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Explicar con IA" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes the menu when clicking outside", async () => {
    render(
      <CompactRowActions
        actions={[
          { id: "ai", label: "Explicar con IA", icon: <span aria-hidden />, onSelect: vi.fn() },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Abrir acciones de fila" }));
    expect(screen.getByRole("menu")).toBeTruthy();

    await userEvent.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("supports a custom trigger label and disabled actions", async () => {
    const onSelect = vi.fn();
    render(
      <CompactRowActions
        triggerLabel="Custom actions"
        actions={[
          { id: "a", label: "Action A", icon: <span aria-hidden />, onSelect, disabled: true },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Custom actions" }));
    const menuItem = screen.getByRole("menuitem", { name: "Action A" });
    expect(menuItem.hasAttribute("disabled")).toBe(true);
  });
});
