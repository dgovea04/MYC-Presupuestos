import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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
});
