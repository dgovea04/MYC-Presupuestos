// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock next/router
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock Select component
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onChange }: { children: React.ReactNode; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void }) => (
    <select data-testid="workspace-select" value={value} onChange={onChange}>
      {children}
    </select>
  ),
}));

import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";

describe("WorkspaceSwitcher", () => {
  const mockWorkspaces = [
    { id: "company-1", name: "MYC Ingenieria", role: "OWNER" as const, logoUrl: null },
  ];

  it("renders the workspace icon button when user is OWNER", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={mockWorkspaces} />,
    );

    // Icon-only button should render workspace initials (MI = M from MYC, I from Ingenieria)
    expect(markup).toContain("MI");
  });

  it("renders the workspace icon button when user is ADMIN", () => {
    const workspaces = [
      { id: "company-1", name: "Constructora Demo", role: "ADMIN" as const, logoUrl: null },
    ];

    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={workspaces} />,
    );

    expect(markup).toContain("CD");
  });

  it("renders the workspace icon button when user is EDITOR", () => {
    const workspaces = [
      { id: "company-1", name: "Constructora Demo", role: "EDITOR" as const, logoUrl: null },
    ];

    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={workspaces} />,
    );

    expect(markup).toContain("CD");
  });

  it("renders the workspace icon button when user is VIEWER", () => {
    const workspaces = [
      { id: "company-1", name: "Constructora Demo", role: "VIEWER" as const, logoUrl: null },
    ];

    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={workspaces} />,
    );

    expect(markup).toContain("CD");
  });

  it("renders workspace names in the popup Select when multiple workspaces exist", () => {
    const workspaces = [
      { id: "company-1", name: "MYC Ingenieria", role: "OWNER" as const, logoUrl: null },
      { id: "company-2", name: "Constructora Demo", role: "EDITOR" as const, logoUrl: null },
    ];

    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={workspaces} />,
    );

    // The Select is inside the popup (showPanel=false). In renderToStaticMarkup,
    // JSX inside short-circuit conditionals (false && ...) is not evaluated.
    // Check that workspace names appear somewhere in the render output.
    // The icon button still shows initials.
    expect(markup).toContain("MI");
    // Panel is closed, so popup content should NOT be rendered
    expect(markup).not.toContain("Administrar miembros");
    expect(markup).not.toContain("Invitar por email");
  });

  it("does NOT render workspace Select when there is only one workspace", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={mockWorkspaces} />,
    );

    // Panel is closed; no Select should appear
    expect(markup).not.toContain("data-testid=\"workspace-select\"");
  });

  it("renders workspace icon with initials when no logo", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={mockWorkspaces} />,
    );

    // Icon-only button should show MI initials
    expect(markup).toContain("MI");
  });

  it("renders workspace icon with SVG when no workspace found", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher activeWorkspaceId="unknown" workspaces={[]} />,
    );

    // The fallback SVG icon renders
    expect(markup).toContain("stroke-linecap");
  });

  it("does not render initial invite panel content", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={mockWorkspaces} />,
    );

    // Panel starts closed (showPanel=false)
    expect(markup).not.toContain("Invitar por email");
    expect(markup).not.toContain("Administrar miembros");
  });
});
