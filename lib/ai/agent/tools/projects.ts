import { z } from "zod";
import type { AgentToolDefinition } from "../types";
import { createProject, getUserCompanies } from "@/lib/data/projects";

// ─── Input schemas ───────────────────────────────────────────────────────────

const createProjectInput = z.object({
  companyId: z.string().min(1).optional().describe("ID de la empresa propietaria del proyecto (se hereda del workspace si no se provee)"),
  name: z.string().min(3).optional().describe("Nombre del proyecto/obra (se hereda del último mensaje del usuario si no se provee)"),
  clientName: z.string().optional().describe("Nombre del cliente o contratante"),
  location: z.string().optional().describe("Ubicación física de la obra"),
  projectType: z.string().optional().describe("Tipo de proyecto (Edificacion, Carretera, etc.)"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Fecha de inicio planificada (YYYY-MM-DD)"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Fecha de fin planificada (YYYY-MM-DD)"),
  status: z
    .enum(["PLANNING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"])
    .default("PLANNING")
    .describe("Estado inicial del proyecto"),
  workCalendarId: z.string().nullable().optional().describe("ID del calendario laboral (opcional)"),
});

// ─── Tool definitions ────────────────────────────────────────────────────────

export const createProjectTool: AgentToolDefinition<
  z.infer<typeof createProjectInput>,
  Record<string, unknown>
> = {
  name: "createProject",
  description:
    "Crea un proyecto completo con Presupuesto General y sub-presupuestos automáticos (Estructuras, Arquitectura, Inst. Sanitarias, Inst. Eléctricas). " +
    "SOLO requiere name. El companyId se obtiene automáticamente del contexto de la conversación. " +
    "Todos los demás campos (clientName, location, projectType, startDate, endDate, status, workCalendarId) son OPCIONALES y no deben pedirse a menos que el usuario los mencione explícitamente. " +
    "El sistema maneja la aprobación automáticamente, no necesitas esperar confirmación.",
  risk: "write",
  requiresProjectId: false,
  inputSchema: createProjectInput,
  execute: async (input, context) => {
    const effectiveCompanyId = input.companyId ?? context.workspaceId;
    if (!effectiveCompanyId) {
      throw new Error("Se requiere companyId para crear un proyecto. No se encontró en los argumentos ni en el contexto del workspace.");
    }
    // Si el modelo no pasa name, heredar del último mensaje del usuario
    const effectiveName = input.name || context.lastUserMessage?.trim();
    if (!effectiveName || effectiveName.length < 3) {
      throw new Error("Se requiere un nombre válido (mínimo 3 caracteres) para crear el proyecto. El nombre se hereda del último mensaje del usuario.");
    }
    const project = await createProject(context.userId, {
      companyId: effectiveCompanyId,
      name: effectiveName,
      clientName: input.clientName,
      location: input.location,
      projectType: input.projectType,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
      workCalendarId: input.workCalendarId ?? null,
    });

    return {
      id: project.id,
      name: project.name,
      companyId: project.companyId,
      clientName: project.clientName,
      location: project.location,
      projectType: project.projectType,
      status: project.status,
      startDate: project.startDate?.toISOString() ?? null,
      endDate: project.endDate?.toISOString() ?? null,
      createdAt: project.createdAt.toISOString(),
    };
  },
  summarizeResult: (result) =>
    `Proyecto "${result.name}" creado exitosamente con Presupuesto General y sub-presupuestos automáticos.`,
};

// ─── searchCompanies: list user's companies ─────────────────────────────────

const searchCompaniesInput = z.object({
  query: z.string().optional().describe("Texto opcional para filtrar empresas por nombre o RUC"),
});

export const searchCompaniesTool: AgentToolDefinition<
  z.infer<typeof searchCompaniesInput>,
  Record<string, unknown>
> = {
  name: "searchCompanies",
  description:
    "Lista las empresas del usuario activo. Retorna ID, nombre, RUC y datos de contacto de cada empresa. " +
    "Útil para obtener el companyId necesario para crear proyectos con createProject.",
  risk: "read",
  requiresProjectId: false,
  inputSchema: searchCompaniesInput,
  execute: async (input, context) => {
    const companies = await getUserCompanies(context.userId);

    let filtered = companies;
    if (input.query) {
      const q = input.query.toLowerCase();
      filtered = companies.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.ruc && c.ruc.toLowerCase().includes(q)),
      );
    }

    return {
      count: filtered.length,
      totalCount: companies.length,
      companies: filtered.map((c) => ({
        id: c.id,
        name: c.name,
        ruc: c.ruc,
        email: c.email,
        phone: c.phone,
        address: c.address,
      })),
    };
  },
  summarizeResult: (result) =>
    `${result.count} empresa${result.count === 1 ? "" : "s"} encontrada${result.count === 1 ? "" : "s"}${result.count !== result.totalCount ? ` (de ${result.totalCount} totales)` : ""}.`,
};

// ─── All project tools ───────────────────────────────────────────────────────

export const projectTools: AgentToolDefinition[] = [
  searchCompaniesTool,
  createProjectTool,
];
