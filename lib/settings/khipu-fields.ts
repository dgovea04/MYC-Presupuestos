import type { UserSettingsRecord } from "@/types/settings";

/**
 * Merge only known Khipu-specific fields from a raw settings object into
 * a settings record. Non-Khipu fields (currency, date format, view mode,
 * etc.) are silently ignored.
 *
 * Returns `prev` unchanged (same reference) when no Khipu field has
 * actually changed, avoiding unnecessary React re-renders.
 *
 * Used by the floating assistant to stay in sync with the settings
 * page without accidentally picking up unrelated configuration values.
 */
export function mergeKhipuFields(
  prev: UserSettingsRecord,
  source: Record<string, unknown>,
): UserSettingsRecord {
  let next: UserSettingsRecord | null = null;

  if (typeof source.floatingKhipuProvider === "string" && source.floatingKhipuProvider !== prev.floatingKhipuProvider) {
    next = { ...(next ?? prev), floatingKhipuProvider: source.floatingKhipuProvider as typeof prev.floatingKhipuProvider };
  }
  if (typeof source.floatingKhipuWidth === "number" && source.floatingKhipuWidth !== prev.floatingKhipuWidth) {
    next = { ...(next ?? prev), floatingKhipuWidth: source.floatingKhipuWidth };
  }
  if (typeof source.floatingKhipuHeight === "number" && source.floatingKhipuHeight !== prev.floatingKhipuHeight) {
    next = { ...(next ?? prev), floatingKhipuHeight: source.floatingKhipuHeight };
  }
  if (typeof source.floatingKhipuFontSize === "string" && source.floatingKhipuFontSize !== prev.floatingKhipuFontSize) {
    next = { ...(next ?? prev), floatingKhipuFontSize: source.floatingKhipuFontSize as typeof prev.floatingKhipuFontSize };
  }
  if (typeof source.floatingKhipuPosition === "string" && source.floatingKhipuPosition !== prev.floatingKhipuPosition) {
    next = { ...(next ?? prev), floatingKhipuPosition: source.floatingKhipuPosition as typeof prev.floatingKhipuPosition };
  }
  if (typeof source.floatingKhipuTheme === "string" && source.floatingKhipuTheme !== prev.floatingKhipuTheme) {
    next = { ...(next ?? prev), floatingKhipuTheme: source.floatingKhipuTheme as typeof prev.floatingKhipuTheme };
  }

  return next ?? prev;
}
