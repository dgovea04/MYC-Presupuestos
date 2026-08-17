import { prisma } from "@/lib/db/prisma";
import { hasAdminCapability } from "@/lib/auth/admin-permissions";

export async function assertCanRequestResourcePriceUpdate(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!user || user.status !== "ACTIVE") throw new Error("No puedes solicitar una actualización de precios.");
}

export async function assertCanManageResourcePriceProvider(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, adminProfile: true, status: true, isSuperAdmin: true } });
  if (!user || !hasAdminCapability(user, "resource_prices.manage")) {
    throw new Error("Solo un administrador de MC Presupuestos puede administrar el proveedor de precios.");
  }
}

export async function assertCanApplyGlobalResourcePriceUpdate(userId: string) {
  await assertCanManageResourcePriceProvider(userId);
}

export async function assertGlobalResourceIds(resourceIds: string[]) {
  if (resourceIds.length === 0) return;
  const count = await prisma.resource.count({ where: { id: { in: resourceIds }, companyId: null } });
  if (count !== resourceIds.length) {
    throw new Error("La sincronización solo admite insumos del catálogo global.");
  }
}
