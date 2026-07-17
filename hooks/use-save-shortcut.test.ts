/* @vitest-environment jsdom */

import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSaveShortcut } from "./use-save-shortcut";

describe("useSaveShortcut", () => {
  it("calls onSave when Ctrl+S is pressed", () => {
    const onSave = vi.fn();
    renderHook(() => useSaveShortcut({ onSave }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("calls onSave when Cmd+S is pressed", () => {
    const onSave = vi.fn();
    renderHook(() => useSaveShortcut({ onSave }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true }));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("does not call onSave when the shortcut is disabled", () => {
    const onSave = vi.fn();
    renderHook(() => useSaveShortcut({ onSave, enabled: false }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not call onSave when focus is in an input", () => {
    const onSave = vi.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useSaveShortcut({ onSave }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    });

    expect(onSave).not.toHaveBeenCalled();

    input.remove();
  });

  it("does not call onSave when focus is in a textarea", () => {
    const onSave = vi.fn();
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();

    renderHook(() => useSaveShortcut({ onSave }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    });

    expect(onSave).not.toHaveBeenCalled();

    textarea.remove();
  });

  it("does not call onSave when focus is in a select", () => {
    const onSave = vi.fn();
    const select = document.createElement("select");
    document.body.appendChild(select);
    select.focus();

    renderHook(() => useSaveShortcut({ onSave }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    });

    expect(onSave).not.toHaveBeenCalled();

    select.remove();
  });

  it.each([
    { label: "Ctrl+A", event: { key: "a", ctrlKey: true } },
    { label: "Ctrl+Shift+S", event: { key: "s", ctrlKey: true, shiftKey: true } },
    { label: "Ctrl+Alt+S", event: { key: "s", ctrlKey: true, altKey: true } },
    { label: "Cmd+Shift+S", event: { key: "s", metaKey: true, shiftKey: true } },
    { label: "S without modifier", event: { key: "s" } },
  ])("does not call onSave when pressing $label", ({ event }) => {
    const onSave = vi.fn();
    renderHook(() => useSaveShortcut({ onSave }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...event }));
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls the latest onSave callback after it changes", () => {
    const firstOnSave = vi.fn();
    const secondOnSave = vi.fn();

    const { rerender } = renderHook(({ onSave }) => useSaveShortcut({ onSave }), {
      initialProps: { onSave: firstOnSave },
    });

    rerender({ onSave: secondOnSave });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    });

    expect(firstOnSave).not.toHaveBeenCalled();
    expect(secondOnSave).toHaveBeenCalledTimes(1);
  });
});
