import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { recordAdminAudit } from "@/lib/data/admin-audit";
import { createBetaCampaign, listBetaCampaigns } from "@/lib/beta/campaigns";

const statusSchema = z.enum(["DRAFT", "ACTIVE", "PAUSED", "FINISHED"]);

export async function GET(request: Request) {
  const session = await requireAdminSession("beta.read");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const parsedStatus = statusSchema.safeParse(searchParams.get("status") ?? undefined);
  const page = parsePositiveInteger(searchParams.get("page"));
  const pageSize = parsePositiveInteger(searchParams.get("pageSize"));
  const result = await listBetaCampaigns({
    status: parsedStatus.success ? parsedStatus.data : undefined,
    page,
    pageSize,
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await requireAdminSession("beta.manage", request);

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const campaign = await createBetaCampaign(await request.json(), session.user.id);
    await recordAdminAudit({
      actorUserId: session.user.id,
      targetUserId: null,
      targetEmail: session.user.email ?? "sistema",
      action: "BETA_CAMPAIGN_CREATED",
      detail: `Campaña beta ${campaign.name} creada.`,
      metadata: {
        campaignId: campaign.id,
        durationDays: campaign.durationDays,
        assignmentMode: campaign.assignmentMode,
      },
      ...getAdminActionContext(request),
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la campaña beta." },
      { status: 400 },
    );
  }
}

function parsePositiveInteger(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function getAdminActionContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
