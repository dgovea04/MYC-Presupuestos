import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";
import {
  IMAGE_REMOTE_HOSTNAMES,
  IMAGE_REMOTE_PATTERNS,
} from "@/lib/image-allowlist";

describe("next.config image allowlist", () => {
  it("mirrors the centralized remote allowlist helper verbatim", () => {
    expect(nextConfig.images?.remotePatterns).toEqual(
      IMAGE_REMOTE_PATTERNS.map((pattern) => ({ ...pattern })),
    );
    expect(nextConfig.images?.remotePatterns?.map((p) => p.hostname)).toEqual([
      ...IMAGE_REMOTE_HOSTNAMES,
    ]);
  });

  it("preserves the default catch-all local pattern with an empty search", () => {
    const localPatterns = nextConfig.images?.localPatterns ?? [];

    expect(localPatterns).toContainEqual({
      pathname: "/**",
      search: "",
    });
  });

  it("preserves the versioned MYC brand logo patterns", () => {
    const localPatterns = nextConfig.images?.localPatterns ?? [];

    expect(localPatterns).toContainEqual({
      pathname: "/myc-logo-tr-300px-v1.png",
      search: "?v=20260529b",
    });
    expect(localPatterns).toContainEqual({
      pathname: "/myc-logo-tr-mini.svg",
      search: "?v=20260529b",
    });
    expect(localPatterns).toContainEqual({
      pathname: "/myc-logo-white-tr-300px-v1.png",
      search: "?v=20260529b",
    });
  });

  it("uses avif and webp as the optimized image formats next to the allowlist", () => {
    expect(nextConfig.images?.formats).toEqual(["image/avif", "image/webp"]);
  });
});

describe("next config server file tracing", () => {
  it("includes the onboarding demo project asset in production server functions", () => {
    expect(nextConfig.outputFileTracingIncludes).toMatchObject({
      "/api/register": ["./data-for-seed/demo-projects/edificio-multifamiliar-demo.mcp"],
      "/api/auth/**": ["./data-for-seed/demo-projects/edificio-multifamiliar-demo.mcp"],
    });
  });
});
