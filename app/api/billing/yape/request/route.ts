import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { createYapePaymentRequest, getYapePaymentConfig } from "@/lib/billing/yape";

export async function POST() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const request = await createYapePaymentRequest({ userId: session.user.id });

    return NextResponse.json({
      requestId: request.id,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      yape: getYapePaymentConfig(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar la solicitud Yape" },
      { status: 400 },
    );
  }
}
