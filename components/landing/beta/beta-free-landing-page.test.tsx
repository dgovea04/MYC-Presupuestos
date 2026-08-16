/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BetaFreeLandingPage } from "@/components/landing/beta/beta-free-landing-page";

const mocks = vi.hoisted(() => ({
  captureUtmAttribution: vi.fn(),
  getAttributionEventParams: vi.fn(() => ({ utm_source: "test" })),
  trackClientEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/utm", () => ({
  captureUtmAttribution: mocks.captureUtmAttribution,
  getAttributionEventParams: mocks.getAttributionEventParams,
}));
vi.mock("@/lib/analytics/client", () => ({ trackClientEvent: mocks.trackClientEvent }));
vi.mock("@/components/landing/landing-logo", () => ({
  LandingLogo: () => <span>MC Presupuestos</span>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  mocks.captureUtmAttribution.mockReset();
  mocks.getAttributionEventParams.mockReset();
  mocks.trackClientEvent.mockReset();
});

describe("BetaFreeLandingPage", () => {
  it("renders a dedicated free Pro beta conversion path", () => {
    render(<BetaFreeLandingPage />);

    expect(screen.getByRole("heading", { level: 1, name: /Pro gratis durante 60 días/i })).toBeTruthy();
    expect(screen.getByText("Pro gratis para primeros usuarios en Perú")).toBeTruthy();
    expect(screen.getByText("Empieza sin complicar tu operación.")).toBeTruthy();
    expect(screen.getByText("Prueba tu próximo presupuesto con una base más clara.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Pro gratis 60 días" }).getAttribute("href")).toBe("#solicitar");
    expect(screen.getByRole("button", { name: "Solicitar mi acceso gratuito" })).toBeTruthy();
  });

  it("submits the beta form with the dedicated landing attribution", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<BetaFreeLandingPage />);

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Usuario Beta" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "beta@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar mi acceso gratuito" }));

    await waitFor(() => expect(screen.getByText(/Recibimos tu solicitud/i)).toBeTruthy());

    expect(fetchMock).toHaveBeenCalledWith("/api/beta/applications", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"landing_variant":"beta-free-v1"'),
    }));
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"cta_location":"beta_free_form"');
  });
});
