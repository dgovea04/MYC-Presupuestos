import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { trackServerEvent } from "@/lib/analytics/events";
import { createProCheckoutSession } from "@/lib/billing/stripe";

export async function POST() {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const checkoutSession = await createProCheckoutSession({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
    });

    try {
      await trackServerEvent("checkout_started", {
        userId: session.user.id,
        companyId: session.user.activeCompanyId ?? session.user.companyId,
        provider: "stripe",
        target_plan: "pro",
        billing_period: "monthly",
      });
    } catch {
      // Analytics must not turn a valid checkout session into an API failure.
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear checkout" },
      { status: 400 },
    );
  }
}
