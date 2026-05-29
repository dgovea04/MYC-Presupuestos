import Stripe from "stripe";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { getStripeClient, syncStripeSubscription } from "@/lib/billing/stripe";

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id?: string;
    };
  };
};

type WebhookPrismaClient = {
  billingWebhookEvent: {
    findUnique: (args: { where: { stripeEventId: string } }) => Promise<{ id: string } | null>;
    create: (args: {
      data: {
        stripeEventId: string;
        type: string;
        payload: unknown;
      };
    }) => Promise<unknown>;
  };
};

export function constructStripeWebhookEvent({
  payload,
  signature,
  stripe = getStripeClient() as unknown as Stripe,
}: {
  payload: string;
  signature: string | null;
  stripe?: Stripe;
}): StripeWebhookEvent {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("Falta configurar STRIPE_WEBHOOK_SECRET.");
  }

  if (!signature) {
    throw new Error("Falta la firma del webhook de Stripe.");
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret) as StripeWebhookEvent;
}

export async function processStripeWebhookEvent({
  event,
  prisma = defaultPrisma as unknown as WebhookPrismaClient,
  syncStripeSubscription: syncSubscription = ({ subscriptionId }) => syncStripeSubscription({ subscriptionId }),
}: {
  event: StripeWebhookEvent;
  prisma?: WebhookPrismaClient;
  syncStripeSubscription?: (input: { subscriptionId: string }) => Promise<void>;
}) {
  const existing = await prisma.billingWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });

  if (existing) {
    return;
  }

  if (isSubscriptionEvent(event.type)) {
    const subscriptionId = event.data.object.id;
    if (!subscriptionId) {
      throw new Error("El webhook de suscripcion no incluye subscription id.");
    }

    await syncSubscription({ subscriptionId });
  }

  await prisma.billingWebhookEvent.create({
    data: {
      stripeEventId: event.id,
      type: event.type,
      payload: JSON.parse(JSON.stringify(event)) as unknown,
    },
  });
}

function isSubscriptionEvent(type: string) {
  return (
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated" ||
    type === "customer.subscription.deleted" ||
    type === "customer.subscription.paused" ||
    type === "customer.subscription.resumed"
  );
}
