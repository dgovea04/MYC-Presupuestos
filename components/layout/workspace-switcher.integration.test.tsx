/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock Select component (renders a native select for easier testing)
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onChange,
  }: {
    children: React.ReactNode;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  }) => (
    <select data-testid="workspace-select" value={value} onChange={onChange}>
      {children}
    </select>
  ),
}));

import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";

const singleWorkspace = [
  { id: "company-1", name: "MYC Ingenieria", role: "OWNER" as const, logoUrl: null },
];

const adminWorkspace = [
  { id: "company-admin", name: "Admin SA", role: "ADMIN" as const, logoUrl: null },
];

const editorWorkspace = [
  { id: "company-editor", name: "Editor Inc", role: "EDITOR" as const, logoUrl: null },
];

const viewerWorkspace = [
  { id: "company-viewer", name: "Viewer Corp", role: "VIEWER" as const, logoUrl: null },
];

const multiWorkspaces = [
  { id: "company-1", name: "MYC Ingenieria", role: "OWNER" as const, logoUrl: null },
  { id: "company-2", name: "Constructora Demo", role: "EDITOR" as const, logoUrl: null },
];

const mockMembers = [
  {
    id: "member-1",
    userId: "user-1",
    userName: "Maria Calderon",
    userEmail: "maria@example.com",
    userAvatarUrl: null,
    role: "OWNER" as const,
    status: "ACTIVE" as const,
    invitedByName: null,
    joinedAt: "2026-01-01T00:00:00.000Z",
    suspendedUntil: null,
  },
  {
    id: "member-2",
    userId: "user-2",
    userName: "Juan Perez",
    userEmail: "juan@example.com",
    userAvatarUrl: null,
    role: "EDITOR" as const,
    status: "ACTIVE" as const,
    invitedByName: "Maria Calderon",
    joinedAt: "2026-02-01T00:00:00.000Z",
    suspendedUntil: null,
  },
];

const mockInvitations = {
  invitations: [
    {
      companyId: "company-3",
      companyName: "TechCo S.A.C.",
      companyLogoUrl: null,
      role: "EDITOR" as const,
      invitedByName: "Carlos Garcia",
      invitedAt: "2026-06-01T00:00:00.000Z",
    },
  ],
};

// Helper: render component and flush all pending effects
async function renderAndFlush(component: React.ReactElement) {
  await act(async () => {
    render(component);
  });
  // Flush any microtasks from fetch().then() callbacks
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ members: mockMembers, invitations: [] }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  cleanup();
});

describe("WorkspaceSwitcher — integration", () => {
  describe("pending invitations", () => {
    it("renders pending invitation badge when invitations exist", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockInvitations,
      });

      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={multiWorkspaces} />,
      );

      expect(screen.getByTitle("Invitaciones pendientes")).toBeTruthy();
      expect(screen.getByText("1")).toBeTruthy();
    });

    it("accepts a pending invitation on button click", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockInvitations,
      });

      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={multiWorkspaces} />,
      );

      expect(screen.getByTitle("Invitaciones pendientes")).toBeTruthy();

      await act(async () => {
        fireEvent.click(screen.getAllByText("Aceptar")[0]);
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/workspaces/company-3/members/accept",
          { method: "POST" },
        );
      });
    });

    it("rejects a pending invitation on button click", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockInvitations,
      });

      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={multiWorkspaces} />,
      );

      expect(screen.getByTitle("Invitaciones pendientes")).toBeTruthy();

      await act(async () => {
        fireEvent.click(screen.getAllByText("×")[0]);
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/workspaces/company-3/members/reject",
          { method: "POST" },
        );
      });
    });
  });

  describe("workspace switching", () => {
    it("renders workspace Select inside the popup when there are multiple workspaces", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={multiWorkspaces} />,
      );

      // Select is inside the popup (showPanel=false initially), must open panel first
      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Now the popup is open, Select should be visible
      await waitFor(() => {
        expect(screen.getAllByTestId("workspace-select").length).toBeGreaterThan(0);
      });
      expect(screen.getByText("Cambiar workspace")).toBeTruthy();
      // Both workspace options should appear
      expect(screen.getAllByText("Constructora Demo").length).toBeGreaterThan(0);
    });

    it("does not render workspace Select for single workspace", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      // Panel is closed; no Select should exist
      expect(screen.queryAllByTestId("workspace-select").length).toBe(0);

      // Open panel — still no Select because single workspace
      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(screen.queryAllByTestId("workspace-select").length).toBe(0);
      expect(screen.queryByText("Cambiar workspace")).toBeNull();
    });

    it("sends POST to /api/workspaces on workspace change", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={multiWorkspaces} />,
      );

      // Open panel first to reveal the Select
      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getAllByTestId("workspace-select").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.change(screen.getAllByTestId("workspace-select")[0], {
          target: { value: "company-2" },
        });
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: "company-2" }),
        });
      });
    });

    it("updates the Select value optimistically before the API call completes", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={multiWorkspaces} />,
      );

      // Open panel to reveal the Select
      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getAllByTestId("workspace-select").length).toBeGreaterThan(0);
      });

      // Verify the Select starts with the initial value
      const select = screen.getByTestId("workspace-select") as HTMLSelectElement;
      expect(select.value).toBe("company-1");

      // Change to a different workspace
      await act(async () => {
        fireEvent.change(select, {
          target: { value: "company-2" },
        });
      });

      // After React re-renders, the Select value should already be updated
      // (optimistic state update in handleWorkspaceChange)
      await waitFor(() => {
        expect(select.value).toBe("company-2");
      });

      // Verify the API was called for the new workspace
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: "company-2" }),
        });
      });
    });
  });

  describe("member management panel", () => {
    it("opens the panel and fetches members when icon button is clicked", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      // The icon button has a title with the workspace name
      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Header shows workspace name
      expect(screen.getByText("MYC Ingenieria")).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledWith("/api/workspaces/company-1/members");
      await waitFor(() => {
        expect(screen.getByText("Maria Calderon")).toBeTruthy();
      });
      expect(screen.getByText("Juan Perez")).toBeTruthy();
    });

    it("shows the invite email input when manager opens panel", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Invitar por email...")).toBeTruthy();
      });
    });

    it("closes the panel when clicking the close button", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });

      await waitFor(() => {
        expect(screen.getByText("MYC Ingenieria")).toBeTruthy();
      });

      // Find all close buttons with X icon and click one
      const closeButtons = screen.getAllByRole("button").filter(
        (b) => b.querySelector('svg') && b.textContent === "",
      );
      // Pick the close button from the panel (the small X in header)
      const panelCloseBtn = closeButtons.find(b => {
        const svg = b.querySelector('svg');
        return svg?.getAttribute("stroke") === "currentColor" && svg?.getAttribute("viewBox") === "0 0 24 24";
      });
      if (panelCloseBtn) {
        fireEvent.click(panelCloseBtn);
      }

      // Panel should close — "Administrar miembros" text should disappear
      await waitFor(() => {
        expect(screen.queryByText("Administrar miembros")).toBeNull();
      });
    });

    it("sends invitation via POST when Invitar is clicked", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Invitar por email...")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText("Invitar por email..."), {
          target: { value: "nuevo@miembro.com" },
        });
      });

      // Mock for invite POST — must include userName to avoid charAt error in member list
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          member: {
            userEmail: "nuevo@miembro.com",
            userName: "Nuevo Miembro",
            userId: "user-new",
            id: "member-new",
            role: "EDITOR",
            status: "INVITED",
            joinedAt: new Date().toISOString(),
            userAvatarUrl: null,
            invitedByName: "Maria Calderon",
          },
        }),
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Invitar"));
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/workspaces/company-1/members",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "nuevo@miembro.com" }),
          },
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText("Invitación enviada a nuevo@miembro.com"),
        ).toBeTruthy();
      });
    });
  });

  describe("member panel with ADMIN role", () => {
    it("shows 'Administrar miembros' header for ADMIN (not 'Miembros del equipo')", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-admin" workspaces={adminWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("Admin SA"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // ADMIN is a manager, so it should say "Administrar miembros"
      expect(screen.getByText("Administrar miembros")).toBeTruthy();
      expect(screen.queryByText("Miembros del equipo")).toBeNull();
    });

    it("loads and displays members for ADMIN", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-admin" workspaces={adminWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("Admin SA"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(fetchMock).toHaveBeenCalledWith("/api/workspaces/company-admin/members");
      await waitFor(() => {
        expect(screen.getByText("Maria Calderon")).toBeTruthy();
      });
      expect(screen.getByText("Juan Perez")).toBeTruthy();
    });

    it("shows invite input for ADMIN", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-admin" workspaces={adminWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("Admin SA"));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Invitar por email...")).toBeTruthy();
      });
    });

    it("does NOT show 3-dot menus on member rows for ADMIN (cannot change roles)", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-admin" workspaces={adminWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("Admin SA"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Find kebab buttons (opacity-0 buttons with SVG icons)
      const kebabButtons = screen.getAllByRole("button").filter(
        (b) => {
          const svg = b.querySelector('svg[fill="currentColor"]');
          return svg && b.classList.contains("opacity-0");
        },
      );

      // ADMIN should NOT see any kebab menus (controls are only for OWNER)
      expect(kebabButtons.length).toBe(0);
    });

    it("sends invitation via POST when Invitar is clicked for ADMIN", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-admin" workspaces={adminWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("Admin SA"));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Invitar por email...")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText("Invitar por email..."), {
          target: { value: "nuevo@admin.com" },
        });
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          member: {
            userEmail: "nuevo@admin.com",
            userName: "Nuevo Admin",
            userId: "user-new",
            id: "member-new",
            role: "EDITOR",
            status: "INVITED",
            joinedAt: new Date().toISOString(),
            userAvatarUrl: null,
            invitedByName: "Admin User",
          },
        }),
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Invitar"));
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/workspaces/company-admin/members",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "nuevo@admin.com" }),
          },
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText("Invitación enviada a nuevo@admin.com"),
        ).toBeTruthy();
      });
    });
  });

  describe("member panel with EDITOR role", () => {
    it("shows 'Miembros del equipo' header for EDITOR (not 'Administrar miembros')", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-editor" workspaces={editorWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("Editor Inc"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // For non-managers, the subtitle should be "Miembros del equipo"
      expect(screen.getByText("Miembros del equipo")).toBeTruthy();
      expect(screen.queryByText("Administrar miembros")).toBeNull();
    });

    it("loads and displays members for EDITOR", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-editor" workspaces={editorWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("Editor Inc"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Members should load successfully
      expect(fetchMock).toHaveBeenCalledWith("/api/workspaces/company-editor/members");
      await waitFor(() => {
        expect(screen.getByText("Maria Calderon")).toBeTruthy();
      });
      expect(screen.getByText("Juan Perez")).toBeTruthy();
    });

    it("does NOT show invite input for EDITOR", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-editor" workspaces={editorWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("Editor Inc"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Invite input should not be rendered for non-managers
      expect(screen.queryByPlaceholderText("Invitar por email...")).toBeNull();
    });
  });

  describe("member panel with VIEWER role", () => {
    it("shows 'Miembros del equipo' header for VIEWER", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-viewer" workspaces={viewerWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("Viewer Corp"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(screen.getByText("Miembros del equipo")).toBeTruthy();
      expect(screen.queryByText("Administrar miembros")).toBeNull();
    });

    it("loads and displays members for VIEWER", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-viewer" workspaces={viewerWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("Viewer Corp"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(fetchMock).toHaveBeenCalledWith("/api/workspaces/company-viewer/members");
      await waitFor(() => {
        expect(screen.getByText("Maria Calderon")).toBeTruthy();
      });
    });

    it("does NOT show invite input for VIEWER", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-viewer" workspaces={viewerWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("Viewer Corp"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(screen.queryByPlaceholderText("Invitar por email...")).toBeNull();
    });
  });

  describe("member panel with OWNER role", () => {
    it("shows 'Administrar miembros' header for OWNER", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(screen.getByText("Administrar miembros")).toBeTruthy();
      expect(screen.queryByText("Miembros del equipo")).toBeNull();
    });

    it("loads and displays members for OWNER", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(fetchMock).toHaveBeenCalledWith("/api/workspaces/company-1/members");
      await waitFor(() => {
        expect(screen.getByText("Maria Calderon")).toBeTruthy();
      });
      expect(screen.getByText("Juan Perez")).toBeTruthy();
    });

    it("shows invite input for OWNER", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Invitar por email...")).toBeTruthy();
      });
    });

    it("shows 3-dot menus on member rows for OWNER (can change roles)", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // OWNER should see kebab buttons on non-self members
      const kebabButtons = screen.getAllByRole("button").filter(
        (b) => {
          const svg = b.querySelector('svg[fill="currentColor"]');
          return svg && b.classList.contains("opacity-0");
        },
      );

      // Should have at least one kebab button (for Juan Perez, not for self/Maria as OWNER)
      expect(kebabButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("opens role dropdown and changes a member's role via PATCH", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Open dropdown
      await act(async () => {
        const kebabButtons = screen.getAllByRole("button").filter(
          (b) => {
            const svg = b.querySelector('svg[fill="currentColor"]');
            return svg && b.classList.contains("opacity-0");
          },
        );
        if (kebabButtons.length > 0) {
          fireEvent.click(kebabButtons[0]);
        }
      });

      await waitFor(() => {
        expect(screen.getByText("Viewer")).toBeTruthy();
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ member: { role: "VIEWER" } }),
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Viewer"));
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/workspaces/company-1/members",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "user-2", role: "VIEWER" }),
          },
        );
      });
    });

    it("removes a member via DELETE with confirmation dialog", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Open dropdown
      await act(async () => {
        const kebabButtons = screen.getAllByRole("button").filter(
          (b) => {
            const svg = b.querySelector('svg[fill="currentColor"]');
            return svg && b.classList.contains("opacity-0");
          },
        );
        if (kebabButtons.length > 0) {
          fireEvent.click(kebabButtons[0]);
        }
      });

      await waitFor(() => {
        expect(screen.getByText("Remover miembro")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Remover miembro"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Confirm dialog appears
      await waitFor(() => {
        expect(screen.getByText(/¿Remover/)).toBeTruthy();
      });

      fetchMock.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        const removeButtons = screen.getAllByText("Remover");
        fireEvent.click(removeButtons[removeButtons.length - 1]);
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/workspaces/company-1/members",
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "user-2" }),
          },
        );
      });
    });

    it("suspends an ACTIVE member via PATCH", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Open dropdown
      await act(async () => {
        const kebabButtons = screen.getAllByRole("button").filter(
          (b) => {
            const svg = b.querySelector('svg[fill="currentColor"]');
            return svg && b.classList.contains("opacity-0");
          },
        );
        if (kebabButtons.length > 0) {
          fireEvent.click(kebabButtons[0]);
        }
      });

      // The dropdown should show "Suspender miembro" for active members
      await waitFor(() => {
        expect(screen.getByText("Suspender miembro")).toBeTruthy();
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          member: { userId: "user-2", status: "SUSPENDED", suspendedUntil: null },
        }),
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Suspender miembro"));
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/workspaces/company-1/members",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "user-2", status: "SUSPENDED" }),
          },
        );
      });
    });

    it("reactivates a SUSPENDED member via PATCH", async () => {
      // Override members mock to include a suspended member
      const suspendedMembers = [
        {
          id: "member-1",
          userId: "user-1",
          userName: "Maria Calderon",
          userEmail: "maria@example.com",
          userAvatarUrl: null,
          role: "OWNER" as const,
          status: "ACTIVE" as const,
          invitedByName: null,
          joinedAt: "2026-01-01T00:00:00.000Z",
          suspendedUntil: null,
        },
        {
          id: "member-2",
          userId: "user-2",
          userName: "Juan Perez",
          userEmail: "juan@example.com",
          userAvatarUrl: null,
          role: "EDITOR" as const,
          status: "SUSPENDED" as const,
          invitedByName: "Maria Calderon",
          joinedAt: "2026-02-01T00:00:00.000Z",
          suspendedUntil: "2026-12-31T23:59:59.000Z",
        },
      ];
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ members: suspendedMembers, invitations: [] }),
      });

      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Open dropdown
      await act(async () => {
        const kebabButtons = screen.getAllByRole("button").filter(
          (b) => {
            const svg = b.querySelector('svg[fill="currentColor"]');
            return svg && b.classList.contains("opacity-0");
          },
        );
        if (kebabButtons.length > 0) {
          fireEvent.click(kebabButtons[0]);
        }
      });

      // For suspended members, the dropdown shows "Reactivar miembro" instead
      await waitFor(() => {
        expect(screen.getByText("Reactivar miembro")).toBeTruthy();
      });
      // "Suspender miembro" should NOT appear for suspended members
      expect(screen.queryByText("Suspender miembro")).toBeNull();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          member: { userId: "user-2", status: "ACTIVE", suspendedUntil: null },
        }),
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Reactivar miembro"));
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/workspaces/company-1/members",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "user-2", status: "ACTIVE" }),
          },
        );
      });
    });
  });

  describe("member loading errors", () => {
    it("shows error message when member fetch returns a non-ok response", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: "No tienes permisos para ver los miembros" }),
      });

      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Wait for loading to finish — the error message should be shown
      await waitFor(() => {
        expect(screen.getByText("No tienes permisos para ver los miembros")).toBeTruthy();
      });
      // "No hay miembros aún" should NOT appear when there's an error
      expect(screen.queryByText("No hay miembros aún")).toBeNull();
    });

    it("shows fallback error message when API returns non-ok with no error body", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Error al cargar miembros")).toBeTruthy();
      });
    });

    it("shows connection error message when fetch throws", async () => {
      fetchMock.mockRejectedValue(new Error("Network failure"));

      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Error de conexión al cargar miembros")).toBeTruthy();
      });
    });

    it("shows loading indicator while fetching, then replaces with error", async () => {
      // Return a promise that we control to delay the response
      let resolveFetch!: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      fetchMock.mockReturnValue(fetchPromise);

      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      // Flush initial effects — the fetch is pending, so isLoading should be true
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Loading indicator should be visible while fetch is pending
      expect(screen.getByText("Cargando...")).toBeTruthy();

      // Now resolve the fetch with an error
      await act(async () => {
        resolveFetch({
          ok: false,
          status: 403,
          json: async () => ({ error: "Acceso denegado" }),
        });
      });
      // Flush the microtask from .then()
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // After resolving, the error should replace the loading indicator
      await waitFor(() => {
        expect(screen.getByText("Acceso denegado")).toBeTruthy();
      });
      expect(screen.queryByText("Cargando...")).toBeNull();
    });
  });

  describe("floating submenu behavior", () => {
    it("opens floating submenu with 'Rol' header when clicking 3-dot button", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Click the 3-dot button
      await act(async () => {
        const kebabButtons = screen.getAllByRole("button").filter(
          (b) => {
            const svg = b.querySelector('svg[fill="currentColor"]');
            return svg && b.classList.contains("opacity-0");
          },
        );
        if (kebabButtons.length > 0) {
          fireEvent.click(kebabButtons[0]);
        }
      });

      // Submenu should appear with "Rol" header
      await waitFor(() => {
        expect(screen.getByText("Rol")).toBeTruthy();
      });
    });

    it("floating submenu shows all role options (Owner, Admin, Editor, Viewer)", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Click the 3-dot button
      await act(async () => {
        const kebabButtons = screen.getAllByRole("button").filter(
          (b) => {
            const svg = b.querySelector('svg[fill="currentColor"]');
            return svg && b.classList.contains("opacity-0");
          },
        );
        if (kebabButtons.length > 0) {
          fireEvent.click(kebabButtons[0]);
        }
      });

      // All 4 role options should appear in the submenu (there may be duplicates
      // from role badges in member rows, so verify at least 2 of each)
      await waitFor(() => {
        expect(screen.getAllByText("Owner").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Admin").length).toBeGreaterThanOrEqual(1);
      });
      expect(screen.getAllByText("Editor").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Viewer").length).toBeGreaterThanOrEqual(1);
    });

    it("closes floating submenu when clicking outside", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Open submenu
      await act(async () => {
        const kebabButtons = screen.getAllByRole("button").filter(
          (b) => {
            const svg = b.querySelector('svg[fill="currentColor"]');
            return svg && b.classList.contains("opacity-0");
          },
        );
        if (kebabButtons.length > 0) {
          fireEvent.click(kebabButtons[0]);
        }
      });

      await waitFor(() => {
        expect(screen.getByText("Rol")).toBeTruthy();
      });

      // Click outside — dispatch mousedown on the MYC Ingenieria title (outside submenu)
      await act(async () => {
        fireEvent.mouseDown(screen.getByText("MYC Ingenieria"));
      });

      // Submenu should close — "Rol" should disappear
      await waitFor(() => {
        expect(screen.queryByText("Rol")).toBeNull();
      });
    });

    it("toggles submenu closed when clicking the same 3-dot button again", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      const getKebabButtons = () =>
        screen.getAllByRole("button").filter(
          (b) => {
            const svg = b.querySelector('svg[fill="currentColor"]');
            return svg && b.classList.contains("opacity-0");
          },
        );

      // Open submenu
      await act(async () => {
        const buttons = getKebabButtons();
        if (buttons.length > 0) fireEvent.click(buttons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText("Rol")).toBeTruthy();
      });

      // Click same 3-dot again
      await act(async () => {
        const buttons = getKebabButtons();
        if (buttons.length > 0) fireEvent.click(buttons[0]);
      });

      // Submenu should close
      await waitFor(() => {
        expect(screen.queryByText("Rol")).toBeNull();
      });
    });

    it("closes submenu when selecting a role (PATCH is called and submenu closes)", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Open submenu
      await act(async () => {
        const kebabButtons = screen.getAllByRole("button").filter(
          (b) => {
            const svg = b.querySelector('svg[fill="currentColor"]');
            return svg && b.classList.contains("opacity-0");
          },
        );
        if (kebabButtons.length > 0) {
          fireEvent.click(kebabButtons[0]);
        }
      });

      await waitFor(() => {
        expect(screen.getByText("Viewer")).toBeTruthy();
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ member: { role: "VIEWER" } }),
      });

      // Click role — submenu should close BEFORE PATCH completes
      await act(async () => {
        fireEvent.click(screen.getByText("Viewer"));
      });

      // Submenu should be closed immediately (setSubmenuAnchor(null) is called)
      await waitFor(() => {
        expect(screen.queryByText("Rol")).toBeNull();
      });

      // PATCH should also be called
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/workspaces/company-1/members",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "user-2", role: "VIEWER" }),
          },
        );
      });
    });

    it("closes submenu when clicking 'Suspender miembro'", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Open submenu
      await act(async () => {
        const kebabButtons = screen.getAllByRole("button").filter(
          (b) => {
            const svg = b.querySelector('svg[fill="currentColor"]');
            return svg && b.classList.contains("opacity-0");
          },
        );
        if (kebabButtons.length > 0) {
          fireEvent.click(kebabButtons[0]);
        }
      });

      await waitFor(() => {
        expect(screen.getByText("Suspender miembro")).toBeTruthy();
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          member: { userId: "user-2", status: "SUSPENDED", suspendedUntil: null },
        }),
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Suspender miembro"));
      });

      // Submenu should close immediately
      await waitFor(() => {
        expect(screen.queryByText("Rol")).toBeNull();
      });
    });

    it("closes submenu when panel close button is clicked", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Open submenu
      await act(async () => {
        const kebabButtons = screen.getAllByRole("button").filter(
          (b) => {
            const svg = b.querySelector('svg[fill="currentColor"]');
            return svg && b.classList.contains("opacity-0");
          },
        );
        if (kebabButtons.length > 0) {
          fireEvent.click(kebabButtons[0]);
        }
      });

      await waitFor(() => {
        expect(screen.getByText("Rol")).toBeTruthy();
      });

      // Close the panel via the X button
      const closeButtons = screen.getAllByRole("button").filter(
        (b) => b.querySelector('svg') && b.textContent === "",
      );
      const panelCloseBtn = closeButtons.find(b => {
        const svg = b.querySelector('svg');
        return svg?.getAttribute("stroke") === "currentColor" && svg?.getAttribute("viewBox") === "0 0 24 24";
      });
      if (panelCloseBtn) {
        fireEvent.click(panelCloseBtn);
      }

      // Panel should close and submenu should be gone
      await waitFor(() => {
        expect(screen.queryByText("Administrar miembros")).toBeNull();
        expect(screen.queryByText("Rol")).toBeNull();
      });
    });

    it("clamps vertical position when button is near bottom of popup", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Find kebab button and panel popup for getBoundingClientRect mocking
      const kebabButtons = screen.getAllByRole("button").filter(
        (b) => {
          const svg = b.querySelector('svg[fill="currentColor"]');
          return svg && b.classList.contains("opacity-0");
        },
      );
      expect(kebabButtons.length).toBeGreaterThanOrEqual(1);
      const kebabButton = kebabButtons[0];

      // Find the panel popup (the w-80 container)
      const popupEl = kebabButton.closest('[class*="w-80"]');
      expect(popupEl).not.toBeNull();

      // Mock button position near the bottom of a 500px popup
      // buttonRect.top = 460 means the button is 460px down from popup top
      // With popup height=500 and submenuEstimate=320+margin=8, maxOffsetY=500-320-8=172
      // So 460 should be clamped to 172
      const originalButtonRect = vi.spyOn(kebabButton, "getBoundingClientRect");
      originalButtonRect.mockReturnValue({
        top: 510,
        bottom: 530,
        left: 300,
        right: 320,
        width: 20,
        height: 20,
        x: 300,
        y: 510,
        toJSON() {
          return this;
        },
      });

      const originalPopupRect = vi.spyOn(popupEl!, "getBoundingClientRect");
      originalPopupRect.mockReturnValue({
        top: 50,
        bottom: 550,
        left: 200,
        right: 520,
        width: 320,
        height: 500,
        x: 200,
        y: 50,
        toJSON() {
          return this;
        },
      });

      // Click the kebab button — offsetY = 510 - 50 = 460, which exceeds max 172
      await act(async () => {
        fireEvent.click(kebabButton);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Submenu should appear at clamped position
      const submenu = screen.getByText("Rol").closest('[style*="position: absolute"]') as HTMLElement | null;
      expect(submenu).not.toBeNull();
      // offsetY should be clamped to maxOffsetY = 500 - 320 - 8 = 172
      const topPx = submenu!.style.top;
      expect(topPx).toBe("172px");

      // Clean up mocks
      originalButtonRect.mockRestore();
      originalPopupRect.mockRestore();
    });

    it("clamps vertical position to 0 when button is above popup top (negative offsetY)", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Find kebab button and panel popup for getBoundingClientRect mocking
      const kebabButtons = screen.getAllByRole("button").filter(
        (b) => {
          const svg = b.querySelector('svg[fill="currentColor"]');
          return svg && b.classList.contains("opacity-0");
        },
      );
      expect(kebabButtons.length).toBeGreaterThanOrEqual(1);
      const kebabButton = kebabButtons[0];

      // Find the panel popup (the w-80 container)
      const popupEl = kebabButton.closest('[class*="w-80"]');
      expect(popupEl).not.toBeNull();

      // Mock button position ABOVE the popup top
      // buttonRect.top = 30, popupRect.top = 50, so offsetY = 30 - 50 = -20
      // Math.max(0, -20) should clamp to 0
      const originalButtonRect = vi.spyOn(kebabButton, "getBoundingClientRect");
      originalButtonRect.mockReturnValue({
        top: 30,
        bottom: 50,
        left: 300,
        right: 320,
        width: 20,
        height: 20,
        x: 300,
        y: 30,
        toJSON() {
          return this;
        },
      });

      const originalPopupRect = vi.spyOn(popupEl!, "getBoundingClientRect");
      originalPopupRect.mockReturnValue({
        top: 50,
        bottom: 550,
        left: 200,
        right: 520,
        width: 320,
        height: 500,
        x: 200,
        y: 50,
        toJSON() {
          return this;
        },
      });

      // Click the kebab button — offsetY = 30 - 50 = -20, clamped to 0
      await act(async () => {
        fireEvent.click(kebabButton);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Submenu should appear at clamped position (0)
      const submenu = screen.getByText("Rol").closest('[style*="position: absolute"]') as HTMLElement | null;
      expect(submenu).not.toBeNull();
      // offsetY should be clamped to 0
      const topPx = submenu!.style.top;
      expect(topPx).toBe("0px");

      // Clean up mocks
      originalButtonRect.mockRestore();
      originalPopupRect.mockRestore();
    });

    it("shows 'Reactivar miembro' in submenu for suspended members instead of 'Suspender miembro'", async () => {
      const suspendedMembers = [
        {
          id: "member-1",
          userId: "user-1",
          userName: "Maria Calderon",
          userEmail: "maria@example.com",
          userAvatarUrl: null,
          role: "OWNER" as const,
          status: "ACTIVE" as const,
          invitedByName: null,
          joinedAt: "2026-01-01T00:00:00.000Z",
          suspendedUntil: null,
        },
        {
          id: "member-2",
          userId: "user-2",
          userName: "Juan Perez",
          userEmail: "juan@example.com",
          userAvatarUrl: null,
          role: "EDITOR" as const,
          status: "SUSPENDED" as const,
          invitedByName: "Maria Calderon",
          joinedAt: "2026-02-01T00:00:00.000Z",
          suspendedUntil: "2026-12-31T23:59:59.000Z",
        },
      ];
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ members: suspendedMembers, invitations: [] }),
      });

      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Open submenu
      await act(async () => {
        const kebabButtons = screen.getAllByRole("button").filter(
          (b) => {
            const svg = b.querySelector('svg[fill="currentColor"]');
            return svg && b.classList.contains("opacity-0");
          },
        );
        if (kebabButtons.length > 0) {
          fireEvent.click(kebabButtons[0]);
        }
      });

      await waitFor(() => {
        expect(screen.getByText("Reactivar miembro")).toBeTruthy();
      });
      expect(screen.queryByText("Suspender miembro")).toBeNull();
    });
  });

  describe("member role and status management", () => {
    it("shows confirm dialog and triggers DELETE when removing a member", async () => {
      await renderAndFlush(
        <WorkspaceSwitcher activeWorkspaceId="company-1" workspaces={singleWorkspace} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("MYC Ingenieria"));
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(screen.getByText("Juan Perez")).toBeTruthy();
      });

      // Open dropdown
      await act(async () => {
        const kebabButtons = screen.getAllByRole("button").filter(
          (b) => {
            const svg = b.querySelector('svg[fill="currentColor"]');
            return svg && b.classList.contains("opacity-0");
          },
        );
        if (kebabButtons.length > 0) {
          fireEvent.click(kebabButtons[0]);
        }
      });

      await waitFor(() => {
        expect(screen.getByText("Remover miembro")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Remover miembro"));
      });
      // Flush microtasks so React processes the confirmRemoveUserId state update
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        // Use regex to handle the span-split text inside the <p>
        expect(
          screen.getByText(/¿Remover/),
        ).toBeTruthy();
      });

      // Set up the DELETE response
      fetchMock.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        const removeButtons = screen.getAllByText("Remover");
        fireEvent.click(removeButtons[removeButtons.length - 1]);
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/workspaces/company-1/members",
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "user-2" }),
          },
        );
      });
    });
  });
});
