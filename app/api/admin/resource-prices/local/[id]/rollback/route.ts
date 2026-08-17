import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireSuperAdminSession } from "@/lib/auth/session";
import { rollbackLocalResourcePriceBatch } from "@/lib/local-resource-pricing/service";
import { GLOBAL_RESOURCES_CACHE_TAG, RESOURCES_BY_USER_CACHE_TAG, clearResourcesProcessCache } from "@/lib/data/resources";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await params;
    const batch = await rollbackLocalResourcePriceBatch({ batchId: id, actorUserId: session.user.id });
    clearResourcesProcessCache();
    revalidateTag(GLOBAL_RESOURCES_CACHE_TAG, "max");
    revalidateTag(RESOURCES_BY_USER_CACHE_TAG, "max");
    revalidatePath("/resources");
    return NextResponse.json({ batch });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo revertir la versión." }, { status: 400 });
  }
}
