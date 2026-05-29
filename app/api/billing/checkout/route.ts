import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
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

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear checkout" },
      { status: 400 },
    );
  }
}
