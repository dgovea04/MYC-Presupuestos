const SHOW_DEFAULTS_KEY_PREFIX = "myc-metrado-show-defaults-";

export type DatePreset = {
  id: string;
  name: string;
  dateFrom: string;
  dateTo: string;
};

/**
 * Reads the show-defaults-toggle preference from localStorage.
 * Returns `true` when no value is stored (default-on).
 */
export function loadShowDefaults(projectId: string): boolean {
  try {
    const stored = localStorage.getItem(SHOW_DEFAULTS_KEY_PREFIX + projectId);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

/**
 * Writes the show-defaults-toggle preference to localStorage.
 */
export function saveShowDefaults(projectId: string, value: boolean): void {
  try {
    localStorage.setItem(SHOW_DEFAULTS_KEY_PREFIX + projectId, String(value));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Computes the default date presets based on the current date:
 * - Últimos 30 días: today - 30 days → today
 * - Este mes: first of month → today
 * - Este año: first of year → today
 * - Personalizado: empty date range (signals free-range input)
 *
 * All dates are formatted as YYYY-MM-DD in local timezone.
 */
export function getDefaultPresets(now?: Date): DatePreset[] {
  const date = now ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const today = fmt(date);

  const thirtyDaysAgo = new Date(date);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstOfYear = new Date(date.getFullYear(), 0, 1);

  return [
    {
      id: "default-last-30-days",
      name: "Últimos 30 días",
      dateFrom: fmt(thirtyDaysAgo),
      dateTo: today,
    },
    {
      id: "default-this-month",
      name: "Este mes",
      dateFrom: fmt(firstOfMonth),
      dateTo: today,
    },
    {
      id: "default-this-year",
      name: "Este año",
      dateFrom: fmt(firstOfYear),
      dateTo: today,
    },
    {
      id: "default-custom",
      name: "Personalizado",
      dateFrom: "",
      dateTo: "",
    },
  ];
}
