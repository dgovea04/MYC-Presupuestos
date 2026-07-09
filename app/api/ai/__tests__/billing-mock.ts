import { vi } from "vitest";

/**
 * Shared billing mock for AI agent API tests.
 *
 * Provides FeatureAccessError and PlanLimitError classes matching the shape
 * expected by `createBillingErrorResponse` in `lib/billing/api.ts`.
 *
 * Usage:
 *   vi.mock("@/lib/billing/entitlements", () => createBillingMock());
 */

export function createBillingMock() {
  class FeatureAccessError extends Error {
    feature: string;
    constructor(message: string) {
      super(message);
      this.name = "FeatureAccessError";
      this.feature = "unknown";
    }
  }

  class PlanLimitError extends Error {
    resource: string;
    limit: number;
    usage: number;
    constructor(message: string) {
      super(message);
      this.name = "PlanLimitError";
      this.resource = "unknown";
      this.limit = 0;
      this.usage = 0;
    }
  }

  return {
    assertFeatureAccess: vi.fn().mockResolvedValue(undefined),
    FeatureAccessError,
    PlanLimitError,
  };
}
