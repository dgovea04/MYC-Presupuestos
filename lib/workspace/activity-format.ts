export type RelativeLastActive = { relative: string; absolute: string | null };

/**
 * Formatea la última actividad como "Nunca", "Hoy", "Ayer" o "Hace N días",
 * devolviendo además la fecha absoluta para exponerla de forma accesible.
 * Pura (sin dependencias server-side) para poder reutilizarla en clientes.
 */
export function formatRelativeLastActive(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): RelativeLastActive {
  if (!value) return { relative: "Nunca", absolute: null };

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return { relative: "Fecha no disponible", absolute: null };

  const absolute = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(date);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfTarget) / 86_400_000);

  if (dayDiff <= 0) return { relative: "Hoy", absolute };
  if (dayDiff === 1) return { relative: "Ayer", absolute };
  return { relative: `Hace ${dayDiff} días`, absolute };
}
