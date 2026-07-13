import {
  Sparkles,
  DollarSign,
  BarChart4,
  Calendar,
  Search,
  FileText,
} from "lucide-react";

// ─── Bundle config ────────────────────────────────────────────────────────────

export const BUNDLE_CONFIG = [
  {
    slug: "asistente-general",
    bundleSlug: "khipu-agent",
    name: "Asistente General",
    description: "Acceso completo a todas las herramientas de la plataforma",
    icon: Sparkles,
    color: "from-blue-500 to-blue-600",
    borderColor: "border-blue-200",
    bgLight: "bg-blue-50",
    textColor: "text-blue-700",
  },
  {
    slug: "crear-presupuesto-base",
    bundleSlug: "budget-agent",
    name: "Presupuestos",
    description: "Crear, clonar y gestionar presupuestos de obra",
    icon: DollarSign,
    color: "from-emerald-500 to-emerald-600",
    borderColor: "border-emerald-200",
    bgLight: "bg-emerald-50",
    textColor: "text-emerald-700",
  },
  {
    slug: "optimizar-apu",
    bundleSlug: "apu-agent",
    name: "APU",
    description: "Análisis de precios unitarios y optimización",
    icon: BarChart4,
    color: "from-purple-500 to-purple-600",
    borderColor: "border-purple-200",
    bgLight: "bg-purple-50",
    textColor: "text-purple-700",
  },
  {
    slug: "generar-cronograma",
    bundleSlug: "planning-agent",
    name: "Cronograma",
    description: "Planificación de obra, metrados y ruta crítica",
    icon: Calendar,
    color: "from-amber-500 to-amber-600",
    borderColor: "border-amber-200",
    bgLight: "bg-amber-50",
    textColor: "text-amber-700",
  },
  {
    slug: "revisar-apu-proyecto",
    bundleSlug: "review-agent",
    name: "Revisión",
    description: "Calidad y consistencia de presupuestos y APU",
    icon: Search,
    color: "from-rose-500 to-rose-600",
    borderColor: "border-rose-200",
    bgLight: "bg-rose-50",
    textColor: "text-rose-700",
  },
  {
    slug: "exportar-reportes",
    bundleSlug: "reporting-agent",
    name: "Reportes",
    description: "Exportaciones a PDF, Excel y dashboard",
    icon: FileText,
    color: "from-sky-500 to-sky-600",
    borderColor: "border-sky-200",
    bgLight: "bg-sky-50",
    textColor: "text-sky-700",
  },
] as const;

export type BundleConfigEntry = (typeof BUNDLE_CONFIG)[number];
export type BundleSlug = BundleConfigEntry["slug"];

// ─── Bundle labels ───────────────────────────────────────────────────────────

export const BUNDLE_SLUG_LABELS: Record<string, string> = {
  "khipu-agent": "General",
  "budget-agent": "Presupuestos",
  "apu-agent": "APU",
  "planning-agent": "Cronograma",
  "review-agent": "Revisión",
  "reporting-agent": "Reportes",
};

// ─── Bundle-specific suggestions ─────────────────────────────────────────────

export const BUNDLE_SUGGESTIONS: Record<string, string[]> = {
  "asistente-general": [
    "Crear presupuesto para vivienda multifamiliar",
    "Revisar APU de concreto armado",
    "Generar cronograma del proyecto",
    "Comparar presupuestos activos",
  ],
  "crear-presupuesto-base": [
    "Crear presupuesto para vivienda de 3 pisos",
    "Clonar presupuesto existente para nuevo proyecto",
    "Crear presupuesto para edificio de oficinas",
    "Generar presupuesto desde plantilla MCP",
  ],
  "optimizar-apu": [
    "Optimizar APU de concreto f'c=210 kg/cm2",
    "Revisar rendimientos de mano de obra en muros",
    "Analizar costos de encofrado y desencofrado",
    "Comparar insumos alternativos para acero",
  ],
  "generar-cronograma": [
    "Generar cronograma para obra de 12 meses",
    "Calcular ruta crítica del proyecto",
    "Programar partidas de estructuras",
    "Estimar duración de acabados",
  ],
  "revisar-apu-proyecto": [
    "Revisar consistencia de unidades en presupuesto",
    "Detectar partidas duplicadas",
    "Validar precios contra catálogo",
    "Revisar costos indirectos del proyecto",
  ],
  "exportar-reportes": [
    "Exportar presupuesto a PDF",
    "Generar reporte de fórmula polinómica",
    "Exportar APU a Excel",
    "Crear dashboard de costos del proyecto",
  ],
};
