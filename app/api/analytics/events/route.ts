import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { persistMarketingEvent } from "@/lib/analytics/store";
import type { AnalyticsEventName } from "@/lib/analytics/events";
import type { AnalyticsPrimitive } from "@/lib/analytics/gtag";
import { z } from "zod";

const clientEventNames = [
  "landing_view",
  "signup_started",
  "pricing_viewed",
  "upgrade_clicked",
  "excel_paste_used",
] as const satisfies readonly AnalyticsEventName[];

const clientEventSchema = z.object({
  name: z.enum(clientEventNames),
  clientId: z.string().trim().min(1).max(160),
  params: z
    .record(z.string().trim().min(1).max(80), z.union([z.string().max(160), z.number(), z.boolean(), z.null()]))
    .optional()
    .default({}),
});

type ClientEventInput = z.infer<typeof clientEventSchema>;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = clientEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const session = await getAuthSession();
  const input: ClientEventInput = parsed.data;
  const params: Record<string, AnalyticsPrimitive> = input.params;

  try {
    await persistMarketingEvent({
      name: input.name,
      userId: session?.user?.id ?? null,
      clientId: input.clientId,
      params,
    });
  } catch {
    // Analytics ingestion is best effort and must not affect the visitor experience.
  }

  return new NextResponse(null, { status: 204 });
}
