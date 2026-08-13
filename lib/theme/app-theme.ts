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

let appThemeTransitionSequence = 0;
let appThemeTransitionTimeout: number | null = null;

const APP_THEME_TRANSITION_BORDER: Record<AppThemeOption, string> = {
  light: "#e2e8f0",
  dark: "#1a1a1a",
};

export function applyAppThemeToDocument(theme: AppThemeOption, options: { transition?: boolean } = {}) {
  if (typeof document === "undefined") {
    return;
  }

  const transitionToken = options.transition ? String(++appThemeTransitionSequence) : null;
  const themeRoots = [document.documentElement, document.body].filter(
    (root): root is HTMLElement => root instanceof HTMLElement,
  );

  if (transitionToken) {
    if (appThemeTransitionTimeout !== null) {
      window.clearTimeout(appThemeTransitionTimeout);
    }

    for (const root of themeRoots) {
      root.dataset.themeTransitioning = transitionToken;
      root.style.setProperty("--app-transition-border", APP_THEME_TRANSITION_BORDER[theme]);
    }
  }

  document.documentElement.dataset.theme = theme;

  if (document.body) {
    document.body.dataset.theme = theme;
  }

  if (transitionToken) {
    const prefersReducedMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion ? 0 : 220;

    appThemeTransitionTimeout = window.setTimeout(() => {
      let clearedCurrentTransition = false;

      for (const root of [document.documentElement, document.body]) {
        if (root?.dataset.themeTransitioning === transitionToken) {
          delete root.dataset.themeTransitioning;
          root.style.removeProperty("--app-transition-border");
          clearedCurrentTransition = true;
        }
      }

      if (clearedCurrentTransition) {
        appThemeTransitionTimeout = null;
      }
    }, duration);
  }
}
