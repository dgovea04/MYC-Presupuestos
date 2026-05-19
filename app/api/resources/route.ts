import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import {
  createResourceForUser,
  GLOBAL_RESOURCES_CACHE_TAG,
  resourcePatchTouchesGlobalCatalog,
  saveResourcesPatch,
} from "@/lib/data/resources";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const resource = await createResourceForUser(session.user.id, body);
    if (resource.companyId == null) {
      revalidateTag(GLOBAL_RESOURCES_CACHE_TAG, "max");
    }
    revalidatePath("/resources");
    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el insumo" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const shouldRevalidateGlobalCatalog = await resourcePatchTouchesGlobalCatalog(session.user.id, body);
    const result = await saveResourcesPatch(session.user.id, body);
    if (shouldRevalidateGlobalCatalog) {
      revalidateTag(GLOBAL_RESOURCES_CACHE_TAG, "max");
    }
    revalidatePath("/resources");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron guardar los insumos" }, { status: 400 });
  }
}
