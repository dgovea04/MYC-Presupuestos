export const APP_VIEW_MODE_STORAGE_KEY = "app_view_mode" as const;
export const APP_VIEW_MODE_COOKIE_NAME = "app_view_mode" as const;
export const APP_VIEW_MODE_SETTINGS_UPDATED_EVENT = "myc:app-view-mode-settings-updated" as const;

export type ViewMode = "modern" | "excel";

type ViewModeStorageReader = Pick<Storage, "getItem">;
type ViewModeStorageWriter = Pick<Storage, "setItem">;
type ViewModeSettingsUpdateDetail = {
  defaultViewMode: ViewMode;
  excelShowFieldBorders: boolean;
  excelRowHeight: number;
};

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

export function hasStoredViewMode(storage?: ViewModeStorageReader): boolean {
  try {
    return storage?.getItem(APP_VIEW_MODE_STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

export function writeStoredViewMode(storage: ViewModeStorageWriter | undefined, mode: ViewMode): void {
  try {
    const nextMode = coerceViewMode(mode);

    storage?.setItem(APP_VIEW_MODE_STORAGE_KEY, nextMode);
    applyViewModeToDocument(nextMode);

    if (typeof document !== "undefined") {
      document.cookie = `${APP_VIEW_MODE_COOKIE_NAME}=${nextMode}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }
  } catch {
    // Ignore storage failures so the UI can continue using in-memory state.
  }
}

export function applyViewModeToDocument(mode: ViewMode): void {
  if (typeof document === "undefined") {
    return;
  }

  const nextMode = coerceViewMode(mode);
  document.documentElement.dataset.viewMode = nextMode;
}

export function dispatchAppViewModeSettingsUpdated(detail: ViewModeSettingsUpdateDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(APP_VIEW_MODE_SETTINGS_UPDATED_EVENT, { detail }));
}
