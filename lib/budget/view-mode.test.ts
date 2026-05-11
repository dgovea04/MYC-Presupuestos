import { describe, expect, it } from "vitest";
import {
  APP_VIEW_MODE_STORAGE_KEY,
  coerceViewMode,
  readStoredViewMode,
  writeStoredViewMode,
} from "@/lib/budget/view-mode";

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

describe("view mode helpers", () => {
  it("accepts only modern and excel", () => {
    expect(coerceViewMode("modern")).toBe("modern");
    expect(coerceViewMode("excel")).toBe("excel");
    expect(coerceViewMode("dense")).toBe("modern");
    expect(coerceViewMode(null)).toBe("modern");
  });

  it("falls back to modern for missing, invalid, or failing stored values", () => {
    const validStorage: StorageReader = {
      getItem: (key) => {
        expect(key).toBe(APP_VIEW_MODE_STORAGE_KEY);
        return "excel";
      },
    };
    const invalidStorage: StorageReader = {
      getItem: () => "invalid",
    };
    const failingStorage: StorageReader = {
      getItem: () => {
        throw new Error("blocked");
      },
    };

    expect(readStoredViewMode(validStorage)).toBe("excel");
    expect(readStoredViewMode(invalidStorage)).toBe("modern");
    expect(readStoredViewMode(failingStorage)).toBe("modern");
    expect(readStoredViewMode(undefined)).toBe("modern");
    expect(APP_VIEW_MODE_STORAGE_KEY).toBe("app_view_mode");
  });

  it("writes the coerced mode without throwing when storage fails", () => {
    let storedValue = "";
    const writableStorage: StorageWriter = {
      setItem: (key, value) => {
        expect(key).toBe(APP_VIEW_MODE_STORAGE_KEY);
        storedValue = value;
      },
    };
    const failingStorage: StorageWriter = {
      setItem: () => {
        throw new Error("blocked");
      },
    };

    expect(() => writeStoredViewMode(writableStorage, "excel")).not.toThrow();
    expect(storedValue).toBe("excel");
    expect(() => writeStoredViewMode(failingStorage, "modern")).not.toThrow();
    expect(() => writeStoredViewMode(undefined, "modern")).not.toThrow();
  });
});
