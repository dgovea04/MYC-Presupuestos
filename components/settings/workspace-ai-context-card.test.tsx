/* @vitest-environment jsdom */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceAiContextCard } from "@/components/settings/workspace-ai-context-card";

describe("WorkspaceAiContextCard", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  it("shows loading state", () => { vi.spyOn(global, "fetch").mockReturnValue(new Promise(() => undefined)); render(<WorkspaceAiContextCard workspaceId="ws-1" />); expect(screen.getByText("Cargando uso de IA...")).toBeTruthy(); });
  it("shows usage and does not expose prompt data", async () => { vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ plan: { name: "Pro" }, aiUsage: { requests: 4, consumedTokens: 800, limit: 1000, actualCostMinor: 1250 } }), { status: 200 })); render(<WorkspaceAiContextCard workspaceId="ws-1" />); expect(await screen.findByText("800 / 1000")).toBeTruthy(); expect(screen.getByText("Plan activo: Pro")).toBeTruthy(); expect(document.body.textContent).not.toContain("encryptedSecret"); });
});
