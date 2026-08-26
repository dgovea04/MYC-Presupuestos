import { afterEach, describe, expect, it } from "vitest";
import {
  isLegacyAiCredentialFallbackEnabled,
  isScopedAiResolverEnabled,
} from "@/lib/ai/credentials/rollout";
import {
  getDeploymentReadiness,
  type DeploymentEnvironment,
} from "@/lib/config/deployment-readiness";

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  AI_SCOPED_RESOLVER_ENABLED: process.env.AI_SCOPED_RESOLVER_ENABLED,
  AI_LEGACY_CREDENTIAL_FALLBACK: process.env.AI_LEGACY_CREDENTIAL_FALLBACK,
};

const completeProductionEnvironment: DeploymentEnvironment = {
  DATABASE_URL: "postgresql://production.example/mc",
  AUTH_SECRET: "a".repeat(40),
  NEXTAUTH_SECRET: "a".repeat(40),
  NEXTAUTH_URL: "https://app.example.com",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  CRON_SECRET: "c".repeat(32),
  ENCRYPTION_KEY: "e".repeat(40),
};

afterEach(() => {
  restoreEnvironment("NODE_ENV", originalEnvironment.NODE_ENV);
  restoreEnvironment("AI_SCOPED_RESOLVER_ENABLED", originalEnvironment.AI_SCOPED_RESOLVER_ENABLED);
  restoreEnvironment("AI_LEGACY_CREDENTIAL_FALLBACK", originalEnvironment.AI_LEGACY_CREDENTIAL_FALLBACK);
});

describe("AI credential rollout checklist", () => {
  it("starts in legacy-safe mode when flags are omitted outside production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.AI_SCOPED_RESOLVER_ENABLED;
    delete process.env.AI_LEGACY_CREDENTIAL_FALLBACK;

    expect(isScopedAiResolverEnabled()).toBe(false);
    expect(isLegacyAiCredentialFallbackEnabled()).toBe(true);
  });

  it("supports staged activation and explicit rollback", () => {
    process.env.AI_SCOPED_RESOLVER_ENABLED = "true";
    process.env.AI_LEGACY_CREDENTIAL_FALLBACK = "true";
    expect(isScopedAiResolverEnabled()).toBe(true);
    expect(isLegacyAiCredentialFallbackEnabled()).toBe(true);

    process.env.AI_SCOPED_RESOLVER_ENABLED = "false";
    expect(isScopedAiResolverEnabled()).toBe(false);

    process.env.AI_SCOPED_RESOLVER_ENABLED = "true";
    process.env.AI_LEGACY_CREDENTIAL_FALLBACK = "false";
    expect(isScopedAiResolverEnabled()).toBe(true);
    expect(isLegacyAiCredentialFallbackEnabled()).toBe(false);
  });

  it("requires a dedicated encryption key before production is ready", () => {
    const result = getDeploymentReadiness(
      { ...completeProductionEnvironment, ENCRYPTION_KEY: undefined },
      "production",
    );

    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.key === "encryption_key")).toEqual({
      key: "encryption_key",
      status: "error",
      message: expect.stringContaining("obligatoria"),
    });
  });

  it("accepts production readiness when encryption and authentication secrets are configured", () => {
    const result = getDeploymentReadiness(completeProductionEnvironment, "production");

    expect(result.ready).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.checks.find((check) => check.key === "encryption_key")?.status).toBe("ok");
  });
});

function restoreEnvironment(key: keyof NodeJS.ProcessEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
