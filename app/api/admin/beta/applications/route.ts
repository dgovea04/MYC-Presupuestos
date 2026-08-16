import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { listBetaApplications, reviewBetaApplication } from "@/lib/beta/applications";

const statusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
const reviewSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reviewNote: z.string().trim().max(500).nullable().optional(),
});

export async function GET(request: Request) {
  const session = await requireAdminSession("beta.read");
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const statusResult = statusSchema.safeParse(new URL(request.url).searchParams.get("status") ?? undefined);
  const applications = await listBetaApplications(statusResult.success ? statusResult.data : undefined);
  return NextResponse.json({ applications });
}

export async function PATCH(request: Request) {
  const session = await requireAdminSession("beta.manage", request);
  if (!session || !hasSuperAdminAccess(session.user)) {
    return NextResponse.json({ error: "Solo Super Admin puede revisar solicitudes beta." }, { status: 403 });
  }

  const body = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "La decisión o la nota no es válida." }, { status: 400 });
  }

  const applicationId = new URL(request.url).searchParams.get("id");
  if (!applicationId) return NextResponse.json({ error: "Falta la solicitud." }, { status: 400 });

  try {
    const result = await reviewBetaApplication({
      applicationId,
      reviewerId: session.user.id,
      decision: body.data.decision,
      reviewNote: body.data.reviewNote,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo revisar la solicitud." }, { status: 400 });
  }
}

function hasSuperAdminAccess(user: { isSuperAdmin?: boolean; adminProfile?: string | null }) {
  return Boolean(user.isSuperAdmin) || user.adminProfile === "SUPER_ADMIN";
}
