import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Blocks,
  Calculator,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FolderKanban,
  HardHat,
  LineChart,
  PackageSearch,
} from "lucide-react";

export type FeatureItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export type BenefitItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export type TestimonialItem = {
  quote: string;
  name: string;
  role: string;
  company: string;
};

export type PricingPlan = {
  name: string;
  price: string;
  description: string;
  highlight?: boolean;
  features: string[];
};

export const featureItems: FeatureItem[] = [
  {
    title: "Presupuestos",
    description: "Estructura presupuestos generales por partidas, subtítulos y metrados con claridad operativa.",
    icon: FileSpreadsheet,
  },
  {
    title: "APU",
    description: "Analiza costos unitarios con materiales, mano de obra, equipos y rendimientos en un solo flujo.",
    icon: Calculator,
  },
  {
    title: "Catálogo de Insumos",
    description: "Consolida precios, unidades y recursos reutilizables para evitar duplicidad y desorden.",
    icon: PackageSearch,
  },
  {
    title: "Fórmula Polinómica",
    description: "Prepara reajustes y seguimiento de índices unificados según normativa peruana.",
    icon: LineChart,
  },
  {
    title: "Programación",
    description: "Relaciona partidas y cronogramas para mantener costo, avance y secuencia técnica alineados.",
    icon: FolderKanban,
  },
  {
    title: "Reportes",
    description: "Exporta entregables claros para oficina técnica, clientes y control de obra en Excel o PDF.",
    icon: BarChart3,
  },
];

export const benefitItems: BenefitItem[] = [
  {
    title: "Pensado para flujos reales de obra",
    description: "Desde presupuesto base hasta reajuste, la interfaz mantiene el lenguaje y la jerarquía que usa una oficina técnica.",
    icon: HardHat,
  },
  {
    title: "Menos tiempo corrigiendo hojas",
    description: "La información queda conectada entre APU, insumos, resumen y reportes para reducir retrabajo manual.",
    icon: CheckCircle2,
  },
  {
    title: "Más claridad para decidir costos",
    description: "Totales, incidencias y comparativos aparecen en pantallas legibles para tomar decisiones más rápido.",
    icon: ClipboardList,
  },
  {
    title: "Base moderna para crecer",
    description: "Reutiliza datos, estandariza criterios y deja atrás archivos dispersos y software tradicional pesado.",
    icon: Blocks,
  },
];

export const testimonials: TestimonialItem[] = [
  {
    quote: "Pasamos de revisar varias hojas por presupuesto a trabajar en una vista única mucho más clara para metrados, APU y resumen.",
    name: "Ing. Carlos Paredes",
    role: "Jefe de Oficina Técnica",
    company: "Constructora AndeSur",
  },
  {
    quote: "La tabla se siente familiar para el equipo, pero con mucho más orden. Exportamos más rápido y con menos ajustes de último minuto.",
    name: "Arq. Daniela Salazar",
    role: "Coordinadora de Presupuestos",
    company: "Grupo Obra Urbana",
  },
  {
    quote: "Lo valioso no es solo el presupuesto: es tener catálogo, fórmula polinómica y reportes conectados en el mismo flujo.",
    name: "Luis Huaman",
    role: "Gerente de Costos",
    company: "Proyectos Civiles del Pacífico",
  },
];

export const pricingPlans: PricingPlan[] = [
  {
    name: "Starter",
    price: "S/ 89",
    description: "Para profesionales y equipos pequeños que necesitan ordenar presupuestos y APUs.",
    features: [
      "Hasta 3 proyectos activos",
      "Presupuestos y APUs base",
      "Catálogo de insumos",
      "Exportación a Excel y PDF",
    ],
  },
  {
    name: "Pro",
    price: "S/ 189",
    description: "Para oficinas técnicas que trabajan varios presupuestos y requieren más control operativo.",
    highlight: true,
    features: [
      "Proyectos y presupuestos ilimitados",
      "Fórmula polinómica y reajustes",
      "Programación y seguimiento",
      "Reportes avanzados por obra",
    ],
  },
  {
    name: "Empresa",
    price: "A medida",
    description: "Para constructoras que necesitan estandarización, visibilidad multiusuario y acompañamiento.",
    features: [
      "Multiusuario por área o sede",
      "Configuración empresarial",
      "Soporte prioritario",
      "Onboarding y acompañamiento técnico",
    ],
  },
];

export const footerLinks = {
  producto: ["Presupuestos", "APU", "Fórmula polinómica", "Reportes"],
  empresa: ["Nosotros", "Clientes", "Seguridad", "Contacto"],
  recursos: ["Demo", "Guía de inicio", "Casos de uso", "Soporte"],
};
