import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { betaGrantActionSchema } from "@/lib/beta/validation";
import { extendBetaGrant, revokeBetaGrant } from "@/lib/beta/assignments";
import { getWorkspaceLicenseCacheTag } from "@/lib/workspace/entitlements";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = betaGrantActionSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "La acción del grant no es válida." }, { status: 400 });
  }

  const session = await requireAdminSession(parsed.data.action === "REVOKE" ? "beta.revoke" : "beta.manage", request);

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const affected = parsed.data.action === "REVOKE"
      ? await revokeBetaGrant({ grantId: id, actorUserId: session.user.id, reason: parsed.data.reason })
      : await extendBetaGrant({
          grantId: id,
          actorUserId: session.user.id,
          newExpiresAt: parsed.data.newExpiresAt,
          reason: parsed.data.reason,
        });

    revalidateTag(getWorkspaceLicenseCacheTag(affected.userId, affected.companyId), "max");
    revalidatePath("/admin");
    revalidatePath("/account");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el grant beta." },
      { status: 400 },
    );
  }
}
