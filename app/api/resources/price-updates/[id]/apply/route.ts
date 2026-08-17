import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { applyResourcePriceUpdate } from "@/lib/resource-pricing/application";
import { resourcePriceApplySchema } from "@/lib/validations/resource-pricing";
import { clearResourcesProcessCache, GLOBAL_RESOURCES_CACHE_TAG, RESOURCES_BY_USER_CACHE_TAG } from "@/lib/data/resources";
import { revalidatePath, revalidateTag } from "next/cache";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("resource_prices.manage", request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const input = resourcePriceApplySchema.parse(await request.json());
    const result = await applyResourcePriceUpdate({ requestId: id, itemIds: input.itemIds, actorUserId: session.user.id });
    if (result.appliedCount > 0) {
      clearResourcesProcessCache();
      revalidateTag(GLOBAL_RESOURCES_CACHE_TAG, "max");
      revalidateTag(RESOURCES_BY_USER_CACHE_TAG, "max");
      revalidatePath("/resources");
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo aplicar la actualización." }, { status: 400 });
  }
}
