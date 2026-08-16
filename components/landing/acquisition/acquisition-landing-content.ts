import type { LucideIcon } from "lucide-react";
import { PRO_FOUNDER_PRICE_DISPLAY, PRO_STANDARD_PRICE_DISPLAY } from "@/lib/billing/pricing";
import { Boxes, Calculator, FileSpreadsheet, GitBranch, HardHat, Import, Layers3, Sparkles } from "lucide-react";

export const ACQUISITION_PATH = "/software-presupuestos-construccion";
export const DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=VIDEO_ID";
export const FOUNDING_USERS_CAMPAIGN = "founding-users-peru";

export const acquisitionNavItems = [
  { label: "Flujo", href: "#flujo" },
  { label: "APU conectado", href: "#apu" },
  { label: "Metrados", href: "#metrados" },
  { label: "Fórmula", href: "#formula" },
  { label: "Planes", href: "#planes" },
] as const;

export type AcquisitionFeature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const acquisitionFeatures: AcquisitionFeature[] = [
  { title: "Presupuesto como fuente única", description: "Parte de una estructura clara y evita mantener versiones paralelas en archivos dispersos.", icon: FileSpreadsheet },
  { title: "APU conectado a cada partida", description: "Revisa insumos, rendimientos y costo unitario sin perder el vínculo con el presupuesto.", icon: Calculator },
  { title: "Metrados dentro del flujo", description: "Convierte cantidades y hojas de metrados en decisiones que impactan el presupuesto.", icon: Layers3 },
  { title: "Fórmula polinómica trazable", description: "Prepara coeficientes, índices y reajustes con una base revisable para obra pública peruana.", icon: GitBranch },
];

export const acquisitionOffers = [
  {
    name: "Starter",
    price: "Gratis",
    description: "Para crear y revisar tu primer presupuesto real.",
    features: ["Presupuestos y APU básicos", "Importación inicial desde Excel", "Exportación básica", "Límites claros para empezar"],
    cta: "Crear mi primer presupuesto gratis",
    href: "/register",
    highlighted: true,
  },
  {
    name: "Pro",
    price: PRO_FOUNDER_PRICE_DISPLAY,
    description: `Precio fundador de lanzamiento. Luego ${PRO_STANDARD_PRICE_DISPLAY}.`,
    features: ["Metrados y fórmula polinómica", "Automatización y Khipu", "Exportables avanzados", "Más capacidad para equipos técnicos"],
    cta: "Conocer Pro",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Usuarios Fundadores Perú",
    price: "Sin cargo por 60 días",
    description: "Cupos piloto revisados por el equipo para profesionales que quieran ayudarnos a validar el producto.",
    features: ["Acceso temporal al plan Pro", "Sin suscripción Stripe", "Revisión manual de la solicitud", "Condiciones transparentes"],
    cta: "Solicitar acceso piloto",
    href: "#piloto",
    highlighted: false,
  },
] as const;

export const workflowCards = [
  { title: "De Excel disperso", description: "Deja atrás copias, pestañas y fórmulas que nadie sabe cuál es la última.", icon: FileSpreadsheet },
  { title: "A presupuesto conectado", description: "Una base para presupuesto, APU, metrados y entregables técnicos.", icon: Boxes },
  { title: "Con criterio técnico", description: "Khipu acompaña la revisión; la decisión siempre queda en manos del profesional.", icon: Sparkles },
  { title: "Listo para crecer", description: "Empieza en Starter y activa Pro cuando el volumen y la automatización lo justifiquen.", icon: HardHat },
  { title: "Importación gradual", description: "Migra lo que ya tienes sin obligarte a reconstruir toda tu operación.", icon: Import },
] as const;
