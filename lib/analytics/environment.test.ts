import { describe, expect, it } from "vitest";
import { isExternalAnalyticsEnabled } from "@/lib/analytics/environment";

describe("external analytics environment guard", () => {
  it("disables external analytics for localhost even when GA credentials exist", () => {
    expect(
      isExternalAnalyticsEnabled({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TEST123",
        GA_API_SECRET: "secret",
      }),
    ).toBe(false);
  });

  it("disables external analytics for non-production deployment targets", () => {
    expect(
      isExternalAnalyticsEnabled({
        NEXT_PUBLIC_APP_URL: "https://staging.myc-presupuestos.com",
        NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TEST123",
        GA_API_SECRET: "secret",
        DEPLOYMENT_TARGET: "staging",
      }),
    ).toBe(false);
  });

  it("enables external analytics only for production HTTPS app URLs with a GA measurement ID", () => {
    expect(
      isExternalAnalyticsEnabled({
        NEXT_PUBLIC_APP_URL: "https://app.myc-presupuestos.com",
        NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TEST123",
        DEPLOYMENT_TARGET: "production",
      }),
    ).toBe(true);
  });
});
