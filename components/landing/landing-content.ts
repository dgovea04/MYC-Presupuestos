import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BotMessageSquare,
  CheckCircle2,
  ClipboardList,
  FileArchive,
  FileSpreadsheet,
  FolderKanban,
  GitCompareArrows,
  HardHat,
  Search,
  StickyNote,
  TableProperties,
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

export type SmartFlowItem = {
  title: string;
  description: string;
  steps: string[];
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
  originalPrice?: string;
  description: string;
  badge?: string;
  highlight?: boolean;
  features: string[];
};

export const featureItems: FeatureItem[] = [
  {
    title: "Presupuesto y APU conectado",
    description: "Arma partidas, metrados y análisis unitarios en el mismo flujo, con totales siempre trazables.",
    icon: FileSpreadsheet,
  },
  {
    title: "Catálogo con búsqueda avanzada",
    description: "Encuentra insumos y partidas por descripción, unidad, código o familia para reutilizar información sin duplicar datos.",
    icon: Search,
  },
  {
    title: "Generador de partidas por similitud",
    description: "Compara partidas existentes, sugiere insumos y conserva fuentes, scores y criterios antes de guardar.",
    icon: GitCompareArrows,
  },
  {
    title: "IA local para revisión y APU",
    description: "Usa Khipu con Ollama para chat técnico, generación de APU, revisión de costos y autocompletado.",
    icon: BotMessageSquare,
  },
  {
    title: "Cronograma inteligente",
    description: "Genera programación, calendario valorizado, calendario de insumos, ruta crítica visual y Curva S.",
    icon: FolderKanban,
  },
  {
    title: "Exportaciones profesionales",
    description: "Prepara PDF, Excel, CSV o paquetes ZIP con presets, logo, firma, vista previa y decimales configurables.",
    icon: FileArchive,
  },
];

export const smartFlowItems: SmartFlowItem[] = [
  {
    title: "De partida nueva a APU sugerido",
    description: "Busca partidas similares, agrega insumos recomendados y revisa cantidades antes de convertirlas en catálogo.",
    steps: ["Buscar similitud", "Comparar fuentes", "Guardar APU revisado"],
    icon: GitCompareArrows,
  },
  {
    title: "De presupuesto a cronograma valorizado",
    description: "Parte de las partidas del presupuesto, genera programación y revisa valorización, recursos y Curva S.",
    steps: ["Generar cronograma", "Ajustar fechas", "Exportar paquete"],
    icon: BarChart3,
  },
  {
    title: "De revisión técnica a pendientes",
    description: "Convierte observaciones en notas contextuales vinculadas a proyecto, presupuesto o partida.",
    steps: ["Detectar alerta", "Crear nota", "Resolver pendiente"],
    icon: StickyNote,
  },
];

export const benefitItems: BenefitItem[] = [
  {
    title: "Menos saltos entre hojas",
    description: "Presupuesto, APU, catálogo, programación, notas y reportes comparten contexto para reducir retrabajo manual.",
    icon: TableProperties,
  },
  {
    title: "Automatización revisable",
    description: "Las sugerencias de IA, partidas similares y cronogramas se aplican solo después de revisión humana.",
    icon: CheckCircle2,
  },
  {
    title: "Entregables listos para obra",
    description: "Exporta presupuestos, APU, fórmula polinómica, gastos, recursos y cronograma con formatos consistentes.",
    icon: ClipboardList,
  },
  {
    title: "Control técnico para crecer",
    description: "Planes, tokens IA, administración y estándares dejan una base ordenada para oficinas técnicas y constructoras.",
    icon: HardHat,
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
    quote: "Lo valioso no es solo el presupuesto: es tener catálogo, cronograma, notas y exportes conectados en el mismo flujo.",
    name: "Luis Huamán",
    role: "Gerente de Costos",
    company: "Proyectos Civiles del Pacífico",
  },
];

export const pricingPlans: PricingPlan[] = [
  {
    name: "Starter",
    price: "Gratis",
    originalPrice: "S/ 89",
    description: "Para profesionales que necesitan presupuestar y revisar APU sin empezar desde una demo limitada.",
    badge: "Gratis útil",
    features: [
      "Presupuestos y subpresupuestos básicos con límites",
      "APU manual y catálogo de insumos básico",
      "Modo moderno y modo Excel",
      "Notas básicas para seguimiento",
      "Exportación básica a PDF y Excel",
      "Búsqueda simple en catálogos",
    ],
  },
  {
    name: "Pro",
    price: "S/ 189",
    description: "Para oficinas técnicas que quieren automatización, IA y reportes avanzados sin perder control.",
    highlight: true,
    features: [
      "Khipu con IA local y tokens mensuales incluidos",
      "Generador de partidas por similitud",
      "Búsqueda, sugerencias y pegado avanzado",
      "Cronograma inteligente con valorización, recursos y Curva S",
      "Fórmula polinómica y reajustes",
      "Exportaciones avanzadas PDF, Excel, CSV y ZIP",
      "Notas contextuales por proyecto, presupuesto o partida",
    ],
  },
  {
    name: "Empresa",
    price: "A medida",
    description: "Para constructoras que necesitan administración, límites altos y estandarización interna.",
    features: [
      "Todo Pro con tokens IA ampliados",
      "Administración de usuarios, roles, estado y planes",
      "Ajustes manuales de cupos y control operativo",
      "Reportes ejecutivos y paquetes ZIP avanzados",
      "Configuración de estándares, plantillas y datos maestros",
      "Soporte prioritario, onboarding y acompañamiento técnico",
    ],
  },
];

export const footerLinks = {
  producto: ["Presupuesto y APU", "IA local", "Cronograma", "Exportaciones"],
  empresa: ["Nosotros", "Clientes", "Seguridad", "Contacto"],
  recursos: ["Demo", "Guía de inicio", "Casos de uso", "Soporte"],
};
