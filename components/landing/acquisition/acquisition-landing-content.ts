import type { LucideIcon } from "lucide-react";
import { Boxes, Calculator, FileSpreadsheet, GitBranch, HardHat, Import, Layers3, Sparkles } from "lucide-react";

export const ACQUISITION_PATH = "/software-presupuestos-construccion";
export const DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=VIDEO_ID";
export const FOUNDING_USERS_CAMPAIGN = "founding-users-peru";

export const acquisitionNavItems = [
  { label: "Flujo", href: "#flujo" },
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Planes", href: "#planes" },
] as const;

export type AcquisitionFeature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const acquisitionFeatures: AcquisitionFeature[] = [
  { title: "Crea tu presupuesto", description: "Ordena partidas, subpartidas, unidades y cantidades en una base clara para empezar a trabajar.", icon: FileSpreadsheet },
  { title: "Conecta tus APUs", description: "Revisa insumos, rendimientos y costo unitario desde cada partida, sin perder el contexto.", icon: Calculator },
  { title: "Calcula metrados", description: "Organiza hojas, fórmulas y cantidades para actualizar el presupuesto con trazabilidad.", icon: Layers3 },
  { title: "Prepara fórmula y cronograma", description: "Continúa el flujo con fórmula polinómica base y una programación conectada a tus partidas.", icon: GitBranch },
];

export const acquisitionOffers = [
  {
    name: "Starter",
    price: "Gratis",
    description: "Para crear y revisar presupuestos reales desde el primer día.",
    features: ["Presupuestos y subpresupuestos", "Partidas, metrados y APU manual", "Fórmula polinómica base y cronograma", "Catálogo básico y exportación PDF/Excel"],
    cta: "Crear mi primer presupuesto gratis",
    href: "/register",
    highlighted: true,
  },
] as const;

export const workflowCards = [
  { title: "De Excel disperso", description: "Deja atrás copias, pestañas y fórmulas que nadie sabe cuál es la última.", icon: FileSpreadsheet },
  { title: "A presupuesto conectado", description: "Una base para presupuesto, APU, metrados y entregables técnicos.", icon: Boxes },
  { title: "Con criterio técnico", description: "Khipu acompaña la revisión; la decisión siempre queda en manos del profesional.", icon: Sparkles },
  { title: "Listo para crecer", description: "Empieza en Starter y activa Pro cuando el volumen y la automatización lo justifiquen.", icon: HardHat },
  { title: "Importación gradual", description: "Migra lo que ya tienes sin obligarte a reconstruir toda tu operación.", icon: Import },
] as const;
