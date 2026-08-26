/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceAiCredentialsCard } from "@/components/settings/workspace-ai-credentials-card";

afterEach(() => vi.restoreAllMocks());

describe("WorkspaceAiCredentialsCard", () => {
  it("renders a loading state", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<WorkspaceAiCredentialsCard workspaceId="w1" canManage={false} />);
    expect(screen.getByText("Cargando credenciales...")).toBeTruthy();
  });

  it("shows masked values and hides mutation controls for read-only members", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ credentials: [{ id: "c1", provider: "OPENAI", maskedValue: "sk-...key", status: "ACTIVE", isFallback: false, lastError: null }] }) }));
    render(<WorkspaceAiCredentialsCard workspaceId="w1" canManage={false} />);
    expect(await screen.findByText(/sk-\.\.\.key/)).toBeTruthy();
    expect(screen.queryByPlaceholderText("Nueva API key")).toBeNull();
    expect(document.body.textContent).not.toContain("encryptedSecret");
  });
});
