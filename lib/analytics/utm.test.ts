import { describe, expect, it } from "vitest";
import { captureRegistrationContext, mergeAttribution, parseRegistrationContextCookie, parseUtmParams } from "@/lib/analytics/utm";

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

  it("parses and sanitizes the registration context used by signup attribution", () => {
    const raw = encodeURIComponent(JSON.stringify({
      landing_path: "/software-presupuestos-construccion",
      landing_variant: "acquisition-v1",
      cta_location: "acquisition_hero",
      ignored: "secret",
    }));

    expect(parseRegistrationContextCookie(raw)).toEqual({
      landing_path: "/software-presupuestos-construccion",
      landing_variant: "acquisition-v1",
      cta_location: "acquisition_hero",
    });
  });

  it("does not write registration context during server rendering", () => {
    expect(() => captureRegistrationContext({ landing_path: "/register" })).not.toThrow();
  });
});
