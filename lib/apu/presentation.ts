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
    summaryClassName: "border-emerald-200 bg-emerald-50 text-emerald-900",
    badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-700",
    rowClassName: "bg-emerald-50/35",
    gripClassName: "text-emerald-600",
    indicatorClassName: "border-emerald-200 bg-emerald-50/90 text-emerald-700",
  },
  MATERIAL: {
    label: "Materiales",
    summaryClassName: "border-blue-200 bg-blue-50 text-blue-900",
    badgeClassName: "border-blue-200 bg-blue-100 text-blue-700",
    rowClassName: "bg-blue-50/35",
    gripClassName: "text-blue-600",
    indicatorClassName: "border-blue-200 bg-blue-50/90 text-blue-700",
  },
  EQUIPMENT: {
    label: "Equipos",
    summaryClassName: "border-amber-200 bg-amber-50 text-amber-900",
    badgeClassName: "border-amber-200 bg-amber-100 text-amber-700",
    rowClassName: "bg-amber-50/35",
    gripClassName: "text-amber-600",
    indicatorClassName: "border-amber-200 bg-amber-50/90 text-amber-700",
  },
  SUBCONTRACT: {
    label: "Sub contratos",
    summaryClassName: "border-rose-200 bg-rose-50 text-rose-900",
    badgeClassName: "border-rose-200 bg-rose-100 text-rose-700",
    rowClassName: "bg-rose-50/35",
    gripClassName: "text-rose-600",
    indicatorClassName: "border-rose-200 bg-rose-50/90 text-rose-700",
  },
  SUBPARTIDA: {
    label: "Sub partidas",
    summaryClassName: "border-violet-200 bg-violet-50 text-violet-900",
    badgeClassName: "border-violet-200 bg-violet-100 text-violet-700",
    rowClassName: "bg-violet-50/35",
    gripClassName: "text-violet-600",
    indicatorClassName: "border-violet-200 bg-violet-50/90 text-violet-700",
  },
};

export function getApuCategoryPresentation(category: ApuPresentationCategory): ApuCategoryPresentation {
  return APU_CATEGORY_PRESENTATION[category];
}
