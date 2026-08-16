import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { recordAdminAudit } from "@/lib/data/admin-audit";
import { BetaGrantSource, BetaGrantStatus } from "@prisma/client";
import { getBetaCampaignDetail, listBetaGrants, transitionBetaCampaign } from "@/lib/beta/campaigns";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "FINISHED"]),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession("beta.read");

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const { id } = await params;
  const hasGrantFilters = ["q", "status", "source", "page", "pageSize"].some((key) => searchParams.has(key));
  const campaign = await getBetaCampaignDetail(id);

  if (!campaign) {
    return NextResponse.json({ error: "Campaña beta no encontrada." }, { status: 404 });
  }

  if (!hasGrantFilters) {
    return NextResponse.json({ campaign });
  }

  const status = parseEnum(searchParams.get("status"), Object.values(BetaGrantStatus));
  const source = parseEnum(searchParams.get("source"), Object.values(BetaGrantSource));
  const result = await listBetaGrants({
    campaignId: id,
    query: searchParams.get("q") ?? undefined,
    status,
    source,
    page: parsePositiveInteger(searchParams.get("page")),
    pageSize: Math.min(100, parsePositiveInteger(searchParams.get("pageSize")) ?? 25),
  });

  return NextResponse.json({
    campaign: { ...campaign, grants: result.grants },
    grantsPagination: result.pagination,
    grantFilters: result.filters,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "El estado de campaña no es válido." }, { status: 400 });
  }

  const session = await requireAdminSession("beta.manage", request);

  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const campaign = await transitionBetaCampaign(id, parsed.data.status);
    await recordAdminAudit({
      actorUserId: session.user.id,
      targetUserId: null,
      targetEmail: session.user.email ?? "sistema",
      action: `BETA_CAMPAIGN_${parsed.data.status}`,
      detail: `Campaña beta ${campaign.name} actualizada a ${parsed.data.status}.`,
      metadata: { campaignId: campaign.id, status: parsed.data.status },
      ...getAdminActionContext(request),
    });
    revalidatePath("/admin");

    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la campaña beta." },
      { status: 400 },
    );
  }
}

function parsePositiveInteger(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseEnum<T extends string>(value: string | null, values: readonly T[]) {
  return values.includes(value as T) ? (value as T) : undefined;
}

function getAdminActionContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
