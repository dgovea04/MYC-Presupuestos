import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { getAiUsageReport } from "@/lib/ai/credentials/metrics";
import { z } from "zod";

const querySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  workspaceId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  provider: z.string().trim().min(1).max(100).optional(),
  credentialSource: z.string().trim().min(1).max(50).optional(),
  task: z.string().trim().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  const session = await requireAdminSession("ai_usage.read");
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Filtros inválidos" }, { status: 400 });

  const report = await getAiUsageReport({
    ...parsed.data,
    from: parsed.data.from ? new Date(parsed.data.from) : undefined,
    to: parsed.data.to ? new Date(parsed.data.to) : undefined,
  });
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
