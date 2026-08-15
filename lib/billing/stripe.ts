import Stripe from "stripe";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { trackServerEvent } from "@/lib/analytics/events";

type StripeCheckoutSession = {
  id: string;
  url: string | null;
};

type StripePortalSession = {
  id: string;
  url: string;
};

type StripeSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired";

type StripeSubscriptionRecord = {
  id: string;
  status: StripeSubscriptionStatus | string;
  customer: string | { id: string } | null;
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
  items?: {
    data: Array<{
      price?: {
        id?: string;
      };
    }>;
  };
};

type StripeBillingClient = {
  checkout: {
    sessions: {
      create: (params: {
        client_reference_id: string;
        customer?: string;
        customer_email?: string;
        line_items: Array<{ price: string; quantity: number }>;
        metadata: Record<string, string>;
        mode: "subscription";
        subscription_data: { metadata: Record<string, string> };
        success_url: string;
        cancel_url: string;
      }) => Promise<StripeCheckoutSession>;
    };
  };
  billingPortal: {
    sessions: {
      create: (params: { customer: string; return_url: string }) => Promise<StripePortalSession>;
    };
  };
  subscriptions: {
    retrieve: (subscriptionId: string) => Promise<StripeSubscriptionRecord>;
  };
};

type BillingPrismaClient = {
  user: {
    findUnique: (args: {
      where: { id: string };
      select: {
        id?: true;
        email?: true;
        name?: true;
        billingSubscriptions?: {
          where?: { provider: "STRIPE" };
          select: { stripeCustomerId: true };
          orderBy: { updatedAt: "desc" };
          take: 1;
        };
      };
    }) => Promise<{
      id: string;
      email: string;
      name: string;
      billingSubscriptions: Array<{ stripeCustomerId: string | null }>;
    } | null>;
    update: (args: { where: { id: string }; data: { membershipPlanId: string } }) => Promise<unknown>;
  };
  membershipPlan: {
    findUnique: (args: { where: { slug: "pro" | "starter" } }) => Promise<{ id: string; slug: string } | null>;
  };
  billingSubscription: {
    findFirst: (args: {
      where: { userId?: string; provider?: "STRIPE"; stripeCustomerId?: string; stripeSubscriptionId?: string };
      select?: { stripeCustomerId?: true; userId?: true; pastDueStartedAt?: true; status?: true };
      orderBy?: { updatedAt: "desc" };
    }) => Promise<{ stripeCustomerId: string | null; userId?: string; pastDueStartedAt?: Date | null; status?: string } | null>;
    upsert: (args: {
      where: { stripeSubscriptionId: string };
      create: BillingSubscriptionWrite;
      update: Omit<BillingSubscriptionWrite, "userId" | "provider" | "stripeSubscriptionId">;
    }) => Promise<unknown>;
  };
};

type BillingSubscriptionWrite = {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  currentPeriodStart: Date | null;
  pastDueStartedAt: Date | null;
  provider: "STRIPE";
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INCOMPLETE" | "INCOMPLETE_EXPIRED";
  stripeCustomerId: string | null;
  stripePriceId: string | null;
  stripeSubscriptionId: string;
  userId: string;
};

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Falta configurar STRIPE_SECRET_KEY.");
  }

  return new Stripe(secretKey) as unknown as StripeBillingClient;
}

export async function createProCheckoutSession({
  prisma = defaultPrisma as unknown as BillingPrismaClient,
  stripe = getStripeClient(),
  user,
}: {
  prisma?: BillingPrismaClient;
  stripe?: StripeBillingClient;
  user: { id: string; email?: string | null; name?: string | null };
}) {
  const priceId = getRequiredEnv("STRIPE_PRICE_PRO_MONTHLY");
  const appUrl = getAppUrl();
  const billingUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      billingSubscriptions: {
        where: { provider: "STRIPE" },
        select: { stripeCustomerId: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });
  const stripeCustomerId = billingUser?.billingSubscriptions[0]?.stripeCustomerId;
  const customerEmail = user.email ?? billingUser?.email ?? null;

  if (!stripeCustomerId && !customerEmail) {
    throw new Error("El usuario necesita un correo para iniciar checkout.");
  }

  const customerParams: { customer: string } | { customer_email: string } = stripeCustomerId
    ? { customer: stripeCustomerId }
    : { customer_email: customerEmail ?? "" };

  const session = await stripe.checkout.sessions.create({
    client_reference_id: user.id,
    ...customerParams,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId: user.id, plan: "pro" },
    mode: "subscription",
    subscription_data: { metadata: { userId: user.id, plan: "pro" } },
    success_url: `${appUrl}/account?billing=success`,
    cancel_url: `${appUrl}/account?billing=cancelled`,
  });

  if (!session.url) {
    throw new Error("Stripe no devolvio una URL de checkout.");
  }

  return session;
}

export async function createBillingPortalSession({
  prisma = defaultPrisma as unknown as BillingPrismaClient,
  stripe = getStripeClient(),
  userId,
}: {
  prisma?: BillingPrismaClient;
  stripe?: StripeBillingClient;
  userId: string;
}) {
  const subscription = await prisma.billingSubscription.findFirst({
    where: { userId, provider: "STRIPE" },
    select: { stripeCustomerId: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!subscription?.stripeCustomerId) {
    throw new Error("No hay una suscripcion de Stripe para gestionar.");
  }

  return stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${getAppUrl()}/account`,
  });
}

export async function syncStripeSubscription({
  prisma = defaultPrisma as unknown as BillingPrismaClient,
  stripe = getStripeClient(),
  subscriptionId,
}: {
  prisma?: BillingPrismaClient;
  stripe?: StripeBillingClient;
  subscriptionId: string;
}) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = await resolveSubscriptionUserId(prisma, subscription);
  const proPlan = await prisma.membershipPlan.findUnique({ where: { slug: "pro" } });

  if (!proPlan) {
    throw new Error("Plan Pro no encontrado.");
  }

  const existingSubscription = await prisma.billingSubscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { pastDueStartedAt: true, status: true, stripeCustomerId: true },
  });
  const isNewSubscription = !existingSubscription;
  const write = mapStripeSubscription(subscription, userId, existingSubscription?.status === "PAST_DUE" ? existingSubscription.pastDueStartedAt ?? null : null);

  await prisma.billingSubscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: write,
    update: {
      cancelAtPeriodEnd: write.cancelAtPeriodEnd,
      currentPeriodEnd: write.currentPeriodEnd,
      currentPeriodStart: write.currentPeriodStart,
      pastDueStartedAt: write.pastDueStartedAt,
      status: write.status,
      stripeCustomerId: write.stripeCustomerId,
      stripePriceId: write.stripePriceId,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { membershipPlanId: proPlan.id },
  });

  if (isNewSubscription) {
    void trackServerEvent("subscription_created", {
      userId,
      provider: "stripe",
      target_plan: "pro",
      subscription_status: write.status,
    }).catch(() => undefined);
  }
}

function mapStripeSubscription(subscription: StripeSubscriptionRecord, userId: string, existingPastDueStartedAt: Date | null): BillingSubscriptionWrite {
  const status = mapStripeStatus(subscription.status);

  return {
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodEnd: timestampToDate(subscription.current_period_end),
    currentPeriodStart: timestampToDate(subscription.current_period_start),
    pastDueStartedAt: status === "PAST_DUE" ? existingPastDueStartedAt ?? new Date() : null,
    provider: "STRIPE",
    status,
    stripeCustomerId: resolveStripeCustomerId(subscription.customer),
    stripePriceId: subscription.items?.data[0]?.price?.id ?? null,
    stripeSubscriptionId: subscription.id,
    userId,
  };
}

async function resolveSubscriptionUserId(prisma: BillingPrismaClient, subscription: StripeSubscriptionRecord) {
  const metadataUserId = subscription.metadata?.userId;
  if (metadataUserId) {
    return metadataUserId;
  }

  const stripeCustomerId = resolveStripeCustomerId(subscription.customer);
  if (!stripeCustomerId) {
    throw new Error("La suscripcion de Stripe no incluye usuario ni cliente.");
  }

  const existing = await prisma.billingSubscription.findFirst({
    where: { stripeCustomerId },
  });

  if (!existing?.userId) {
    throw new Error("No se pudo asociar la suscripcion de Stripe a un usuario.");
  }

  return existing.userId;
}

function mapStripeStatus(status: string): BillingSubscriptionWrite["status"] {
  if (status === "active") return "ACTIVE";
  if (status === "trialing") return "TRIALING";
  if (status === "past_due") return "PAST_DUE";
  if (status === "canceled") return "CANCELED";
  if (status === "unpaid") return "UNPAID";
  if (status === "incomplete_expired") return "INCOMPLETE_EXPIRED";

  return "INCOMPLETE";
}

function resolveStripeCustomerId(customer: StripeSubscriptionRecord["customer"]) {
  if (typeof customer === "string") {
    return customer;
  }

  return customer?.id ?? null;
}

function timestampToDate(value: number | undefined) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function getAppUrl() {
  return getRequiredEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta configurar ${name}.`);
  }

  return value;
}
