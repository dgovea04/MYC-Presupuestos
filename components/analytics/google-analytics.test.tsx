/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { ANALYTICS_CONSENT_COOKIE } from "@/lib/analytics/consent";

vi.mock("next/script", () => ({ default: () => null }));

const MEASUREMENT_ID = "G-TEST123";

function setConsentCookie(value: "granted" | "denied") {
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=${value}; Path=/`;
}

afterEach(() => {
  cleanup();
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`;
  vi.unstubAllGlobals();
});

describe("GoogleAnalytics consent banner", () => {
  it("shows the banner for first-time authenticated visitors", () => {
    render(<GoogleAnalytics measurementId={MEASUREMENT_ID} isAuthenticated />);

    expect(screen.getByRole("dialog", { name: "Preferencias de analytics" })).toBeTruthy();
    expect(screen.getByText("Ayúdanos a mejorar MC Presupuestos")).toBeTruthy();
  });

  it("does not show the banner for anonymous visitors", () => {
    render(<GoogleAnalytics measurementId={MEASUREMENT_ID} isAuthenticated={false} />);

    expect(screen.queryByRole("dialog", { name: "Preferencias de analytics" })).toBeNull();
  });

  it("does not show the banner when consent was already granted", () => {
    setConsentCookie("granted");

    render(<GoogleAnalytics measurementId={MEASUREMENT_ID} isAuthenticated />);

    expect(screen.queryByRole("dialog", { name: "Preferencias de analytics" })).toBeNull();
  });

  it("does not show the banner when consent was already denied", () => {
    setConsentCookie("denied");

    render(<GoogleAnalytics measurementId={MEASUREMENT_ID} isAuthenticated />);

    expect(screen.queryByRole("dialog", { name: "Preferencias de analytics" })).toBeNull();
  });

  it("accepting analytics hides the banner, persists the cookie and initializes gtag", () => {
    const gtag = vi.fn();
    vi.stubGlobal("gtag", gtag);
    render(<GoogleAnalytics measurementId={MEASUREMENT_ID} isAuthenticated />);

    fireEvent.click(screen.getByRole("button", { name: "Aceptar analytics" }));

    expect(screen.queryByRole("dialog", { name: "Preferencias de analytics" })).toBeNull();
    expect(document.cookie).toContain(`${ANALYTICS_CONSENT_COOKIE}=granted`);
    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
    });
    expect(gtag).toHaveBeenCalledWith("config", MEASUREMENT_ID, { send_page_view: true });
  });

  it("declining analytics hides the banner and persists the denial", () => {
    render(<GoogleAnalytics measurementId={MEASUREMENT_ID} isAuthenticated />);

    fireEvent.click(screen.getByRole("button", { name: "No gracias" }));

    expect(screen.queryByRole("dialog", { name: "Preferencias de analytics" })).toBeNull();
    expect(document.cookie).toContain(`${ANALYTICS_CONSENT_COOKIE}=denied`);
  });

  it("never includes the banner in server-rendered HTML (no flash on refresh)", () => {
    const html = renderToString(<GoogleAnalytics measurementId={MEASUREMENT_ID} isAuthenticated={false} />);

    expect(html).not.toContain("Ayúdanos a mejorar MC Presupuestos");
  });
});
