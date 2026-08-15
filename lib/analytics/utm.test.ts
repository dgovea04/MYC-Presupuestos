import { describe, expect, it } from "vitest";
import { mergeAttribution, parseUtmParams } from "@/lib/analytics/utm";

describe("analytics UTM attribution", () => {
  it("parses the supported UTM parameters and ignores unrelated query params", () => {
    const params = new URLSearchParams(
      "utm_source=google&utm_medium=cpc&utm_campaign=obra-2026&utm_content=video-1&foo=bar",
    );

    expect(parseUtmParams(params)).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "obra-2026",
      utm_content: "video-1",
    });
  });

  it("sanitizes control characters and truncates long values", () => {
    const params = new URLSearchParams(`utm_source=%00google%09${"x".repeat(200)}`);
    const result = parseUtmParams(params);

    expect(result.utm_source).toHaveLength(160);
    expect(result.utm_source).not.toContain("\u0000");
    expect(result.utm_source).not.toContain("\t");
  });

  it("preserves first-touch while updating last-touch attribution", () => {
    const first = mergeAttribution(null, {
      utm_source: "google",
      utm_medium: "cpc",
    });
    const second = mergeAttribution(first, {
      utm_source: "linkedin",
      utm_medium: "social",
      utm_campaign: "founding-users",
    });

    expect(second).toEqual({
      firstTouch: {
        utm_source: "google",
        utm_medium: "cpc",
      },
      lastTouch: {
        utm_source: "linkedin",
        utm_medium: "social",
        utm_campaign: "founding-users",
      },
    });
  });

  it("does not create attribution from a URL without UTMs", () => {
    expect(mergeAttribution(null, {})).toBeNull();
  });
});
