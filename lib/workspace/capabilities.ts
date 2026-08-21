import type { WorkspaceRole } from "@/types/workspace";

export const WORKSPACE_CAPABILITIES = [
  { key: "workspace.config", module: "workspace", description: "Editar nombre, RUC y logo del workspace" },
  { key: "workspace.delete", module: "workspace", description: "Eliminar el workspace" },
  { key: "workspace.transfer", module: "workspace", description: "Transferir el ownership" },
  { key: "workspace.audit.read", module: "workspace", description: "Ver la auditoría" },
  { key: "workspace.billing.read", module: "workspace", description: "Ver facturación y uso" },
  { key: "members.manage", module: "members", description: "Invitar y gestionar miembros" },
  { key: "budgets.read", module: "budgets", description: "Ver presupuestos" },
  { key: "budgets.create", module: "budgets", description: "Crear presupuestos" },
  { key: "budgets.update", module: "budgets", description: "Editar presupuestos" },
  { key: "budgets.delete", module: "budgets", description: "Eliminar presupuestos" },
  { key: "projects.read", module: "projects", description: "Ver proyectos" },
  { key: "projects.create", module: "projects", description: "Crear proyectos" },
  { key: "projects.update", module: "projects", description: "Editar proyectos" },
  { key: "projects.delete", module: "projects", description: "Eliminar proyectos" },
  { key: "resources.read", module: "resources", description: "Ver el catálogo de insumos" },
  { key: "resources.create", module: "resources", description: "Crear insumos" },
  { key: "resources.update", module: "resources", description: "Editar insumos" },
  { key: "resources.delete", module: "resources", description: "Eliminar insumos" },
] as const;

export type WorkspaceCapability = (typeof WORKSPACE_CAPABILITIES)[number]["key"];

const ALL_CAPABILITIES = new Set<WorkspaceCapability>(WORKSPACE_CAPABILITIES.map((capability) => capability.key));

/**
 * Matriz base por rol. Los roles personalizados no pueden superar el nivel
 * ADMIN ni otorgar acciones exclusivas del OWNER.
 */
export const BASE_ROLE_CAPABILITIES: Record<WorkspaceRole, ReadonlySet<WorkspaceCapability>> = {
  OWNER: ALL_CAPABILITIES,
  ADMIN: new Set<WorkspaceCapability>([...ALL_CAPABILITIES].filter((capability) => capability !== "workspace.delete" && capability !== "workspace.transfer")),
  EDITOR: new Set<WorkspaceCapability>(["budgets.read", "budgets.create", "budgets.update", "budgets.delete", "projects.read", "projects.create", "projects.update", "resources.read", "resources.create", "resources.update", "resources.delete"]),
  VIEWER: new Set<WorkspaceCapability>(["budgets.read", "projects.read", "resources.read"]),
};

export const OWNER_ONLY_CAPABILITIES: ReadonlySet<WorkspaceCapability> = new Set(["workspace.delete", "workspace.transfer"]);

/** Capacidades asignables a roles personalizados: nunca superan ADMIN. */
export const CUSTOMIZABLE_CAPABILITIES: ReadonlySet<WorkspaceCapability> = BASE_ROLE_CAPABILITIES.ADMIN;

export function isWorkspaceCapability(value: string): value is WorkspaceCapability {
  return (WORKSPACE_CAPABILITIES as readonly { key: string }[]).some((capability) => capability.key === value);
}
