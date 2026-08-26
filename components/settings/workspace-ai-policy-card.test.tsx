/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceAiPolicyCard } from "@/components/settings/workspace-ai-policy-card";

afterEach(() => vi.restoreAllMocks());

describe("WorkspaceAiPolicyCard", () => {
  it("renders a loading state", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<WorkspaceAiPolicyCard workspaceId="w1" canManage={false} />);
    expect(screen.getByText("Cargando política...")).toBeTruthy();
  });

  it("hides save controls for read-only members and renders only safe policy data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ mode: "PLATFORM" }) }));
    render(<WorkspaceAiPolicyCard workspaceId="w1" canManage={false} />);
    expect(await screen.findByText("Solo Owner/Admin puede cambiar esta política.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /guardar política/i })).toBeNull();
    expect(document.body.textContent).not.toContain("encryptedSecret");
  });
});
