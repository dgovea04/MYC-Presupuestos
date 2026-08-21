import type { Prisma, ProjectAccessRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveWorkspaceCapabilities } from "@/lib/workspace/permissions";
import { requireWorkspaceRole, requireWorkspaceCapability, WorkspaceAuthorizationError } from "@/lib/workspace/authorization";
import type { WorkspaceCapability } from "@/lib/workspace/capabilities";
import { recordWorkspaceAudit } from "@/lib/workspace/audit";

const PROJECT_ROLE_RANK: Record<ProjectAccessRole, number> = { VIEWER: 1, EDITOR: 2, ADMIN: 3 };

export type ProjectAccessScope = { restricted: boolean; grantedProjectIds: string[] | null };

/**
 * Filtro `where` puro para limitar la lectura de proyectos al acceso del
 * miembro. Un miembro activo con rol base (sin rol personalizado) o con un
 * rol personalizado que otorga `projects.read` ve todos los proyectos del
 * workspace; el resto solo ve los proyectos compartidos explícitamente.
 * No consulta la base de datos, por lo que se compone en queries existentes.
 */
export function projectAccessWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [
      {
        company: {
          memberships: {
            some: { userId, status: "ACTIVE", customRoleId: null },
          },
        },
      },
      {
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
              customRole: { permissions: { some: { permissionKey: "projects.read" } } },
            },
          },
        },
      },
      {
        company: { memberships: { some: { userId, status: "ACTIVE" } } },
        projectMemberships: { some: { userId } },
      },
    ],
  };
}

/**
 * Un miembro es "restringido" si sus capacidades no incluyen `projects.read`.
 * Los miembros con acceso completo ven todos los proyectos; los restringidos
 * solo ven los proyectos compartidos explícitamente.
 */
export async function getProjectAccessScope(options: { userId: string; companyId: string }): Promise<ProjectAccessScope> {
  const { capabilities } = await resolveWorkspaceCapabilities(options);

  if (capabilities.has("projects.read")) {
    return { restricted: false, grantedProjectIds: null };
  }

  const grants = await prisma.projectMembership.findMany({
    where: { companyId: options.companyId, userId: options.userId },
    select: { projectId: true },
  });

  return { restricted: true, grantedProjectIds: grants.map((grant) => grant.projectId) };
}

async function resolveProjectGrant(options: {
  userId: string;
  projectId: string;
  minimumRole?: ProjectAccessRole;
}): Promise<{ restricted: true; role: ProjectAccessRole }> {
  const grant = await prisma.projectMembership.findUnique({
    where: { projectId_userId: { projectId: options.projectId, userId: options.userId } },
    select: { role: true },
  });
  if (!grant) throw new WorkspaceAuthorizationError("No tienes acceso a este proyecto");
  if (options.minimumRole && PROJECT_ROLE_RANK[grant.role] < PROJECT_ROLE_RANK[options.minimumRole]) {
    throw new WorkspaceAuthorizationError("No tienes el rol necesario en este proyecto");
  }

  return { restricted: true, role: grant.role };
}

export async function requireProjectRole(options: {
  userId: string;
  companyId: string;
  projectId: string;
  minimumRole?: ProjectAccessRole;
}): Promise<{ restricted: boolean; role: ProjectAccessRole | null }> {
  const scope = await getProjectAccessScope(options);
  if (!scope.restricted) return { restricted: false, role: null };
  return resolveProjectGrant({ userId: options.userId, projectId: options.projectId, minimumRole: options.minimumRole });
}

/**
 * Autorización compuesta workspace + proyecto para mutaciones.
 * Un miembro con acceso completo al workspace se valida contra su capability
 * (rol base o rol personalizado); un miembro restringido se valida contra el
 * grant explícito del proyecto con el rol mínimo solicitado.
 */
export async function requireProjectCapability(options: {
  userId: string;
  companyId: string;
  projectId: string;
  capability: WorkspaceCapability;
  minimumProjectRole?: ProjectAccessRole;
}): Promise<{ restricted: boolean; role: ProjectAccessRole | null }> {
  const scope = await getProjectAccessScope({ userId: options.userId, companyId: options.companyId });

  if (!scope.restricted) {
    await requireWorkspaceCapability({ userId: options.userId, companyId: options.companyId, capability: options.capability });
    return { restricted: false, role: null };
  }

  return resolveProjectGrant({ userId: options.userId, projectId: options.projectId, minimumRole: options.minimumProjectRole });
}

async function resolveManagedProject(actorUserId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, companyId: true, name: true },
  });
  if (!project) throw new Error("Proyecto no encontrado");

  await requireWorkspaceRole({ userId: actorUserId, companyId: project.companyId, minimumRole: "ADMIN" });
  return project;
}

export async function shareProjectAccess(options: {
  actorUserId: string;
  projectId: string;
  userId: string;
  role: ProjectAccessRole;
}) {
  const project = await resolveManagedProject(options.actorUserId, options.projectId);

  const target = await prisma.companyMembership.findUnique({
    where: { companyId_userId: { companyId: project.companyId, userId: options.userId } },
    select: { role: true, status: true },
  });
  if (!target || target.status !== "ACTIVE") {
    throw new Error("El usuario no es miembro activo de este workspace");
  }
  if (target.role === "OWNER" || target.role === "ADMIN") {
    throw new Error("Este miembro ya tiene acceso completo al workspace");
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.projectMembership.upsert({
      where: { projectId_userId: { projectId: options.projectId, userId: options.userId } },
      update: { role: options.role },
      create: { projectId: options.projectId, companyId: project.companyId, userId: options.userId, role: options.role },
    });
    await recordWorkspaceAudit(
      {
        companyId: project.companyId,
        actorUserId: options.actorUserId,
        action: "PROJECT_SHARED",
        targetType: "PROJECT",
        targetId: options.projectId,
        targetLabel: project.name,
        metadata: { userId: options.userId, role: options.role },
      },
      tx,
    );
    return membership;
  });
}

export async function revokeProjectAccess(options: {
  actorUserId: string;
  projectId: string;
  userId: string;
}) {
  const project = await resolveManagedProject(options.actorUserId, options.projectId);

  return prisma.$transaction(async (tx) => {
    await tx.projectMembership.deleteMany({
      where: { projectId: options.projectId, companyId: project.companyId, userId: options.userId },
    });
    await recordWorkspaceAudit(
      {
        companyId: project.companyId,
        actorUserId: options.actorUserId,
        action: "PROJECT_UNSHARED",
        targetType: "PROJECT",
        targetId: options.projectId,
        targetLabel: project.name,
        metadata: { userId: options.userId },
      },
      tx,
    );
    return { ok: true };
  });
}

export async function listProjectAccess(options: { actorUserId: string; projectId: string }) {
  const project = await resolveManagedProject(options.actorUserId, options.projectId);

  return prisma.projectMembership.findMany({
    where: { projectId: options.projectId, companyId: project.companyId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}
