# App Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current authenticated left rail with a branded expandable/mini sidebar that defaults to expanded on regular desktop, auto-collapses on very wide layouts, and supports a manual override.

**Architecture:** Keep `components/layout/app-shell.tsx` as the async server container that fetches session and formatting settings. Move sidebar interaction into a dedicated client component that receives only user display data and navigation items, then decompose the sidebar UI into focused layout subcomponents for brand, nav, toggle, and user card.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Tailwind CSS v4, Vitest with `jsdom`, `lucide-react`, existing `next-auth` client sign-out flow

---

## File Map

- `components/layout/app-shell.tsx`
  - Keep session/settings loading on the server and hand off sidebar display props to the new client sidebar.
- `components/layout/app-sidebar-client.tsx`
  - Own sidebar mode state, full-width detection, `localStorage` override, and overall sidebar layout.
- `components/layout/sidebar-brand.tsx`
  - Render logo, branding copy, and the expand/collapse toggle.
- `components/layout/sidebar-nav.tsx`
  - Render nav items in expanded and mini states with active styling and accessible labels.
- `components/layout/sidebar-user-card.tsx`
  - Render expanded and mini account surfaces with initials, metadata, and sign-out access.
- `components/layout/app-sidebar-client.test.tsx`
  - Verify mode behavior, persistence, accessible labels, and full-width defaults.
- `components/auth/sign-out-button.tsx`
  - Add a compact rendering path so the user card can reuse the same sign-out logic in mini mode.

## Task 1: Lock Sidebar Client Behavior With Tests

**Files:**
- Create: `components/layout/app-sidebar-client.test.tsx`
- Test: `components/layout/app-sidebar-client.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
}));

vi.mock("@/components/auth/sign-out-button", () => ({
  SignOutButton: ({ compact = false }: { compact?: boolean }) => (
    <button type="button" data-compact={compact ? "true" : "false"}>
      {compact ? "Salir" : "Cerrar sesión"}
    </button>
  ),
}));

import { AppSidebarClient } from "@/components/layout/app-sidebar-client";
import { FolderKanban, LayoutDashboard } from "lucide-react";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

beforeEach(() => {
  const storage = new Map<string, string>();

  vi.stubGlobal(
    "localStorage",
    {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
    } satisfies Pick<Storage, "getItem" | "setItem" | "removeItem">,
  );
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  if (!activeContainer) return;

  const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;

  if (root) {
    await act(async () => {
      root.unmount();
    });
  }

  activeContainer.remove();
  activeContainer = null;
});

describe("AppSidebarClient", () => {
  it("renders expanded by default on regular desktop widths", async () => {
    stubMatchMedia(false);

    const container = await renderSidebar();
    const aside = container.querySelector("aside");
    const projectsLink = [...container.querySelectorAll("a")].find((node) => node.textContent?.includes("Proyectos"));

    expect(aside?.getAttribute("data-sidebar-mode")).toBe("expanded");
    expect(container.textContent).toContain("Costos y presupuestos de obra");
    expect(projectsLink?.getAttribute("aria-current")).toBe("page");
  });

  it("starts mini on full-width layouts and keeps accessible labels", async () => {
    stubMatchMedia(true);

    const container = await renderSidebar();
    const aside = container.querySelector("aside");
    const projectsLink = [...container.querySelectorAll("a")].find((node) => node.getAttribute("href") === "/projects");

    expect(aside?.getAttribute("data-sidebar-mode")).toBe("mini");
    expect(projectsLink?.getAttribute("title")).toBe("Proyectos");
    expect(container.textContent).toContain("Salir");
  });

  it("lets the user manually expand from mini mode and persists the override", async () => {
    stubMatchMedia(true);

    const container = await renderSidebar();
    const toggle = getButton(container, /expandir sidebar|contraer sidebar/i);

    await act(async () => {
      toggle.click();
    });

    expect(container.querySelector("aside")?.getAttribute("data-sidebar-mode")).toBe("expanded");
    expect(localStorage.setItem).toHaveBeenCalledWith("myc:sidebar-mode", "expanded");
    expect(container.textContent).toContain("Cuenta activa");
  });
});

async function renderSidebar() {
  activeContainer = document.createElement("div");
  document.body.appendChild(activeContainer);

  const root = createRoot(activeContainer);
  (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

  await act(async () => {
    root.render(
      <AppSidebarClient
        user={{ name: "Ada Lovelace", email: "ada@example.com" }}
        links={[
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/projects", label: "Proyectos", icon: FolderKanban },
        ]}
      />,
    );
  });

  return activeContainer;
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function getButton(container: HTMLDivElement, pattern: RegExp) {
  const element = [...container.querySelectorAll("button")].find((candidate) => pattern.test(candidate.getAttribute("aria-label") ?? candidate.textContent ?? ""));

  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Missing button matching ${pattern.source}`);
  }

  return element;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/layout/app-sidebar-client.test.tsx`

Expected: FAIL because `AppSidebarClient` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `components/layout/app-sidebar-client.tsx` with the smallest possible stateful shell that satisfies the tests before styling details:

```tsx
"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { cn } from "@/lib/utils";

type SidebarMode = "expanded" | "mini";

type SidebarLink = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const STORAGE_KEY = "myc:sidebar-mode";
const FULLWIDTH_QUERY = "(min-width: 1536px)";

export function AppSidebarClient({
  user,
  links,
}: {
  user: { name?: string | null; email?: string | null };
  links: SidebarLink[];
}) {
  const pathname = usePathname();
  const [mode, setMode] = useState<SidebarMode>("expanded");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored === "expanded" || stored === "mini") {
      setMode(stored);
      return;
    }

    const mediaQuery = window.matchMedia(FULLWIDTH_QUERY);
    setMode(mediaQuery.matches ? "mini" : "expanded");
  }, []);

  function toggleMode() {
    setMode((current) => {
      const next = current === "expanded" ? "mini" : "expanded";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  const initials = getInitials(user.name);

  return (
    <aside
      data-sidebar-mode={mode}
      className={cn("rounded-3xl border border-white/70 bg-slate-900 text-white shadow-xl shadow-slate-900/10", mode === "mini" ? "p-4" : "p-6")}
    >
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className={cn("min-w-0", mode === "mini" && "sr-only")}>
          <div className="relative h-10 w-[120px]">
            <Image src="/myc-logo-tr-300px-v1.png" alt="MYC Presupuestos" fill sizes="120px" className="object-contain object-left" />
          </div>
          <p className="mt-3 text-sm text-slate-300">Costos y presupuestos de obra</p>
        </div>
        <button
          type="button"
          aria-label={mode === "expanded" ? "Contraer sidebar" : "Expandir sidebar"}
          onClick={toggleMode}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10"
        >
          {mode === "expanded" ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
      </div>

      <nav className="space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              title={mode === "mini" ? link.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center rounded-2xl px-4 py-3 text-sm transition",
                mode === "mini" ? "justify-center" : "gap-3",
                isActive ? "bg-sky-500/15 text-white" : "text-slate-200 hover:bg-white/10",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {mode === "mini" ? <span className="sr-only">{link.label}</span> : <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-2xl bg-white/10 p-4 text-sm text-slate-200">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/15 font-semibold text-sky-100">{initials}</div>
          {mode === "expanded" ? (
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name ?? "Equipo tecnico"}</p>
              <p className="truncate text-slate-300">{user.email}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-sky-300">Cuenta activa</p>
            </div>
          ) : null}
        </div>
        <div className="mt-4">
          <SignOutButton compact={mode === "mini"} />
        </div>
      </div>
    </aside>
  );
}

function getInitials(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const value = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  return value || "MY";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/layout/app-sidebar-client.test.tsx`

Expected: PASS with 3 tests passed in `components/layout/app-sidebar-client.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add components/layout/app-sidebar-client.tsx components/layout/app-sidebar-client.test.tsx
git commit -m "test: lock app sidebar client behavior"
```

## Task 2: Split Brand, Nav, and User Card Into Focused Sidebar Components

**Files:**
- Create: `components/layout/sidebar-brand.tsx`
- Create: `components/layout/sidebar-nav.tsx`
- Create: `components/layout/sidebar-user-card.tsx`
- Modify: `components/layout/app-sidebar-client.tsx`
- Modify: `components/auth/sign-out-button.tsx`
- Test: `components/layout/app-sidebar-client.test.tsx`

- [ ] **Step 1: Extend the failing test for the improved user card and compact sign-out path**

Append to `components/layout/app-sidebar-client.test.tsx`:

```tsx
it("renders an expanded account card with initials, email, and active badge", async () => {
  stubMatchMedia(false);

  const container = await renderSidebar();

  expect(container.textContent).toContain("Ada Lovelace");
  expect(container.textContent).toContain("ada@example.com");
  expect(container.textContent).toContain("Cuenta activa");
  expect(container.querySelector("[data-compact='false']")).toBeTruthy();
});

it("uses the compact sign-out path in mini mode", async () => {
  stubMatchMedia(true);

  const container = await renderSidebar();

  expect(container.querySelector("[data-compact='true']")).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/layout/app-sidebar-client.test.tsx`

Expected: FAIL because `SignOutButton` does not support a `compact` prop and the sidebar is still monolithic.

- [ ] **Step 3: Write minimal implementation**

Create `components/layout/sidebar-brand.tsx`:

```tsx
import Image from "next/image";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SidebarBrand({
  mode,
  onToggle,
}: {
  mode: "expanded" | "mini";
  onToggle: () => void;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("min-w-0", mode === "mini" && "sr-only")}>
          <div className="relative h-11 w-[132px]">
            <Image src="/myc-logo-tr-300px-v1.png" alt="MYC Presupuestos" fill sizes="132px" className="object-contain object-left" />
          </div>
          <p className="mt-3 max-w-[13rem] text-sm leading-6 text-slate-300">Costos y presupuestos de obra</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label={mode === "expanded" ? "Contraer sidebar" : "Expandir sidebar"}
          onClick={onToggle}
          className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 p-0 text-slate-100 hover:bg-white/10 hover:text-white"
        >
          {mode === "expanded" ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
```

Create `components/layout/sidebar-nav.tsx`:

```tsx
import Link from "next/link";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export type SidebarNavLink = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export function SidebarNav({
  mode,
  pathname,
  links,
}: {
  mode: "expanded" | "mini";
  pathname: string;
  links: SidebarNavLink[];
}) {
  return (
    <nav className="space-y-2">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            title={mode === "mini" ? link.label : undefined}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group flex rounded-2xl text-sm transition",
              mode === "mini" ? "justify-center px-3 py-3" : "items-center gap-3 px-4 py-3",
              isActive
                ? "bg-sky-500/15 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]"
                : "text-slate-200 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {mode === "mini" ? <span className="sr-only">{link.label}</span> : <span>{link.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
```

Create `components/layout/sidebar-user-card.tsx`:

```tsx
import { SignOutButton } from "@/components/auth/sign-out-button";

export function SidebarUserCard({
  mode,
  user,
}: {
  mode: "expanded" | "mini";
  user: { name?: string | null; email?: string | null; initials: string };
}) {
  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/15 font-semibold text-sky-100">
          {user.initials}
        </div>
        {mode === "expanded" ? (
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{user.name ?? "Equipo tecnico"}</p>
            <p className="truncate text-slate-300">{user.email}</p>
            <span className="mt-2 inline-flex rounded-full border border-sky-300/20 bg-sky-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">
              Cuenta activa
            </span>
          </div>
        ) : null}
      </div>
      <div className="mt-4">
        <SignOutButton compact={mode === "mini"} />
      </div>
    </div>
  );
}
```

Update `components/auth/sign-out-button.tsx`:

```tsx
"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <Button
      variant="outline"
      size={compact ? "sm" : "sm"}
      aria-label={compact ? "Cerrar sesión" : undefined}
      className={cn(
        "border-white/20 bg-transparent text-white hover:bg-white/10",
        compact ? "w-full justify-center px-0" : "w-full",
      )}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {compact ? <span className="sr-only">Cerrar sesión</span> : <span className="ml-2">Cerrar sesión</span>}
    </Button>
  );
}
```

Update `components/layout/app-sidebar-client.tsx` to delegate:

```tsx
import { useEffect, useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import { SidebarBrand } from "@/components/layout/sidebar-brand";
import { SidebarNav, type SidebarNavLink } from "@/components/layout/sidebar-nav";
import { SidebarUserCard } from "@/components/layout/sidebar-user-card";
import { cn } from "@/lib/utils";

type SidebarMode = "expanded" | "mini";

const STORAGE_KEY = "myc:sidebar-mode";
const FULLWIDTH_QUERY = "(min-width: 1536px)";

export function AppSidebarClient({
  user,
  links,
}: {
  user: { name?: string | null; email?: string | null };
  links: SidebarNavLink[];
}) {
  const pathname = usePathname();
  const [mode, setMode] = useState<SidebarMode>("expanded");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored === "expanded" || stored === "mini") {
      setMode(stored);
      return;
    }

    setMode(window.matchMedia(FULLWIDTH_QUERY).matches ? "mini" : "expanded");
  }, []);

  const initials = getInitials(user.name);

  function handleToggle() {
    setMode((current) => {
      const next = current === "expanded" ? "mini" : "expanded";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  return (
    <aside
      data-sidebar-mode={mode}
      className={cn(
        "rounded-3xl border border-white/70 bg-slate-900 text-white shadow-xl shadow-slate-900/10",
        mode === "mini" ? "p-4" : "p-6",
      )}
    >
      <SidebarBrand mode={mode} onToggle={handleToggle} />
      <SidebarNav mode={mode} pathname={pathname} links={links} />
      <SidebarUserCard mode={mode} user={{ ...user, initials }} />
    </aside>
  );
}

function getInitials(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const value = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  return value || "MY";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/layout/app-sidebar-client.test.tsx`

Expected: PASS with 5 tests passed in `components/layout/app-sidebar-client.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add components/layout/app-sidebar-client.tsx components/layout/sidebar-brand.tsx components/layout/sidebar-nav.tsx components/layout/sidebar-user-card.tsx components/auth/sign-out-button.tsx components/layout/app-sidebar-client.test.tsx
git commit -m "feat: split app sidebar presentation"
```

## Task 3: Wire Automatic Full-Width Defaults and Manual Override Persistence

**Files:**
- Modify: `components/layout/app-sidebar-client.tsx`
- Test: `components/layout/app-sidebar-client.test.tsx`

- [ ] **Step 1: Extend the failing test for stored preference precedence**

Append to `components/layout/app-sidebar-client.test.tsx`:

```tsx
it("prefers a stored manual override over the full-width default", async () => {
  stubMatchMedia(true);
  localStorage.setItem("myc:sidebar-mode", "expanded");

  const container = await renderSidebar();

  expect(container.querySelector("aside")?.getAttribute("data-sidebar-mode")).toBe("expanded");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/layout/app-sidebar-client.test.tsx`

Expected: FAIL if the component recalculates only from media query and does not honor stored values consistently.

- [ ] **Step 3: Write minimal implementation**

Refine `components/layout/app-sidebar-client.tsx` so default resolution is isolated and future-safe:

```tsx
import { useEffect, useMemo, useState } from "react";

type SidebarMode = "expanded" | "mini";

const STORAGE_KEY = "myc:sidebar-mode";
const FULLWIDTH_QUERY = "(min-width: 1536px)";

function resolveStoredMode(storageValue: string | null): SidebarMode | null {
  return storageValue === "expanded" || storageValue === "mini" ? storageValue : null;
}

function resolveViewportDefault() {
  return window.matchMedia(FULLWIDTH_QUERY).matches ? "mini" : "expanded";
}

export function AppSidebarClient({
  user,
  links,
}: {
  user: { name?: string | null; email?: string | null };
  links: SidebarNavLink[];
}) {
  const pathname = usePathname();
  const [mode, setMode] = useState<SidebarMode>("expanded");

  useEffect(() => {
    const stored = resolveStoredMode(window.localStorage.getItem(STORAGE_KEY));
    setMode(stored ?? resolveViewportDefault());
  }, []);

  function handleToggle() {
    setMode((current) => {
      const next = current === "expanded" ? "mini" : "expanded";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  const initials = useMemo(() => getInitials(user.name), [user.name]);

  return (
    <aside
      data-sidebar-mode={mode}
      className={cn(
        "rounded-3xl border border-white/70 bg-slate-900 text-white shadow-xl shadow-slate-900/10 transition-[width,padding] duration-200",
        mode === "mini" ? "p-4 lg:w-[88px]" : "p-6 lg:w-[272px]",
      )}
    >
      <SidebarBrand mode={mode} onToggle={handleToggle} />
      <SidebarNav mode={mode} pathname={pathname} links={links} />
      <SidebarUserCard mode={mode} user={{ ...user, initials }} />
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/layout/app-sidebar-client.test.tsx`

Expected: PASS with 6 tests passed in `components/layout/app-sidebar-client.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add components/layout/app-sidebar-client.tsx components/layout/app-sidebar-client.test.tsx
git commit -m "feat: persist app sidebar mode"
```

## Task 4: Integrate the New Sidebar Into AppShell and Verify Shell Consumers

**Files:**
- Modify: `components/layout/app-shell.tsx`
- Modify: `components/layout/app-sidebar-client.tsx`
- Test: `components/layout/app-sidebar-client.test.tsx`

- [ ] **Step 1: Add a focused integration assertion for the new shell handoff**

Append to `components/layout/app-sidebar-client.test.tsx`:

```tsx
it("keeps the recommended product copy in the brand block", async () => {
  stubMatchMedia(false);

  const container = await renderSidebar();

  expect(container.textContent).toContain("Costos y presupuestos de obra");
  expect(container.textContent).not.toContain("APU para obras en Peru");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/layout/app-sidebar-client.test.tsx`

Expected: FAIL if the old copy still exists anywhere in the sidebar implementation.

- [ ] **Step 3: Write minimal implementation**

Update `components/layout/app-shell.tsx`:

```tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { FileSpreadsheet, FolderKanban, LayoutDashboard, Plus, Rows3, SlidersHorizontal, Wrench } from "lucide-react";
import { getAuthSession } from "@/lib/auth/session";
import { getUserSettings } from "@/lib/data/settings";
import { AppBackButton } from "@/components/layout/app-back-button";
import { AppSidebarClient } from "@/components/layout/app-sidebar-client";
import { LiveDataRefresh } from "@/components/layout/live-data-refresh";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import { Button } from "@/components/ui/button";
import { DEFAULT_DATE_FORMAT, DEFAULT_INITIAL_SUB_BUDGET_NAMES, type UserSettingsRecord } from "@/types/settings";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Proyectos", icon: FolderKanban },
  { href: "/budgets", label: "Presupuestos", icon: FileSpreadsheet },
  { href: "/resources", label: "Catalogo de Insumos", icon: Wrench },
  { href: "/partidas", label: "Catalogo de Partidas", icon: Rows3 },
  { href: "/settings", label: "Configuracion", icon: SlidersHorizontal },
] as const;

export async function AppShell({
  children,
  settings: initialSettings,
}: {
  children: ReactNode;
  settings?: UserSettingsRecord;
}) {
  const session = await getAuthSession();
  const fallbackSettings: UserSettingsRecord = {
    defaultCurrency: "PEN",
    currencyDecimals: 2,
    dateFormat: DEFAULT_DATE_FORMAT,
    defaultIgvRate: 0.18,
    defaultGeneralExpensesRate: 0.1,
    defaultUtilityRate: 0.08,
    defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
  };
  const settings = initialSettings ?? (session?.user?.id ? await getUserSettings(session.user.id) : fallbackSettings);

  return (
    <FormattingSettingsProvider settings={settings}>
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4f8_40%,#f8fafc_100%)]">
        <div className="grid min-h-screen grid-cols-1 gap-5 px-3 py-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:px-4 xl:px-5">
          <AppSidebarClient
            user={{
              name: session?.user?.name,
              email: session?.user?.email,
            }}
            links={[...links]}
          />

          <main className="flex min-h-full min-w-0 flex-col gap-5">
            <LiveDataRefresh />
            <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 px-6 py-5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2">
                <AppBackButton />
                <div>
                  <p className="text-sm text-slate-500">MVP inicial</p>
                  <h2 className="text-2xl font-semibold text-slate-900">Gestion de presupuestos de obra</h2>
                </div>
              </div>

              <Link href="/projects/new">
                <Button className="gap-2 shadow-sm shadow-sky-950/10">
                  <Plus className="h-4 w-4" />
                  Nuevo proyecto
                </Button>
              </Link>
            </header>

            {children}
          </main>
        </div>
      </div>
    </FormattingSettingsProvider>
  );
}
```

- [ ] **Step 4: Run the verification suite**

Run: `npm run test -- components/layout/app-sidebar-client.test.tsx`
Expected: PASS with 7 tests passed in `components/layout/app-sidebar-client.test.tsx`

Run: `npm run lint`
Expected: PASS with no new ESLint errors in `components/layout/*` or `components/auth/sign-out-button.tsx`

- [ ] **Step 5: Commit**

```bash
git add components/layout/app-shell.tsx components/layout/app-sidebar-client.tsx components/layout/app-sidebar-client.test.tsx
git commit -m "feat: integrate responsive app sidebar"
```

## Self-Review

### Spec coverage

- Branding with logo and new copy: covered by Tasks 1, 2, and 4
- Expanded and mini nav behavior: covered by Tasks 1 and 2
- Improved user section: covered by Task 2
- Manual toggle: covered by Tasks 1 and 2
- Full-width auto-collapse: covered by Tasks 1 and 3
- `localStorage` override handling: covered by Task 3
- AppShell server/client boundary: covered by Task 4

No spec requirement is left without a task.

### Placeholder scan

- No `TODO`, `TBD`, or deferred implementation notes remain.
- Each task includes concrete file paths, test code, implementation code, commands, and expected results.
- Verification commands use the actual repo scripts: `npm run test` and `npm run lint`.

### Type consistency

- Sidebar mode is consistently named `SidebarMode` with values `"expanded"` and `"mini"`.
- The shared nav type is consistently named `SidebarNavLink`.
- The persisted preference key is consistently named `myc:sidebar-mode`.

