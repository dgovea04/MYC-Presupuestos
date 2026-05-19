import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { deleteResource, GLOBAL_RESOURCES_CACHE_TAG, resourceMutationTouchesGlobalCatalog, updateResource } from "@/lib/data/resources";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = await params;
    const shouldRevalidateGlobalCatalog = await resourceMutationTouchesGlobalCatalog([id]);
    const resource = await updateResource(id, session.user.id, body);
    if (shouldRevalidateGlobalCatalog || resource.companyId == null) {
      revalidateTag(GLOBAL_RESOURCES_CACHE_TAG, "max");
    }
    revalidatePath("/resources");
    return NextResponse.json(resource);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el insumo" }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const shouldRevalidateGlobalCatalog = await resourceMutationTouchesGlobalCatalog([id]);
    await deleteResource(id, session.user.id);
    if (shouldRevalidateGlobalCatalog) {
      revalidateTag(GLOBAL_RESOURCES_CACHE_TAG, "max");
    }
    revalidatePath("/resources");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el insumo" }, { status: 400 });
  }
}
