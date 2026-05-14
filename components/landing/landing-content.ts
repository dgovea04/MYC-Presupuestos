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
    description: "Estructura presupuestos generales por partidas, subtitulos y metrados con claridad operativa.",
    icon: FileSpreadsheet,
  },
  {
    title: "APU",
    description: "Analiza costos unitarios con materiales, mano de obra, equipos y rendimientos en un solo flujo.",
    icon: Calculator,
  },
  {
    title: "Catalogo de Insumos",
    description: "Consolida precios, unidades y recursos reutilizables para evitar duplicidad y desorden.",
    icon: PackageSearch,
  },
  {
    title: "Formula Polinomica",
    description: "Prepara reajustes y seguimiento de indices unificados segun normativa peruana.",
    icon: LineChart,
  },
  {
    title: "Programacion",
    description: "Relaciona partidas y cronogramas para mantener costo, avance y secuencia tecnica alineados.",
    icon: FolderKanban,
  },
  {
    title: "Reportes",
    description: "Exporta entregables claros para oficina tecnica, clientes y control de obra en Excel o PDF.",
    icon: BarChart3,
  },
];

export const benefitItems: BenefitItem[] = [
  {
    title: "Pensado para flujos reales de obra",
    description: "Desde presupuesto base hasta reajuste, la interfaz mantiene el lenguaje y la jerarquia que usa una oficina tecnica.",
    icon: HardHat,
  },
  {
    title: "Menos tiempo corrigiendo hojas",
    description: "La informacion queda conectada entre APU, insumos, resumen y reportes para reducir retrabajo manual.",
    icon: CheckCircle2,
  },
  {
    title: "Mas claridad para decidir costos",
    description: "Totales, incidencias y comparativos aparecen en pantallas legibles para tomar decisiones mas rapido.",
    icon: ClipboardList,
  },
  {
    title: "Base moderna para crecer",
    description: "Reutiliza datos, estandariza criterios y deja atras archivos dispersos y software tradicional pesado.",
    icon: Blocks,
  },
];

export const testimonials: TestimonialItem[] = [
  {
    quote: "Pasamos de revisar varias hojas por presupuesto a trabajar en una vista unica mucho mas clara para metrados, APU y resumen.",
    name: "Ing. Carlos Paredes",
    role: "Jefe de Oficina Tecnica",
    company: "Constructora AndeSur",
  },
  {
    quote: "La tabla se siente familiar para el equipo, pero con mucho mas orden. Exportamos mas rapido y con menos ajustes de ultimo minuto.",
    name: "Arq. Daniela Salazar",
    role: "Coordinadora de Presupuestos",
    company: "Grupo Obra Urbana",
  },
  {
    quote: "Lo valioso no es solo el presupuesto: es tener catalogo, formula polinomica y reportes conectados en el mismo flujo.",
    name: "Luis Huaman",
    role: "Gerente de Costos",
    company: "Proyectos Civiles del Pacifico",
  },
];

export const pricingPlans: PricingPlan[] = [
  {
    name: "Starter",
    price: "S/ 89",
    description: "Para profesionales y equipos pequenos que necesitan ordenar presupuestos y APUs.",
    features: [
      "Hasta 3 proyectos activos",
      "Presupuestos y APUs base",
      "Catalogo de insumos",
      "Exportacion a Excel y PDF",
    ],
  },
  {
    name: "Pro",
    price: "S/ 189",
    description: "Para oficinas tecnicas que trabajan varios presupuestos y requieren mas control operativo.",
    highlight: true,
    features: [
      "Proyectos y presupuestos ilimitados",
      "Formula polinomica y reajustes",
      "Programacion y seguimiento",
      "Reportes avanzados por obra",
    ],
  },
  {
    name: "Empresa",
    price: "A medida",
    description: "Para constructoras que necesitan estandarizacion, visibilidad multiusuario y acompanamiento.",
    features: [
      "Multiusuario por area o sede",
      "Configuracion empresarial",
      "Soporte prioritario",
      "Onboarding y acompanamiento tecnico",
    ],
  },
];

export const footerLinks = {
  producto: ["Presupuestos", "APU", "Formula polinomica", "Reportes"],
  empresa: ["Nosotros", "Clientes", "Seguridad", "Contacto"],
  recursos: ["Demo", "Guia de inicio", "Casos de uso", "Soporte"],
};
