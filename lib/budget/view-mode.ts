export const APP_VIEW_MODE_STORAGE_KEY = "app_view_mode" as const;

export type ViewMode = "modern" | "excel";

type ViewModeStorageReader = Pick<Storage, "getItem">;
type ViewModeStorageWriter = Pick<Storage, "setItem">;

export function coerceViewMode(value: string | null | undefined): ViewMode {
  return value === "excel" ? "excel" : "modern";
}

export function getStoredViewModeFromValue(value: string | null | undefined): ViewMode {
  return coerceViewMode(value);
}

export function readStoredViewMode(storage?: ViewModeStorageReader): ViewMode {
  try {
    return getStoredViewModeFromValue(storage?.getItem(APP_VIEW_MODE_STORAGE_KEY));
  } catch {
    return "modern";
  }
}

export function writeStoredViewMode(storage: ViewModeStorageWriter | undefined, mode: ViewMode): void {
  try {
    storage?.setItem(APP_VIEW_MODE_STORAGE_KEY, coerceViewMode(mode));
  } catch {
    // Ignore storage failures so the UI can continue using in-memory state.
  }
}
