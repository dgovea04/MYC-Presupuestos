import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  getDefaultPresets,
  loadShowDefaults,
  saveShowDefaults,
} from "@/lib/resumen-date-presets";

// Vitest runs in node environment (no localStorage), so we provide a mock
beforeAll(() => {
  const store = new Map<string, string>();

  vi.stubGlobal(
    "localStorage",
    {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(() => store.clear()),
      get length() {
        return store.size;
      },
      key: vi.fn(() => null),
    } as Storage,
  );
});

describe("getDefaultPresets", () => {
  test("returns four presets with correct ids", () => {
    const presets = getDefaultPresets(new Date("2026-06-11T10:00:00"));

    expect(presets).toHaveLength(4);
    expect(presets[0]?.id).toBe("default-last-30-days");
    expect(presets[1]?.id).toBe("default-this-month");
    expect(presets[2]?.id).toBe("default-this-year");
    expect(presets[3]?.id).toBe("default-custom");
  });

  test("'Últimos 30 días' has dateFrom = today - 30 days", () => {
    const presets = getDefaultPresets(new Date("2026-06-11T10:00:00"));

    expect(presets[0]?.name).toBe("Últimos 30 días");
    expect(presets[0]?.dateFrom).toBe("2026-05-12");
    expect(presets[0]?.dateTo).toBe("2026-06-11");
  });

  test("'Últimos 30 días' crosses month boundaries correctly", () => {
    const presets = getDefaultPresets(new Date("2026-03-15T10:00:00"));

    expect(presets[0]?.dateFrom).toBe("2026-02-13");
    expect(presets[0]?.dateTo).toBe("2026-03-15");
  });

  test("'Últimos 30 días' crosses year boundaries correctly", () => {
    const presets = getDefaultPresets(new Date("2026-01-15T10:00:00"));

    expect(presets[0]?.dateFrom).toBe("2025-12-16");
    expect(presets[0]?.dateTo).toBe("2026-01-15");
  });

  test("'Este mes' starts on the first day of the current month", () => {
    const presets = getDefaultPresets(new Date("2026-06-11T10:00:00"));

    expect(presets[1]?.name).toBe("Este mes");
    expect(presets[1]?.dateFrom).toBe("2026-06-01");
    expect(presets[1]?.dateTo).toBe("2026-06-11");
  });

  test("'Este mes' works for January", () => {
    const presets = getDefaultPresets(new Date("2026-01-25T10:00:00"));

    expect(presets[1]?.dateFrom).toBe("2026-01-01");
    expect(presets[1]?.dateTo).toBe("2026-01-25");
  });

  test("'Este año' starts on January 1st of the current year", () => {
    const presets = getDefaultPresets(new Date("2026-06-11T10:00:00"));

    expect(presets[2]?.name).toBe("Este año");
    expect(presets[2]?.dateFrom).toBe("2026-01-01");
    expect(presets[2]?.dateTo).toBe("2026-06-11");
  });

  test("'Este año' returns early-year dates correctly", () => {
    const presets = getDefaultPresets(new Date("2026-03-05T10:00:00"));

    expect(presets[2]?.dateFrom).toBe("2026-01-01");
    expect(presets[2]?.dateTo).toBe("2026-03-05");
  });

  test("all pre-filled presets share the same dateTo (today)", () => {
    const presets = getDefaultPresets(new Date("2026-12-25T10:00:00"));
    const today = "2026-12-25";
    const preFilled = presets.filter((p) => p.dateTo !== "");

    expect(preFilled.length).toBeGreaterThanOrEqual(1);
    for (const preset of preFilled) {
      expect(preset.dateTo).toBe(today);
    }
  });

  test("uses local timezone dates, not UTC", () => {
    // Late evening local time should still produce today's local date
    const presets = getDefaultPresets(new Date("2026-06-11T23:59:59"));

    expect(presets[0]?.dateTo).toBe("2026-06-11");
    expect(presets[1]?.dateTo).toBe("2026-06-11");
    expect(presets[2]?.dateTo).toBe("2026-06-11");
  });

  test("presets have non-empty date strings except Personalizado", () => {
    const presets = getDefaultPresets(new Date("2026-06-11T10:00:00"));

    for (const preset of presets) {
      if (preset.id === "default-custom") {
        expect(preset.dateFrom).toBe("");
        expect(preset.dateTo).toBe("");
      } else {
        expect(preset.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(preset.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  test("Personalizado preset has empty dateFrom and dateTo", () => {
    const presets = getDefaultPresets(new Date("2026-06-11T10:00:00"));
    const custom = presets.find((p) => p.id === "default-custom");

    expect(custom).toBeDefined();
    expect(custom?.name).toBe("Personalizado");
    expect(custom?.dateFrom).toBe("");
    expect(custom?.dateTo).toBe("");
  });
});

describe("loadShowDefaults / saveShowDefaults", () => {
  const projectId = "test-project-123";

  afterEach(() => {
    localStorage.clear();
  });

  test("returns true when no value is stored", () => {
    expect(loadShowDefaults(projectId)).toBe(true);
  });

  test("saves and reads back false", () => {
    saveShowDefaults(projectId, false);
    expect(loadShowDefaults(projectId)).toBe(false);
  });

  test("saves and reads back true", () => {
    saveShowDefaults(projectId, true);
    expect(loadShowDefaults(projectId)).toBe(true);
  });

  test("overwrites previous value", () => {
    saveShowDefaults(projectId, false);
    saveShowDefaults(projectId, true);
    expect(loadShowDefaults(projectId)).toBe(true);
  });

  test("is scoped per project ID", () => {
    saveShowDefaults("project-a", true);
    saveShowDefaults("project-b", false);

    expect(loadShowDefaults("project-a")).toBe(true);
    expect(loadShowDefaults("project-b")).toBe(false);
  });

  test("falls back to true when localStorage throws on read", () => {
    const origGetItem = localStorage.getItem.bind(localStorage);
    localStorage.getItem = vi.fn(() => {
      throw new Error("localStorage unavailable");
    });

    expect(loadShowDefaults(projectId)).toBe(true);

    localStorage.getItem = origGetItem;
  });

  test("silently ignores localStorage errors on write", () => {
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = vi.fn(() => {
      throw new Error("localStorage full");
    });

    expect(() => saveShowDefaults(projectId, false)).not.toThrow();

    localStorage.setItem = origSetItem;
  });

  test("reads stored string 'true' as boolean true", () => {
    localStorage.setItem("myc-metrado-show-defaults-" + projectId, "true");
    expect(loadShowDefaults(projectId)).toBe(true);
  });

  test("reads stored string 'false' as boolean false", () => {
    localStorage.setItem("myc-metrado-show-defaults-" + projectId, "false");
    expect(loadShowDefaults(projectId)).toBe(false);
  });

  test("treats any non-'true' string as false", () => {
    localStorage.setItem("myc-metrado-show-defaults-" + projectId, "yes");
    expect(loadShowDefaults(projectId)).toBe(false);
  });
});
