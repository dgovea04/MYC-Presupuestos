import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const globalAiAssistantProviderSpy = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined,
  })),
}));

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-inter" }),
  Plus_Jakarta_Sans: () => ({ variable: "font-plus-jakarta-sans" }),
}));

vi.mock("next/script", () => ({
  default: ({ children, id }: { children?: React.ReactNode; id?: string }) => <script id={id}>{children}</script>,
}));

vi.mock("@/components/ai/global-ai-assistant-provider", () => ({
  GlobalAiAssistantProvider: ({ children }: { children: ReactNode }) => {
    globalAiAssistantProviderSpy(children);
    return <div data-global-ai-provider="true">{children}</div>;
  },
}));

import RootLayout from "@/app/layout";
import { cookies } from "next/headers";

describe("RootLayout", () => {
  it("renders the default expanded sidebar width on the initial html", async () => {
    const markup = renderToStaticMarkup(
      await RootLayout({
        children: <div>Contenido</div>,
      }),
    );

    expect(markup).toContain('--app-sidebar-initial-width:280px');
  });

  it("mounts the global AI assistant provider around layout children", async () => {
    globalAiAssistantProviderSpy.mockClear();

    const markup = renderToStaticMarkup(
      await RootLayout({
        children: <div>Contenido</div>,
      }),
    );

    expect(markup).toContain('data-global-ai-provider="true"');
    expect(markup).toContain("Contenido");
    expect(globalAiAssistantProviderSpy).toHaveBeenCalledTimes(1);
  });

  it("renders the stored mini sidebar width on the initial html", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => (name === "myc_sidebar_mode" ? { name, value: "mini" } : undefined),
    } as Awaited<ReturnType<typeof cookies>>);

    const markup = renderToStaticMarkup(
      await RootLayout({
        children: <div>Contenido</div>,
      }),
    );

    expect(markup).toContain('--app-sidebar-initial-width:80px');
  });
});
