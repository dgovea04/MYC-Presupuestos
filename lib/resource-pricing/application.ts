import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { recordAdminAudit } from "@/lib/data/admin-audit";
import { assertCanApplyGlobalResourcePriceUpdate } from "@/lib/resource-pricing/authorization";
import { publishResourcePriceEvent } from "@/lib/resource-pricing/events";
import { serializeResourcePriceRequest } from "@/lib/resource-pricing/serialization";

export async function applyResourcePriceUpdate(input: { requestId: string; itemIds?: string[]; actorUserId: string }) {
  await assertCanApplyGlobalResourcePriceUpdate(input.actorUserId);
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.resourcePriceUpdateRequest.findUnique({ where: { id: input.requestId } });
    if (!request) throw new Error("Solicitud de precios no encontrada.");
    if (!["PREVIEW_READY", "PARTIALLY_APPLIED"].includes(request.status)) throw new Error("La solicitud no está lista para aplicar.");

    const items = await tx.resourcePriceUpdateItem.findMany({
      where: {
        requestId: input.requestId,
        status: "UPDATED",
        ...(input.itemIds?.length ? { id: { in: input.itemIds } } : {}),
      },
    });
    let appliedCount = 0;
    let conflictCount = 0;

    for (const item of items) {
      if (!item.resourceId || item.newPrice == null || item.oldPrice == null) continue;
      const resource = await tx.resource.findFirst({ where: { id: item.resourceId, companyId: null } });
      if (!resource) {
        await tx.resourcePriceUpdateItem.update({ where: { id: item.id }, data: { status: "CONFLICT", reason: "El recurso ya no pertenece al catálogo global." } });
        conflictCount += 1;
        continue;
      }
      if (new Decimal(resource.unitPrice.toString()).comparedTo(new Decimal(item.oldPrice.toString())) !== 0) {
        await tx.resourcePriceUpdateItem.update({ where: { id: item.id }, data: { status: "CONFLICT", reason: "El precio fue modificado manualmente después del preview." } });
        conflictCount += 1;
        continue;
      }
      await tx.resource.update({
        where: { id: resource.id },
        data: {
          unitPrice: item.newPrice,
          priceUpdatedAt: new Date(),
          priceObservedAt: request.createdAt,
          priceSource: request.provider,
          priceSyncStatus: "FRESH",
        },
      });
      await tx.resourcePriceUpdateItem.update({ where: { id: item.id }, data: { status: "APPLIED", appliedAt: new Date(), appliedById: input.actorUserId } });
      appliedCount += 1;
    }

    const remaining = await tx.resourcePriceUpdateItem.count({ where: { requestId: request.id, status: "UPDATED" } });
    const status = remaining === 0 ? "APPLIED" : appliedCount > 0 ? "PARTIALLY_APPLIED" : "PARTIALLY_APPLIED";
    const updatedRequest = await tx.resourcePriceUpdateRequest.update({
      where: { id: request.id },
      data: { status, completedAt: new Date() },
    });
    await recordAdminAudit({
      actorUserId: input.actorUserId,
      targetUserId: null,
      targetEmail: "global-resource-catalog",
      action: "RESOURCE_PRICE_UPDATE_APPLIED",
      detail: `Aplicación ${request.id}: ${appliedCount} precios aplicados, ${conflictCount} conflictos.`,
      metadata: {
        requestId: request.id,
        appliedCount,
        conflictCount,
        status,
      },
    }, tx);
    return { request: updatedRequest, appliedCount, conflictCount };
  });

  publishResourcePriceEvent({ type: "request.applied", requestId: input.requestId, appliedCount: result.appliedCount });
  return { request: serializeResourcePriceRequest(result.request), appliedCount: result.appliedCount, conflictCount: result.conflictCount };
}
