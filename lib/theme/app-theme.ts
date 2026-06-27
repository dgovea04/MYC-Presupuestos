import type { AppThemeOption } from "@/types/settings";

export const APP_THEME_STORAGE_KEY = "myc:app-theme";
export const APP_THEME_COOKIE_NAME = "myc_app_theme";

export function isAppThemeOption(value: unknown): value is AppThemeOption {
  return value === "light" || value === "dark";
}

export function readStoredAppTheme(): AppThemeOption | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedTheme = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
  return isAppThemeOption(storedTheme) ? storedTheme : null;
}

export function persistAppTheme(theme: AppThemeOption) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
  document.cookie = `${APP_THEME_COOKIE_NAME}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

export function applyAppThemeToDocument(theme: AppThemeOption) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;

  if (document.body) {
    document.body.dataset.theme = theme;
  }
}
