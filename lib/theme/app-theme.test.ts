/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_THEME_STORAGE_KEY, applyAppThemeToDocument, readStoredAppTheme } from "@/lib/theme/app-theme";

describe("app theme helpers", () => {
  afterEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.body.dataset.theme;
  });

  it("reads a supported theme from localStorage", () => {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, "dark");

    expect(readStoredAppTheme()).toBe("dark");
  });

  it("ignores unsupported localStorage values", () => {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, "sepia");

    expect(readStoredAppTheme()).toBeNull();
  });

  it("applies the theme to both html and body datasets", () => {
    applyAppThemeToDocument("dark");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.body.dataset.theme).toBe("dark");
  });

  it("marks the document during a theme transition and clears the marker", () => {
    vi.useFakeTimers();

    try {
      applyAppThemeToDocument("dark", { transition: true });

      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.body.dataset.theme).toBe("dark");
      const firstTransitionToken = document.documentElement.dataset.themeTransitioning;
      expect(firstTransitionToken).toBeDefined();
      expect(document.body.dataset.themeTransitioning).toBe(firstTransitionToken);
      expect(document.documentElement.style.getPropertyValue("--app-transition-border")).toBe("#1a1a1a");
      expect(document.body.style.getPropertyValue("--app-transition-border")).toBe("#1a1a1a");

      applyAppThemeToDocument("light", { transition: true });
      expect(document.documentElement.style.getPropertyValue("--app-transition-border")).toBe("#e2e8f0");
      expect(document.body.style.getPropertyValue("--app-transition-border")).toBe("#e2e8f0");
      expect(document.documentElement.dataset.themeTransitioning).toBeDefined();
      expect(document.documentElement.dataset.themeTransitioning).not.toBe(firstTransitionToken);

      vi.advanceTimersByTime(179);
      expect(document.documentElement.dataset.themeTransitioning).toBeDefined();

      vi.advanceTimersByTime(1);

      expect(document.documentElement.dataset.themeTransitioning).toBeUndefined();
      expect(document.body.dataset.themeTransitioning).toBeUndefined();
      expect(document.documentElement.style.getPropertyValue("--app-transition-border")).toBe("");
      expect(document.body.style.getPropertyValue("--app-transition-border")).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });
});
