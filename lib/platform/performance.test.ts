import { afterEach, describe, expect, it, vi } from "vitest";

import { measureAsync, shouldLogPerformance } from "@/lib/platform/performance";

describe("performance helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("keeps performance logging disabled by default", () => {
    vi.stubEnv("MYC_PERF_LOGS", "");

    expect(shouldLogPerformance()).toBe(false);
  });

  it("logs timings when MYC_PERF_LOGS is enabled", async () => {
    vi.stubEnv("MYC_PERF_LOGS", "1");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(measureAsync("test.operation", async () => "ok", { workspace: "ws-1" })).resolves.toBe("ok");

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0]?.[0]).toContain("[perf] test.operation");
    expect(infoSpy.mock.calls[0]?.[0]).toContain("\"workspace\":\"ws-1\"");
  });

  it("still logs elapsed time when the operation fails", async () => {
    vi.stubEnv("MYC_PERF_LOGS", "true");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(measureAsync("test.failure", async () => {
      throw new Error("boom");
    })).rejects.toThrow("boom");

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0]?.[0]).toContain("[perf] test.failure");
  });
});
