import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBillingPortalSession, createProCheckoutSession, createWorkspaceBillingPortalSession, createWorkspaceProCheckoutSession, syncStripeSubscription } from "@/lib/billing/stripe";

describe("Stripe billing service", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.myc.test");
    vi.stubEnv("STRIPE_PRICE_PRO_ANNUAL_FOUNDER", "price_pro_annual_founder");
  });

  it("creates a Pro checkout session for the signed-in user", async () => {
    const stripe = createStripeMock();
    const prisma = createBillingPrismaMock({ customerId: null });

    const session = await createProCheckoutSession({
      prisma,
      stripe,
      user: { id: "user-1", email: "user@example.com", name: "User Uno" },
    });

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: "user-1",
        customer_email: "user@example.com",
        line_items: [{ price: "price_pro_annual_founder", quantity: 1 }],
        metadata: { userId: "user-1", offer: "founder", plan: "pro", price_amount: "299" },
        mode: "subscription",
        subscription_data: { metadata: { userId: "user-1", offer: "founder", plan: "pro", price_amount: "299" } },
        success_url: "https://app.myc.test/account?billing=success",
        cancel_url: "https://app.myc.test/account?billing=cancelled",
      }),
    );
    expect(session.url).toBe("https://checkout.stripe.test/session");
  });

  it("falls back to the stored user email when the session email is missing", async () => {
    const stripe = createStripeMock();
    const prisma = createBillingPrismaMock({ customerId: null });

    await createProCheckoutSession({
      prisma,
      stripe,
      user: { id: "user-1", email: null, name: "User Uno" },
    });

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: "user-1",
        customer_email: "user@example.com",
      }),
    );
  });

  it("requires an existing Stripe customer before opening the portal", async () => {
    const stripe = createStripeMock();
    const prisma = createBillingPrismaMock({ customerId: null });

    await expect(createBillingPortalSession({ prisma, stripe, userId: "user-1" })).rejects.toThrow("No hay una suscripcion de Stripe");
  });

  it("syncs an active Stripe subscription to the local Pro plan", async () => {
    const stripe = createStripeMock();
    const prisma = createBillingPrismaMock({ customerId: null });

    await syncStripeSubscription({
      prisma,
      stripe,
      subscriptionId: "sub_1",
    });

    expect(prisma.billingSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          provider: "STRIPE",
          status: "ACTIVE",
          stripeSubscriptionId: "sub_1",
          userId: "user-1",
        }),
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { membershipPlanId: "plan-pro" },
    });
  });

  it("creates a workspace checkout session scoped to the company", async () => {
    const stripe = createStripeMock();
    const prisma = createBillingPrismaMock({ customerId: null });

    const session = await createWorkspaceProCheckoutSession({
      prisma,
      stripe,
      companyId: "company-1",
      user: { email: "owner@example.com" },
    });

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: "company-1",
        customer_email: "owner@example.com",
        metadata: { companyId: "company-1", offer: "founder", plan: "pro", price_amount: "299" },
        subscription_data: { metadata: { companyId: "company-1", offer: "founder", plan: "pro", price_amount: "299" } },
        success_url: "https://app.myc.test/settings?tab=billing&billing=success",
        cancel_url: "https://app.myc.test/settings?tab=billing&billing=cancelled",
      }),
    );
    expect(session.url).toBe("https://checkout.stripe.test/session");
  });

  it("requires an existing Stripe customer before opening the workspace portal", async () => {
    const stripe = createStripeMock();
    const prisma = createBillingPrismaMock({ customerId: null });

    await expect(createWorkspaceBillingPortalSession({ prisma, stripe, companyId: "company-1" })).rejects.toThrow("No hay una suscripcion de Stripe");
  });

  it("syncs a company-scoped Stripe subscription to CompanySubscription without touching per-user billing", async () => {
    const stripe = createStripeMock();
    stripe.subscriptions.retrieve = vi.fn().mockResolvedValue({
      id: "sub_company_1",
      status: "active",
      customer: "cus_1",
      current_period_start: 1_778_284_800,
      current_period_end: 1_780_876_800,
      cancel_at_period_end: false,
      metadata: { companyId: "company-1" },
      items: { data: [{ price: { id: "price_pro_annual_founder" } }] },
    });
    const prisma = createBillingPrismaMock({ customerId: null });

    await syncStripeSubscription({ prisma, stripe, subscriptionId: "sub_company_1" });

    expect(prisma.companySubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "company-1" },
        create: expect.objectContaining({
          companyId: "company-1",
          provider: "STRIPE",
          status: "ACTIVE",
          externalSubscriptionId: "sub_company_1",
          membershipPlanId: "plan-pro",
        }),
      }),
    );
    expect(prisma.billingSubscription.upsert).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

function createStripeMock() {
  return {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.test/session" }),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: "bps_1", url: "https://portal.stripe.test/session" }),
      },
    },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({
        id: "sub_1",
        status: "active",
        customer: "cus_1",
        current_period_start: 1_778_284_800,
        current_period_end: 1_780_876_800,
        cancel_at_period_end: false,
        metadata: { userId: "user-1" },
        items: { data: [{ price: { id: "price_pro_annual_founder" } }] },
      }),
    },
  };
}

function createBillingPrismaMock({ customerId }: { customerId: string | null }) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        name: "User Uno",
        billingSubscriptions: customerId ? [{ stripeCustomerId: customerId }] : [],
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    membershipPlan: {
      findUnique: vi.fn().mockResolvedValue({ id: "plan-pro", slug: "pro" }),
    },
    billingSubscription: {
      findFirst: vi.fn().mockResolvedValue(customerId ? { stripeCustomerId: customerId } : null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    companySubscription: {
      findUnique: vi.fn().mockResolvedValue(customerId ? { externalCustomerId: customerId } : null),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
}
