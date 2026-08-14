/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
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

  it("ignores transition options without adding temporary document markers", () => {
    applyAppThemeToDocument("dark", { transition: true });

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.body.dataset.theme).toBe("dark");
    expect(Object.keys(document.documentElement.dataset)).toEqual(["theme"]);
    expect(Object.keys(document.body.dataset)).toEqual(["theme"]);
  });
});
