import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { performBulkAdminUserAction, type AdminBulkUserAction } from "@/lib/data/admin-bulk-actions";

const bulkActionSchema = z.object({
  userIds: z.array(z.string().trim().min(1)).min(1).max(50),
  action: z.enum(["SUSPEND", "REACTIVATE", "REVOKE_SESSIONS"]),
});

export async function POST(request: Request) {
  let payload: z.infer<typeof bulkActionSchema>;

  try {
    payload = bulkActionSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Selecciona entre 1 y 50 usuarios y una acción válida." }, { status: 400 });
    }

    return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
  }

  const capability = payload.action === "REVOKE_SESSIONS" ? "users.revoke_sessions" : "users.manage_lifecycle";
  const session = await requireAdminSession(capability);

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await performBulkAdminUserAction({
      userIds: payload.userIds,
      action: payload.action as AdminBulkUserAction,
      actorUserId: session.user.id,
      context: getAdminActionContext(request),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo completar la operación masiva." },
      { status: 400 },
    );
  }
}

function getAdminActionContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
