export const reviewStatusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  QUEUED: "En cola",
  RUNNING: "En ejecución",
  COMPLETED: "Completada",
  COMPLETED_WITH_WARNINGS: "Completada con advertencias",
  UNDER_REVIEW: "En revisión",
  REVIEWED: "Revisada",
  STALE: "Obsoleta",
};

export const findingStatusLabels: Record<string, string> = { PENDING: "Pendiente", IN_REVIEW: "En revisión", RESOLVED: "Resuelto", REOPENED: "Reabierto", STALE: "Obsoleto" };
export const resolutionLabels: Record<string, string> = { VALID_AS_IS: "Válido sin cambios", CONFIRMED_ISSUE: "Problema confirmado", FALSE_POSITIVE: "Falso positivo", NEEDS_MORE_INFORMATION: "Requiere más información", CORRECTED: "Corregido", NOT_APPLICABLE: "No aplica" };
export const confidenceLabels: Record<string, string> = { HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" };

export function reviewLabel(labels: Record<string, string>, value: string): string { return labels[value] ?? value.replaceAll("_", " "); }
