import type { LucideIcon } from "lucide-react";
import { PRO_FOUNDER_PRICE_DISPLAY, PRO_STANDARD_PRICE_DISPLAY } from "@/lib/billing/pricing";
import {
  BarChart3,
  BotMessageSquare,
  ClipboardList,
  FileArchive,
  FileSpreadsheet,
  FolderKanban,
  GitCompareArrows,
  ShieldCheck,
  Sparkles,
  StickyNote,
  TableProperties,
  UsersRound,
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
    title: "Espacio de trabajo colaborativo",
    description: "Invita a tu equipo, administra roles y trabaja sobre una base compartida de presupuestos, APUs y catálogos.",
    icon: UsersRound,
  },
  {
    title: "Khipu IA con contexto visible",
    description: "Revisa partidas, explica costos y detecta inconsistencias antes del cierre, sin convertir la IA en una caja negra.",
    icon: BotMessageSquare,
  },
  {
    title: "Khipu modo agente",
    description: "Crea presupuestos, propone APUs y completa estructuras con acciones guiadas, siempre con revisión humana antes de aplicar cambios.",
    icon: Sparkles,
  },
  {
    title: "Importación y migración",
    description: "Parte desde Excel, S10, Delphin, RW7 o PDF cuando corresponda, sin rehacer todo desde cero.",
    icon: FileSpreadsheet,
  },
  {
    title: "Fórmula polinómica y cronograma",
    description: "Conecta presupuesto, reajustes, valorización, recursos y Curva S en el mismo flujo técnico.",
    icon: FolderKanban,
  },
  {
    title: "Exportables para oficina técnica",
    description: "Genera PDF, Excel, CSV o ZIP desde una base consistente y revisable.",
    icon: FileArchive,
  },
];

export const smartFlowItems: SmartFlowItem[] = [
  {
    title: "Importa o crea el presupuesto",
    description: "Parte desde Excel, S10, Delphin, RW7 o PDF cuando corresponda, o crea una base nueva.",
    steps: ["Importar datos", "Normalizar estructura", "Abrir presupuesto activo"],
    icon: GitCompareArrows,
  },
  {
    title: "Estructura partidas, APUs y metrados",
    description: "Relaciona la información técnica y mantenla conectada mientras el presupuesto evoluciona.",
    steps: ["Conectar partidas", "Revisar APU", "Completar metrados"],
    icon: BarChart3,
  },
  {
    title: "Revisa con Khipu IA",
    description: "Detecta alertas visibles y acelera el análisis antes del cierre con contexto del proyecto.",
    steps: ["Detectar inconsistencias", "Registrar observación", "Tomar decisión técnica"],
    icon: StickyNote,
  },
  {
    title: "Exporta entregables técnicos",
    description: "Cierra el flujo con PDF, Excel, CSV, ZIP, cronograma y paquetes listos para compartir.",
    steps: ["Elegir preset", "Validar salida", "Exportar paquete"],
    icon: FileArchive,
  },
];

export const benefitItems: BenefitItem[] = [
  {
    title: "Jefe de oficina técnica",
    description: "Obtén más trazabilidad sobre cambios, revisiones y entregables sin perseguir versiones dispersas.",
    icon: ShieldCheck,
  },
  {
    title: "Presupuestador",
    description: "Reduce el retrabajo entre hojas, APUs, metrados y exportaciones con una base técnica conectada.",
    icon: TableProperties,
  },
  {
    title: "Gerencia",
    description: "Gana visibilidad sobre avance, costos y estándares del equipo para revisar con mejor contexto.",
    icon: ClipboardList,
  },
  {
    title: "Equipo",
    description: "Trabaja en un espacio de trabajo común con permisos, invitaciones y una operación más ordenada.",
    icon: UsersRound,
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
    description: "Para profesionales que necesitan presupuestar y revisar APU sin empezar desde una demo limitada.",
    badge: "Gratis",
    features: [
      "Presupuestos, subpresupuestos y APU manual con límites operativos",
      "Catálogo básico de insumos y búsqueda simple",
      "Partidas similares para acelerar la estructura",
      "Fórmula polinómica base",
      "Modo moderno y modo Excel",
      "Exportación básica a PDF y Excel",
    ],
  },
  {
    name: "Pro",
    price: PRO_FOUNDER_PRICE_DISPLAY,
    originalPrice: `Luego ${PRO_STANDARD_PRICE_DISPLAY}`,
    description: "Para oficinas técnicas que quieren automatización, IA y reportes avanzados sin perder control.",
    badge: "Para oficina técnica",
    highlight: true,
    features: [
      "Límites ampliados para presupuestos y uso técnico",
      "Khipu IA y Khipu modo agente con revisión humana",
      "Metrados avanzados, plantillas y análisis de riesgo",
      "Cronograma inteligente con valorización, recursos y Curva S",
      "Fórmula polinómica, reajustes y automatizaciones revisables",
      "Exportaciones avanzadas PDF, Excel, CSV y ZIP",
      "Colaboración en tiempo real para el equipo",
    ],
  },
  {
    name: "Empresa",
    price: "A medida",
    description: "Para equipos y constructoras que necesitan administración avanzada y estandarización interna.",
    badge: "Para equipos y constructoras",
    features: [
      "Todo Pro con límites y tokens IA ampliados",
      "Administración avanzada del espacio de trabajo",
      "Roles, auditoría, invitaciones y control de uso del equipo",
      "Estándares, plantillas y datos maestros para la organización",
      "Integración de escritorio y operación multiárea",
      "Soporte prioritario, onboarding y acompañamiento técnico",
    ],
  },
];

export type FaqItem = {
  question: string;
  answer: string;
};

export const faqItems: FaqItem[] = [
  {
    question: "¿Qué norma peruana usan para la fórmula polinómica?",
    answer:
      "MC Presupuestos implementa la fórmula polinómica según el Decreto Supremo N° 011-79-VC y sus modificatorias, usando los índices unificados de precios del INEI. La estructura de monomios, coeficientes y reajustes se calcula con precisión de 3 decimales y se mantiene trazable para revisión técnica.",
  },
  {
    question: "¿Puedo migrar mis presupuestos desde Excel?",
    answer:
      "Sí. MC permite importar datos desde Excel con pegado avanzado que normaliza metrados, códigos y unidades. También puedes importar archivos S10, Delphin y RW7 para no empezar desde cero. La plataforma detecta inconsistencias y te avisa antes de guardar.",
  },
  {
    question: "¿La IA reemplaza al ingeniero o solo asiste?",
    answer:
      "La IA de MC — Khipu — es un asistente técnico, no un reemplazo. Sugiere insumos, compara partidas similares y revisa costos, pero toda decisión queda en manos del equipo. Cada sugerencia muestra su fuente y nivel de confianza para que puedas evaluarla antes de aplicarla.",
  },
  {
    question: "¿Cómo funciona el plan Starter gratuito?",
    answer:
      "El plan Starter te permite crear presupuestos reales con límites operativos: puedes armar partidas, APU manual, catálogo básico de insumos y exportar a PDF/Excel. No es una demo limitada a unos días: es un plan útil para trabajar de verdad. Cuando necesites automatización, IA o cronograma inteligente, pasas a Pro.",
  },
  {
    question: "¿Mis datos están seguros en la nube?",
    answer:
      "Sí. MC Presupuestos usa infraestructura moderna con cifrado en reposo y en tránsito, autenticación segura, backups automáticos y controles de acceso por rol. Tus presupuestos, APU y catálogos solo son visibles para tu equipo. Además, con Khipu local puedes ejecutar IA sin enviar datos a servicios externos.",
  },
  {
    question: "¿Puedo trabajar sin conexión a internet?",
    answer:
      "Actualmente MC es una plataforma web que requiere conexión. Sin embargo, el modo Excel permite operar con fluidez incluso en conexiones lentas, y las exportaciones a PDF/Excel/ZIP te permiten llevar la información a obra sin depender de la nube. Estamos explorando capacidades offline para el futuro.",
  },
  {
    question: "¿Qué es un espacio de trabajo en MC Presupuestos?",
    answer:
      "Un espacio de trabajo es el espacio compartido donde tu equipo administra presupuestos, proyectos, catálogos, miembros y permisos. Permite ordenar la operación de la oficina técnica sin separar la gestión del equipo del trabajo presupuestal.",
  },
  {
    question: "¿Cuál es la diferencia entre Khipu IA y Khipu modo agente?",
    answer:
      "Khipu IA es el asistente técnico de MC Presupuestos. Dentro de Khipu IA, el modo agente está orientado a crear o completar trabajo: puede ayudar a generar partidas, proponer APUs, preparar estructuras y guiar acciones dentro del presupuesto. Los cambios deben revisarse antes de aplicarse.",
  },
  {
    question: "¿Qué cambia entre el plan gratis y Pro?",
    answer:
      "El plan gratis permite trabajar con funciones base y límites operativos. Pro amplía esos límites y habilita capacidades avanzadas como Khipu IA, Khipu modo agente, automatizaciones, importaciones o exportaciones avanzadas según la configuración vigente del plan.",
  },
  {
    question: "¿Qué tipo de soporte ofrecen?",
    answer:
      "Todos los planes incluyen documentación y guías de inicio. El plan Pro incluye soporte por chat técnico. El plan Empresa suma soporte prioritario, onboarding personalizado y acompañamiento para estandarizar procesos internos. También ofrecemos demo guiada para equipos que quieren evaluar antes de decidir.",
  },
  {
    question: "¿Puedo personalizar los formatos de exportación?",
    answer:
      "Sí. MC te permite configurar logotipo, firma, decimales, columnas visibles y presets de exportación. Puedes generar paquetes ZIP con presupuesto, APU, cronograma, calendario valorizado y Curva S listos para presentar a clientes o revisión técnica.",
  },
];

export const footerLinks = {
  producto: ["Presupuesto y APU", "IA local", "Cronograma", "Exportaciones"],
  empresa: ["Espacio de trabajo", "Seguridad", "Soporte", "Contacto"],
  recursos: ["Demo", "Guía de inicio", "Casos de uso", "Soporte"],
};
