import type { ProjectStatus } from "@/types/project";

export function getProjectStatusLabel(status: ProjectStatus | string) {
  switch (status) {
    case "IN_PROGRESS":
      return "En ejecución";
    case "COMPLETED":
      return "Completado";
    case "ON_HOLD":
      return "En pausa";
    case "PLANNING":
    default:
      return "Planificación";
  }
}

export function getProjectStatusTone(status: ProjectStatus | string) {
  switch (status) {
    case "IN_PROGRESS":
      return "emerald" as const;
    case "COMPLETED":
      return "slate" as const;
    case "ON_HOLD":
      return "amber" as const;
    case "PLANNING":
    default:
      return "sky" as const;
  }
}
