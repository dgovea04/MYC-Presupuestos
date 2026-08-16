import { describe, expect, it } from "vitest";
import {
  getDeploymentReadiness,
  resolveDeploymentTarget,
  type DeploymentEnvironment,
} from "@/lib/config/deployment-readiness";

const validProductionEnvironment: DeploymentEnvironment = {
  DATABASE_URL: "postgresql://staging.example/db",
  AUTH_SECRET: "a".repeat(40),
  NEXTAUTH_SECRET: "a".repeat(40),
  NEXTAUTH_URL: "https://staging.example.com",
  NEXT_PUBLIC_APP_URL: "https://staging.example.com",
  CRON_SECRET: "c".repeat(32),
  ENCRYPTION_KEY: "e".repeat(40),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-ABC123",
  GA_API_SECRET: "ga-secret-value",
  RESEND_API_KEY: "re_test_value",
  EMAIL_FROM: "MC Presupuestos <noreply@example.com>",
};

describe("deployment readiness", () => {
  it("resolves Vercel preview as staging without exposing values", () => {
    expect(resolveDeploymentTarget("preview")).toBe("staging");
    expect(resolveDeploymentTarget("production")).toBe("production");
    expect(resolveDeploymentTarget("development")).toBe("development");

    const result = getDeploymentReadiness(
      {
        ...validProductionEnvironment,
        AUTH_SECRET: undefined,
        NEXTAUTH_SECRET: undefined,
      },
      "staging",
    );

    expect(result.ready).toBe(false);
    expect(result.errors.map((check) => check.key)).toContain("authentication_secret");
    expect(JSON.stringify(result)).not.toContain("postgresql://");
    expect(JSON.stringify(result)).not.toContain("ga-secret-value");
  });

  it("accepts a complete secure staging configuration", () => {
    const result = getDeploymentReadiness(validProductionEnvironment, "staging");

    expect(result.ready).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.checks.find((check) => check.key === "analytics")?.status).not.toBe("error");
  });

  it("blocks insecure production URLs and weak cron secrets", () => {
    const result = getDeploymentReadiness(
      {
        ...validProductionEnvironment,
        NEXTAUTH_URL: "http://app.example.com",
        NEXT_PUBLIC_APP_URL: "http://app.example.com",
        CRON_SECRET: "short",
      },
      "production",
    );

    expect(result.ready).toBe(false);
    expect(result.errors.map((check) => check.key)).toEqual(
      expect.arrayContaining(["NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL", "cron_secret"]),
    );
  });

  it("flags incomplete or malformed GA4 configuration without failing internal analytics", () => {
    const malformed = getDeploymentReadiness(
      {
        ...validProductionEnvironment,
        NEXT_PUBLIC_GA_MEASUREMENT_ID: "not-a-measurement-id",
      },
      "staging",
    );
    const browserOnly = getDeploymentReadiness(
      {
        ...validProductionEnvironment,
        GA_API_SECRET: undefined,
      },
      "staging",
    );

    expect(malformed.errors.map((check) => check.key)).toContain("analytics_measurement_id");
    expect(browserOnly.ready).toBe(true);
    expect(browserOnly.warnings.map((check) => check.key)).toContain("analytics_api_secret");
  });

  it("allows localhost HTTP during development while warning about missing deployment values", () => {
    const result = getDeploymentReadiness(
      {
        DATABASE_URL: "postgresql://localhost/myc",
        NEXTAUTH_URL: "http://localhost:3000",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      },
      "development",
    );

    expect(result.ready).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
