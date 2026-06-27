/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/dashboard";
const mockSignOut = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) => {
    void prefetch;

    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    priority,
    src,
    ...props
  }: React.ImgHTMLAttributes<HTMLSpanElement> & { priority?: boolean; src: string }) => {
    void priority;

    return <span aria-label={alt} data-next-image={src} {...props} />;
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ prefetch: vi.fn() }),
}));

vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

import { AppSidebarClient } from "@/components/layout/app-sidebar-client";

type MockMediaQueryList = {
  addEventListener: ReturnType<typeof vi.fn>;
  dispatchChange: (matches: boolean) => void;
  matches: boolean;
  removeEventListener: ReturnType<typeof vi.fn>;
};

function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList: MockMediaQueryList = {
    addEventListener: vi.fn((eventName: string, listener: (event: MediaQueryListEvent) => void) => {
      if (eventName === "change") {
        listeners.add(listener);
      }
    }),
    matches: initialMatches,
    dispatchChange(matches: boolean) {
      mediaQueryList.matches = matches;
      const event = { matches, media: "(min-width: 1536px)" } as MediaQueryListEvent;

      listeners.forEach((listener) => listener(event));
    },
    removeEventListener: vi.fn((eventName: string, listener: (event: MediaQueryListEvent) => void) => {
      if (eventName === "change") {
        listeners.delete(listener);
      }
    }),
  };

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return query === "(min-width: 1536px)" ? mediaQueryList.matches : false;
      },
      media: query,
      onchange: null,
      addEventListener: mediaQueryList.addEventListener,
      removeEventListener: mediaQueryList.removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  return mediaQueryList;
}

describe("AppSidebarClient", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    mockPathname = "/dashboard";
    mockSignOut.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders expanded by default on regular desktop with branding, active link, and full user details", async () => {
    mockMatchMedia(false);
    mockPathname = "/budgets";

    await act(async () => {
      root.render(<AppSidebarClient userAvatarUrl="/uploads/avatars/maria.png" userEmail="maria@example.com" userName="Maria Lopez" />);
    });

    const sidebar = container.querySelector("[data-sidebar-mode]");
    const activeLink = container.querySelector('a[aria-current="page"]');
    const toggle = container.querySelector('button[aria-label="Contraer sidebar"]');
    const signOut = [...container.querySelectorAll("button")].find((element) => element.textContent?.includes("Cerrar sesion"));
    const navigationHrefs = [...container.querySelectorAll("a")].map((element) => element.getAttribute("href"));

    expect(sidebar?.getAttribute("data-sidebar-mode")).toBe("expanded");
    expect(container.textContent).toContain("Costos y presupuestos de obra");
    expect(activeLink?.getAttribute("href")).toBe("/budgets");
    expect(navigationHrefs).toEqual([
      "/dashboard",
      "/projects",
      "/budgets",
      "/metrados-avanzados",
      "/imports/s10",
      "/imports/rw7",
      "/imports/delphin",
      "/ai",
      "/resources",
      "/partidas",
      "/partidas/generar",
      "/templates",
      "/unified-indices",
      "/unified-index-dictionary",
      "/settings",
      "/account",
    ]);
    expect(container.textContent).toContain("Khipu");
    expect(container.textContent).toContain("Maria Lopez");
    expect(container.textContent).toContain("maria@example.com");
    expect(container.textContent).toContain("Mi perfil");
    expect(container.querySelector('[data-next-image="/uploads/avatars/maria.png"]')).not.toBeNull();
    expect(toggle?.getAttribute("aria-controls")).toBe("app-sidebar-navigation");
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(toggle).not.toBeNull();
    expect(signOut?.getAttribute("aria-label")).toBeNull();
    expect(signOut?.querySelector(".ml-2")?.textContent).toBe("Cerrar sesion");
  });

  it("initializes mini mode on full-width desktop and supports in-memory toggling with accessible sign-out", async () => {
    mockMatchMedia(true);
    mockPathname = "/projects";

    await act(async () => {
      root.render(<AppSidebarClient userEmail="maria@example.com" userName="Maria Lopez" />);
    });

    const sidebar = container.querySelector("[data-sidebar-mode]");
    const initialToggle = container.querySelector('button[aria-label="Expandir sidebar"]');
    const initialSignOut = container.querySelector('button[aria-label="Cerrar sesion"]');
    const projectsLink = container.querySelector('a[href="/projects"]');

    expect(sidebar?.getAttribute("data-sidebar-mode")).toBe("mini");
    expect(initialToggle?.getAttribute("aria-controls")).toBe("app-sidebar-navigation");
    expect(initialToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(initialToggle).not.toBeNull();
    expect(initialSignOut?.querySelector(".sr-only")?.textContent).toBe("Cerrar sesion");
    expect(initialSignOut?.querySelector(".ml-2")).toBeNull();
    expect(projectsLink?.getAttribute("title")).toBe("Proyectos");

    await act(async () => {
      initialToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const updatedSidebar = container.querySelector("[data-sidebar-mode]");
    const updatedToggle = container.querySelector('button[aria-label="Contraer sidebar"]');
    const updatedSignOut = [...container.querySelectorAll("button")].find((element) => element.textContent?.includes("Cerrar sesion"));

    expect(updatedSidebar?.getAttribute("data-sidebar-mode")).toBe("expanded");
    expect(updatedToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(updatedToggle).not.toBeNull();
    expect(updatedSignOut?.getAttribute("aria-label")).toBeNull();
    expect(updatedSignOut?.querySelector(".ml-2")?.textContent).toBe("Cerrar sesion");
  });

  it("hydrates the server markup without mismatch and lands in mini mode on full-width desktop", async () => {
    const mediaQueryList = mockMatchMedia(true);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const hydrationContainer = document.createElement("div");
    const serverMarkup = renderToString(<AppSidebarClient userEmail="maria@example.com" userName="Maria Lopez" />);
    let hydratedRoot: ReturnType<typeof hydrateRoot> | null = null;

    document.body.appendChild(hydrationContainer);
    hydrationContainer.innerHTML = serverMarkup;

    await act(async () => {
      hydratedRoot = hydrateRoot(
        hydrationContainer,
        <AppSidebarClient userEmail="maria@example.com" userName="Maria Lopez" />,
      );
    });

    expect(hydrationContainer.querySelector("[data-sidebar-mode]")?.getAttribute("data-sidebar-mode")).toBe("mini");
    expect(mediaQueryList.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    await act(async () => {
      hydratedRoot?.unmount();
    });

    hydrationContainer.remove();
  });

  it("persists the manual sidebar mode after toggling", async () => {
    mockMatchMedia(true);

    await act(async () => {
      root.render(<AppSidebarClient userEmail="maria@example.com" userName="Maria Lopez" />);
    });

    const toggle = container.querySelector('button[aria-label="Expandir sidebar"]');

    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.localStorage.getItem("myc:sidebar-mode")).toBe("expanded");
    expect(document.cookie).toContain("myc_sidebar_mode=expanded");
    expect(container.querySelector("[data-sidebar-mode]")?.getAttribute("data-sidebar-mode")).toBe("expanded");
  });

  it("shows the administration link only for admin users", async () => {
    mockMatchMedia(false);

    await act(async () => {
      root.render(<AppSidebarClient userEmail="admin@example.com" userName="Admin MYC" userRole="ADMIN" />);
    });

    expect(container.querySelector('a[href="/admin"]')).not.toBeNull();

    await act(async () => {
      root.render(<AppSidebarClient userEmail="user@example.com" userName="Usuario MYC" userRole="USER" />);
    });

    expect(container.querySelector('a[href="/admin"]')).toBeNull();
  });

  it("respects a stored manual preference even on full-width desktop", async () => {
    mockMatchMedia(true);
    window.localStorage.setItem("myc:sidebar-mode", "expanded");

    await act(async () => {
      root.render(<AppSidebarClient userEmail="maria@example.com" userName="Maria Lopez" />);
    });

    const sidebar = container.querySelector("[data-sidebar-mode]");
    const toggle = container.querySelector('button[aria-label="Contraer sidebar"]');

    expect(sidebar?.getAttribute("data-sidebar-mode")).toBe("expanded");
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
  });

  it("uses the persisted initial mode snapshot during hydration", async () => {
    mockMatchMedia(false);
    const hydrationContainer = document.createElement("div");
    const serverMarkup = renderToString(<AppSidebarClient initialMode="mini" userEmail="maria@example.com" userName="Maria Lopez" />);
    let hydratedRoot: ReturnType<typeof hydrateRoot> | null = null;

    document.body.appendChild(hydrationContainer);
    hydrationContainer.innerHTML = serverMarkup;

    await act(async () => {
      hydratedRoot = hydrateRoot(
        hydrationContainer,
        <AppSidebarClient initialMode="mini" userEmail="maria@example.com" userName="Maria Lopez" />,
      );
    });

    expect(hydrationContainer.querySelector("[data-sidebar-mode]")?.getAttribute("data-sidebar-mode")).toBe("mini");

    await act(async () => {
      hydratedRoot?.unmount();
    });

    hydrationContainer.remove();
  });

  it("resynchronizes the sidebar mode when the viewport changes and there is no stored preference", async () => {
    const mediaQueryList = mockMatchMedia(false);

    await act(async () => {
      root.render(<AppSidebarClient userEmail="maria@example.com" userName="Maria Lopez" />);
    });

    expect(container.querySelector("[data-sidebar-mode]")?.getAttribute("data-sidebar-mode")).toBe("expanded");

    await act(async () => {
      mediaQueryList.dispatchChange(true);
    });

    expect(container.querySelector("[data-sidebar-mode]")?.getAttribute("data-sidebar-mode")).toBe("mini");

    await act(async () => {
      mediaQueryList.dispatchChange(false);
    });

    expect(container.querySelector("[data-sidebar-mode]")?.getAttribute("data-sidebar-mode")).toBe("expanded");
  });

  it("removes the viewport listener on unmount", async () => {
    const mediaQueryList = mockMatchMedia(false);

    await act(async () => {
      root.render(<AppSidebarClient userEmail="maria@example.com" userName="Maria Lopez" />);
    });

    await act(async () => {
      root.unmount();
    });

    expect(mediaQueryList.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(mediaQueryList.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("renders an expanded account card with initials, email, and active badge", async () => {
    mockMatchMedia(false);

    await act(async () => {
      root.render(<AppSidebarClient userEmail="ada@example.com" userName="Ada Lovelace" />);
    });

    const initials = [...container.querySelectorAll("div")].find((element) => element.textContent?.trim() === "AL");
    const signOut = [...container.querySelectorAll("button")].find((element) => element.textContent?.includes("Cerrar sesion"));

    expect(container.textContent).toContain("Ada Lovelace");
    expect(container.textContent).toContain("ada@example.com");
    expect(container.textContent).toContain("Cuenta activa");
    expect(container.querySelector('a[href="/account"]')).not.toBeNull();
    expect(initials).not.toBeUndefined();
    expect(signOut?.querySelector(".ml-2")?.textContent).toBe("Cerrar sesion");
  });
});
