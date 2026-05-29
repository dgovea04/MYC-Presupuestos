import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { createBillingPortalSession } from "@/lib/billing/stripe";

export async function POST() {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const portalSession = await createBillingPortalSession({ userId: session.user.id });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo abrir el portal de facturacion" },
      { status: 400 },
    );
  }
}
