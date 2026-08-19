import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
  getEffectiveWorkspaceLicense: vi.fn(),
  hasFeatureAccess: vi.fn(),
  getCatalogPartidas: vi.fn(),
  getResourcesByUser: vi.fn(),
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: (props: { children: ReactNode }) => mocks.AppShell(props),
}));

vi.mock("@/components/billing/upgrade-cta", () => ({
  UpgradeCTA: ({ title }: { title: string }) => <div data-testid="upgrade-cta">{title}</div>,
}));

vi.mock("@/components/partidas/partida-similarity-generator-page-content", () => ({
  PartidaSimilarityGeneratorPageContent: () => <div data-testid="partida-generator-content" />,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div data-testid="card-header">{children}</div>,
}));

vi.mock("@/components/ui/page-header-card", () => ({
  PageHeaderCard: ({ title }: { title: string }) => <div data-testid="page-header-card">{title}</div>,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/partidas", () => ({
  getCatalogPartidas: mocks.getCatalogPartidas,
}));

vi.mock("@/lib/data/resources", () => ({
  getResourcesByUser: mocks.getResourcesByUser,
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  getActiveWorkspaceId: mocks.getActiveWorkspaceId,
}));

vi.mock("@/lib/workspace/entitlements", () => ({
  getEffectiveWorkspaceLicense: mocks.getEffectiveWorkspaceLicense,
  hasFeatureAccess: mocks.hasFeatureAccess,
}));

vi.mock("@/lib/db/serializers", () => ({
  decimalToNumber: (v: unknown) => Number(v),
}));

import GeneratePartidaPage from "@/app/partidas/generar/page";

describe("GeneratePartidaPage", () => {
  const defaultPartidas = [
    { id: "p-1", code: "01.01", name: "Concreto", unit: "m3" },
  ];
  const defaultResources = [
    {
      id: "r-1",
      companyId: "ws-1",
      code: "M-001",
      description: "Cemento",
      category: "MATERIAL",
      iu: null,
      iuCurrent: null,
      subcategory: null,
      unit: "bolsa",
      unitPrice: 25,
      currency: "PEN",
      source: "CATALOG",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getAuthSession.mockResolvedValue({
      user: { id: "user-1", email: "test@test.com" },
    });
    mocks.getActiveWorkspaceId.mockResolvedValue("ws-1");
    mocks.getEffectiveWorkspaceLicense.mockResolvedValue({
      planSlug: "starter",
      planName: "Starter",
      role: "OWNER",
      availableFeatures: ["partidas.similarity", "exports.basic"],
    });
    mocks.hasFeatureAccess.mockImplementation(
      (_license: unknown, feature: string) => feature === "partidas.similarity",
    );
    mocks.getCatalogPartidas.mockResolvedValue(defaultPartidas);
    mocks.getResourcesByUser.mockResolvedValue(defaultResources);
  });

  it("redirects to login when no session", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    await expect(
      GeneratePartidaPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });

  it("renders UpgradeCTA when license lacks partidas.similarity", async () => {
    mocks.hasFeatureAccess.mockReturnValue(false);

    const tree = await GeneratePartidaPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"upgrade-cta\"");
    expect(markup).toContain("Generador de partidas disponible en Pro");
    expect(markup).not.toContain("data-testid=\"partida-generator-content\"");
  });

  it("renders PartidaSimilarityGeneratorPageContent when feature is available", async () => {
    const tree = await GeneratePartidaPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"partida-generator-content\"");
    expect(markup).not.toContain("data-testid=\"upgrade-cta\"");
  });

  it("calls getActiveWorkspaceId and getEffectiveWorkspaceLicense", async () => {
    await GeneratePartidaPage({ searchParams: Promise.resolve({}) });

    expect(mocks.getActiveWorkspaceId).toHaveBeenCalledWith("user-1");
    expect(mocks.getEffectiveWorkspaceLicense).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "ws-1",
    });
    expect(mocks.hasFeatureAccess).toHaveBeenCalledWith(
      expect.objectContaining({ planSlug: "starter" }),
      "partidas.similarity",
    );
  });

  it("fetches resources with the activeWorkspaceId", async () => {
    await GeneratePartidaPage({ searchParams: Promise.resolve({}) });

    expect(mocks.getResourcesByUser).toHaveBeenCalledWith("user-1", "ws-1");
  });

  it("renders UpgradeCTA when workspace is null", async () => {
    mocks.getActiveWorkspaceId.mockResolvedValue(null);
    mocks.getEffectiveWorkspaceLicense.mockResolvedValue(null);
    mocks.hasFeatureAccess.mockReturnValue(false);

    const tree = await GeneratePartidaPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"upgrade-cta\"");
  });
});
