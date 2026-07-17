"use client";

import { useEffect, useRef } from "react";

export type UseSaveShortcutOptions = {
  /** Whether the shortcut listener is active. Defaults to `true`. */
  enabled?: boolean;
  /** Callback invoked when the save shortcut is triggered. */
  onSave: () => void;
};

/**
 * Listens for the platform save shortcut (Ctrl+S or Cmd+S) on `document`
 * and calls `onSave` when it is pressed.
 *
 * Behavior:
 * - Triggers only on plain Ctrl+S (Windows/Linux) or Cmd+S (macOS).
 * - Ignores combinations with Shift or Alt (e.g. Ctrl+Shift+S, Ctrl+Alt+S).
 * - Ignores the shortcut when focus is inside an input, textarea or select
 *   so that typing does not accidentally trigger a save.
 * - Calls `event.preventDefault()` to avoid the browser's native save dialog.
 * - Uses a ref to always invoke the latest `onSave` callback.
 *
 * @example
 * ```tsx
 * function Editor() {
 *   useSaveShortcut({ onSave: () => saveDraft() });
 *   return <form>...</form>;
 * }
 * ```
 */
export function useSaveShortcut({ enabled = true, onSave }: UseSaveShortcutOptions) {
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s" &&
        !event.shiftKey &&
        !event.altKey;
      if (!isSaveShortcut) return;

      const activeElement = document.activeElement;
      const isTypingInField =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      if (isTypingInField) return;

      event.preventDefault();
      onSaveRef.current();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
