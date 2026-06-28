import { describe, expect, it } from "vitest";
import {
  IMAGE_REMOTE_HOSTNAMES,
  IMAGE_REMOTE_PATTERNS,
  isAllowedRemoteImageUrl,
} from "@/lib/image-allowlist";

describe("image allowlist helper", () => {
  it("locks the remote patterns to the Google OAuth avatar host over HTTPS with any path", () => {
    expect(IMAGE_REMOTE_PATTERNS).toEqual([
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ]);
    expect(IMAGE_REMOTE_HOSTNAMES).toEqual(["lh3.googleusercontent.com"]);
  });

  describe("isAllowedRemoteImageUrl", () => {
    it("accepts the exact avatar URL that triggered the original Next.js error", () => {
      const sampleUrl =
        "https://lh3.googleusercontent.com/a/ACg8ocLsEbzyNzM1-YuDZIrGhQg1WkiKCO9t61AV1a4fGOxW6nDDyAw=s96-c";

      expect(isAllowedRemoteImageUrl(sampleUrl)).toBe(true);
    });

    it("accepts any path under the Google user-content host", () => {
      expect(
        isAllowedRemoteImageUrl("https://lh3.googleusercontent.com/photo.jpg"),
      ).toBe(true);
      expect(
        isAllowedRemoteImageUrl(
          "https://lh3.googleusercontent.com/a/very/deep/path.png?x=1",
        ),
      ).toBe(true);
    });

    it("locks the /** glob semantics for the root pattern (bare host, root, and nested paths)", () => {
      expect(isAllowedRemoteImageUrl("https://lh3.googleusercontent.com")).toBe(true);
      expect(isAllowedRemoteImageUrl("https://lh3.googleusercontent.com/")).toBe(true);
      expect(isAllowedRemoteImageUrl("https://lh3.googleusercontent.com/a/b/c")).toBe(true);
    });

    it("rejects unlisted Google user-content hosts (sibling buckets are not in scope)", () => {
      expect(isAllowedRemoteImageUrl("https://lh4.googleusercontent.com/photo")).toBe(false);
      expect(isAllowedRemoteImageUrl("https://lh5.googleusercontent.com/photo")).toBe(false);
      expect(isAllowedRemoteImageUrl("https://lh6.googleusercontent.com/photo")).toBe(false);
    });

    it("rejects unrelated external hosts", () => {
      expect(isAllowedRemoteImageUrl("https://example.com/photo.png")).toBe(false);
      expect(isAllowedRemoteImageUrl("https://cdn.mycpresupuestos.pe/logo.png")).toBe(false);
    });

    it("rejects non-http(s) protocols", () => {
      expect(isAllowedRemoteImageUrl("ftp://lh3.googleusercontent.com/photo")).toBe(false);
      expect(isAllowedRemoteImageUrl("javascript:alert(1)")).toBe(false);
      expect(isAllowedRemoteImageUrl("file:///etc/passwd")).toBe(false);
    });

    it("rejects malformed URLs", () => {
      expect(isAllowedRemoteImageUrl("not-a-url")).toBe(false);
      expect(isAllowedRemoteImageUrl("")).toBe(false);
    });
  });
});
