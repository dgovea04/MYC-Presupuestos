import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Calculator,
  ClipboardCheck,
  FileSpreadsheet,
  FolderKanban,
  Layers3,
  LineChart,
  PackageSearch,
  Sigma,
  Workflow,
} from "lucide-react";
import {
  benefitItems,
  featureItems,
  footerLinks,
  pricingPlans,
  testimonials,
} from "@/components/landing/landing-content";

export const landingV2NavItems = [
  { label: "Producto", href: "#producto" },
  { label: "Flujo", href: "#flujo" },
  { label: "Comparacion", href: "#comparacion" },
  { label: "Precios", href: "#precios" },
];

export const landingV2FeatureItems = featureItems;
export const landingV2BenefitItems = benefitItems;
export const landingV2Testimonials = testimonials;
export const landingV2PricingPlans = pricingPlans;
export const landingV2FooterLinks = footerLinks;

export const heroMetrics = [
  { label: "Presupuesto total", value: "S/ 1,327,163" },
  { label: "Partidas activas", value: "126" },
  { label: "Coeficientes FP", value: "0.314 / 0.426 / 0.260" },
];

export const terminalPanes = [
  {
    title: "presupuesto.general",
    eyebrow: "estructura",
    lines: [
      "01.00 Obras preliminares",
      "02.00 Estructuras",
      "  02.01 Concreto armado",
      "  02.02 Acero fy 4200",
      "subtotal.directo = S/ 982,420.00",
    ],
  },
  {
    title: "apu.concreto",
    eyebrow: "analisis",
    lines: [
      "rendimiento = 18.00 m3/dia",
      "mano_obra = S/ 46.80",
      "materiales = S/ 327.25",
      "equipos = S/ 47.70",
      "precio_unitario = S/ 421.75",
    ],
  },
  {
    title: "formula.polinomica",
    eyebrow: "reajuste",
    lines: [
      "K = 0.314*(Jr/Jo)",
      "  + 0.426*(Mr/Mo)",
      "  + 0.260*(Er/Eo)",
      "coeficientes a 3 decimales",
      "normativa peruana aplicada",
    ],
  },
  {
    title: "reportes.export",
    eyebrow: "salida",
    lines: [
      "excel: presupuesto.xlsx",
      "pdf: resumen_obra.pdf",
      "validacion: sin alertas",
      "estado: listo para revision",
      "actualizado: hoy 18:40",
    ],
  },
];

export const previewRows = [
  { code: "02.01.01", item: "Trazo, niveles y replanteo", unit: "m2", qty: "2,850.00", price: "12.80", total: "S/ 36,480.00" },
  { code: "02.01.02", item: "Excavacion manual para zapatas", unit: "m3", qty: "412.60", price: "48.20", total: "S/ 19,887.32" },
  { code: "02.01.03", item: "Concreto fc=210 kg/cm2", unit: "m3", qty: "186.20", price: "421.75", total: "S/ 78,524.85" },
  { code: "02.01.04", item: "Acero corrugado fy=4200", unit: "kg", qty: "15,640.00", price: "5.82", total: "S/ 91,024.80" },
];

export const workflowItems: Array<{ title: string; description: string; icon: LucideIcon }> = [
  {
    title: "Presupuesto base",
    description: "Crea jerarquias por partidas, subtitulos y metrados sin perder lectura tecnica.",
    icon: FileSpreadsheet,
  },
  {
    title: "APU conectado",
    description: "Une recursos, cuadrillas, rendimientos y precios unitarios en un flujo auditable.",
    icon: Calculator,
  },
  {
    title: "Catalogo reutilizable",
    description: "Mantiene insumos, unidades e indices ordenados para evitar duplicidad.",
    icon: PackageSearch,
  },
  {
    title: "Fórmula polinómica",
    description: "Prepara coeficientes y reajustes con precision de tres decimales.",
    icon: Sigma,
  },
];

export const toolkitItems: Array<{ title: string; description: string; icon: LucideIcon }> = [
  { title: "Costos", description: "Resumen financiero por obra.", icon: BarChart3 },
  { title: "Programacion", description: "Cronograma conectado a partidas.", icon: FolderKanban },
  { title: "Control", description: "Alertas para revisiones tecnicas.", icon: ClipboardCheck },
  { title: "Reportes", description: "Excel y PDF listos para entregar.", icon: LineChart },
  { title: "Estandares", description: "Criterios reutilizables por equipo.", icon: Layers3 },
  { title: "Flujo IA", description: "Asistencia tecnica sobre datos locales.", icon: Workflow },
];

export const comparisonRows = [
  { label: "APU conectado con presupuesto", excel: "Parcial", traditional: "Parcial", myc: "Completo" },
  { label: "Fórmula polinómica integrada", excel: "Manual", traditional: "Variable", myc: "Integrada" },
  { label: "Exportables para obra", excel: "Manual", traditional: "Limitado", myc: "Excel y PDF" },
  { label: "Experiencia moderna para oficina tecnica", excel: "No", traditional: "Pesada", myc: "SaaS" },
];
