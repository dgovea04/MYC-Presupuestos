/* @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceAuditPanel } from "@/components/settings/workspace-audit-panel";

vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: { children: unknown } & Record<string, unknown>) => createElement("button", props, children) }));
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: unknown }) => createElement("section", null, children),
  CardHeader: ({ children }: { children: unknown }) => createElement("header", null, children),
  CardContent: ({ children }: { children: unknown }) => createElement("div", null, children),
  CardTitle: ({ children }: { children: unknown }) => createElement("h2", null, children),
  CardDescription: ({ children }: { children: unknown }) => createElement("p", null, children),
}));
vi.mock("lucide-react", () => ({ Loader2: () => createElement("span"), RefreshCw: () => createElement("span") }));

describe("WorkspaceAuditPanel", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.restoreAllMocks();
  });

  it("loads and renders administrative events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nextCursor: null, events: [{ id: "event-1", action: "MEMBER_INVITED", targetType: "MEMBER", targetId: "user-2", targetLabel: "Ana", metadata: {}, createdAt: "2026-08-21T10:00:00.000Z", actorUser: { id: "user-1", name: "Owner", email: "owner@test.com" } }] }) }));
    await act(async () => { root.render(createElement(WorkspaceAuditPanel, { workspaceId: "ws-1" })); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(container.textContent).toContain("Invitó a un miembro");
    expect(container.textContent).toContain("Owner");
    expect(container.textContent).toContain("Ana");
  });

  it("renders an actionable error state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Sin permisos" }) }));
    await act(async () => { root.render(createElement(WorkspaceAuditPanel, { workspaceId: "ws-1" })); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(container.textContent).toContain("Sin permisos");
    expect(container.textContent).toContain("Reintentar");
  });
});
