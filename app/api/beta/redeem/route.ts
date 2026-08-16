import { NextResponse } from "next/server";
import { consumeRateLimit, getRateLimitHeaders } from "@/lib/auth/rate-limit";
import { getAuthSession } from "@/lib/auth/session";
import { assignBetaGrant } from "@/lib/beta/assignments";
import { prisma } from "@/lib/db/prisma";
import { getWorkspaceLicenseCacheTag } from "@/lib/workspace/entitlements";
import { revalidateTag } from "next/cache";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const rateLimit = await consumeRateLimit({
    key: `beta-redeem:${session.user.id}`,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta nuevamente más tarde." },
      { status: 429, headers: getRateLimitHeaders(rateLimit) },
    );
  }

  const body = await request.json().catch(() => null);
  const code = readCode(body);

  if (!code) {
    return NextResponse.json({ error: "Ingresa un código de campaña." }, { status: 400 });
  }

  const campaign = await prisma.betaCampaign.findUnique({ where: { code }, select: { id: true } });

  if (!campaign) {
    return NextResponse.json({ error: "El código no es válido o ya no está disponible." }, { status: 400 });
  }

  try {
    const grant = await assignBetaGrant({
      campaignId: campaign.id,
      userId: session.user.id,
      source: "CODE",
      code,
    });
    revalidateTag(getWorkspaceLicenseCacheTag(session.user.id, null), "max");

    return NextResponse.json({
      ok: true,
      created: grant.created,
      startsAt: grant.startsAt.toISOString(),
      expiresAt: grant.expiresAt.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo canjear el código." },
      { status: 400 },
    );
  }
}

function readCode(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("code" in value) || typeof value.code !== "string") {
    return null;
  }

  const code = value.code.trim().toLowerCase();
  return code.length >= 3 && code.length <= 80 ? code : null;
}
