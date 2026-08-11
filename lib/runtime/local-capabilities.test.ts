import { afterEach, describe, expect, it, vi } from "vitest";
import { isLocalClientRuntimeEnabled, isLocalServerRuntimeEnabled } from "@/lib/runtime/local-capabilities";

describe("local runtime capability gates", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enables server capabilities in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isLocalServerRuntimeEnabled()).toBe(true);
  });

  it("disables server capabilities in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isLocalServerRuntimeEnabled()).toBe(false);
  });

  it("stays disabled in preview-like server environments by default", () => {
    vi.stubEnv("NODE_ENV", "staging");
    expect(isLocalServerRuntimeEnabled()).toBe(false);
  });

  it("allows an explicit server desktop opt-in", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MYC_ENABLE_LOCAL_SERVICES", "true");
    expect(isLocalServerRuntimeEnabled()).toBe(true);
  });

  it("never lets the public flag enable server capabilities", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_LOCAL_SERVICES", "true");
    expect(isLocalServerRuntimeEnabled()).toBe(false);
  });

  it("supports the public mirror for client-side UI gates", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_LOCAL_SERVICES", "true");
    expect(isLocalClientRuntimeEnabled()).toBe(true);
  });

  it("allows an explicit client opt-out to win over development defaults", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_LOCAL_SERVICES", "false");
    expect(isLocalClientRuntimeEnabled()).toBe(false);
  });
});
