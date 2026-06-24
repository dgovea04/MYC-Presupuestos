import type { ApuPresentationCategory } from "@/lib/calculations/apu";

type ApuCategoryPresentation = {
  label: string;
  summaryClassName: string;
  badgeClassName: string;
  rowClassName: string;
  gripClassName: string;
  indicatorClassName: string;
};

const APU_CATEGORY_PRESENTATION: Record<ApuPresentationCategory, ApuCategoryPresentation> = {
  LABOR: {
    label: "Mano de obra",
    summaryClassName: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
    badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-200",
    rowClassName: "bg-emerald-50/35 dark:bg-emerald-950/18",
    gripClassName: "text-emerald-600 dark:text-emerald-300",
    indicatorClassName: "border-emerald-200 bg-emerald-50/90 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-200",
  },
  MATERIAL: {
    label: "Materiales",
    summaryClassName: "border-blue-200 bg-blue-50 text-blue-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
    badgeClassName: "border-blue-200 bg-blue-100 text-blue-700 dark:border-sky-900 dark:bg-sky-950/55 dark:text-sky-200",
    rowClassName: "bg-blue-50/35 dark:bg-sky-950/18",
    gripClassName: "text-blue-600 dark:text-sky-300",
    indicatorClassName: "border-blue-200 bg-blue-50/90 text-blue-700 dark:border-sky-900 dark:bg-sky-950/55 dark:text-sky-200",
  },
  EQUIPMENT: {
    label: "Equipos",
    summaryClassName: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    badgeClassName: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/55 dark:text-amber-200",
    rowClassName: "bg-amber-50/35 dark:bg-amber-950/18",
    gripClassName: "text-amber-600 dark:text-amber-300",
    indicatorClassName: "border-amber-200 bg-amber-50/90 text-amber-700 dark:border-amber-900 dark:bg-amber-950/55 dark:text-amber-200",
  },
  SUBCONTRACT: {
    label: "Sub contratos",
    summaryClassName: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
    badgeClassName: "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-900 dark:bg-rose-950/55 dark:text-rose-200",
    rowClassName: "bg-rose-50/35 dark:bg-rose-950/18",
    gripClassName: "text-rose-600 dark:text-rose-300",
    indicatorClassName: "border-rose-200 bg-rose-50/90 text-rose-700 dark:border-rose-900 dark:bg-rose-950/55 dark:text-rose-200",
  },
  SUBPARTIDA: {
    label: "Sub partidas",
    summaryClassName: "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200",
    badgeClassName: "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-900 dark:bg-violet-950/55 dark:text-violet-200",
    rowClassName: "bg-violet-50/35 dark:bg-violet-950/18",
    gripClassName: "text-violet-600 dark:text-violet-300",
    indicatorClassName: "border-violet-200 bg-violet-50/90 text-violet-700 dark:border-violet-900 dark:bg-violet-950/55 dark:text-violet-200",
  },
};

export function getApuCategoryPresentation(category: ApuPresentationCategory): ApuCategoryPresentation {
  return APU_CATEGORY_PRESENTATION[category];
}
