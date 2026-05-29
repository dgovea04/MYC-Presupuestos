import { NextResponse } from "next/server";
import { constructStripeWebhookEvent, processStripeWebhookEvent } from "@/lib/billing/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;
  try {
    event = constructStripeWebhookEvent({ payload, signature });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Firma de Stripe invalida" },
      { status: 400 },
    );
  }

  try {
    await processStripeWebhookEvent({ event });

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo procesar el webhook" },
      { status: 400 },
    );
  }
}
