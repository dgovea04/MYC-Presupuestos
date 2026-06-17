import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const globalAiAssistantProviderSpy = vi.fn();

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-inter" }),
  Plus_Jakarta_Sans: () => ({ variable: "font-plus-jakarta-sans" }),
}));

vi.mock("next/script", () => ({
  default: ({ children, id }: { children?: React.ReactNode; id?: string }) => <script id={id}>{children}</script>,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/components/ai/global-ai-assistant-provider", () => ({
  GlobalAiAssistantProvider: ({ children }: { children: ReactNode }) => {
    globalAiAssistantProviderSpy(children);
    return <div data-global-ai-provider="true">{children}</div>;
  },
}));

import { cookies } from "next/headers";
import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("renders the mini sidebar width on the initial html when the cookie is persisted", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn((name: string) => (name === "myc_sidebar_mode" ? { value: "mini" } : undefined)),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const markup = renderToStaticMarkup(
      await RootLayout({
        children: <div>Contenido</div>,
      }),
    );

    expect(markup).toContain('--app-sidebar-initial-width:80px');
  });

  it("mounts the global AI assistant provider around layout children", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn(() => undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

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
});
