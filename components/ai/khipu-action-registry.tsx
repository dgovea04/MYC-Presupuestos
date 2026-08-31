"use client";

import { useEffect, type ReactNode, useSyncExternalStore } from "react";
import type { AiAutocompletePartidaSuggestion } from "@/lib/ai/types";

/**
 * Callbacks that page-level editors provide so that the global Khipu
 * assistant can execute actions in the current page context.
 *
 * Uses useSyncExternalStore with a module-level mutable ref instead of
 * React context because the FloatingAiAssistant renders as a *sibling*
 * of the editor tree, not as a child. Context only flows down; this
 * external-store pattern flows anywhere in the tree.
 */
export type KhipuActionRegistry = {
  /** Navigate to a route within the app (e.g. /budgets/xyz). */
  onNavigate?: (href: string) => void;
  /** Open the APU editor sheet for a partida within a budget. */
  onOpenApuEditor?: (partidaId: string, budgetId: string) => void;
  onOpenPartidaForm?: (suggestion: AiAutocompletePartidaSuggestion) => void;
  onOpenPartidaApu?: (suggestion: AiAutocompletePartidaSuggestion) => void;
};

// ── Module-level mutable state ──────────────────────────────────────

let registryState: KhipuActionRegistry = {};
const subscribers = new Set<() => void>();

function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function getSnapshot(): KhipuActionRegistry {
  return registryState;
}

function notify() {
  for (const cb of [...subscribers]) {
    cb();
  }
}

// ── Provider ────────────────────────────────────────────────────────

/**
 * Wrap page-level editors (BudgetEditor, APU Editor, etc.) with this
 * provider so the floating Khipu assistant can execute actions in-context.
 *
 * Callbacks are registered on mount and cleared on unmount — only one
 * editor should be active at a time (the most recent wins).
 */
export function KhipuActionRegistryProvider({
  children,
  onNavigate,
  onOpenApuEditor,
  onOpenPartidaForm,
  onOpenPartidaApu,
}: {
  children: ReactNode;
  onNavigate?: (href: string) => void;
  onOpenApuEditor?: (partidaId: string, budgetId: string) => void;
  onOpenPartidaForm?: (suggestion: AiAutocompletePartidaSuggestion) => void;
  onOpenPartidaApu?: (suggestion: AiAutocompletePartidaSuggestion) => void;
}) {
  useEffect(() => {
    registryState = { onNavigate, onOpenApuEditor, onOpenPartidaForm, onOpenPartidaApu };
    notify();

    return () => {
      registryState = {};
      notify();
    };
  }, [onNavigate, onOpenApuEditor, onOpenPartidaForm, onOpenPartidaApu]);

  return <>{children}</>;
}

// ── Hook ────────────────────────────────────────────────────────────

/**
 * Read the currently-registered action callbacks from any component
 * in the tree — even siblings of the provider.
 */
export function useKhipuActionRegistry(): KhipuActionRegistry {
  return useSyncExternalStore(subscribe, getSnapshot, () => ({}));
}
