/* @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AgentRightPanel } from "@/components/ai/agent/AgentRightPanel";

const base = { state: "PENDING_APPROVAL", summary: null, pendingApproval: { approvalId: "a-1", toolName: "createBudget", reason: "Crear presupuesto", impactSummary: "Afectará al proyecto seleccionado." }, toolActivity: [], warnings: [], latencyMs: null };
const props = { streamExecution: base, streaming: false, projectId: "p-1", workspaceId: "w-1", workspaceName: "Constructora", allTools: [{ name: "createBudget", description: "Crear", risk: "financial" as const }], onApprove: vi.fn(), onReject: vi.fn(), approving: false, intent: null, pendingAction: null, approvalStatus: null };

describe("AgentRightPanel approvals", () => {
  it("shows impact, risk and requires a rejection reason", () => { render(<AgentRightPanel {...props} />); expect(screen.getByText("Afectará al proyecto seleccionado.")).toBeTruthy(); expect(screen.getAllByText("financial").length).toBeGreaterThan(0); expect((screen.getAllByRole("button", { name: "Rechazar" })[0] as HTMLButtonElement).disabled).toBe(true); });
  it("sends the rejection reason", () => { const onReject = vi.fn(); render(<AgentRightPanel {...props} onReject={onReject} />); fireEvent.change(screen.getAllByLabelText("Motivo de rechazo (opcional)")[1], { target: { value: "Revisar costos" } }); fireEvent.click(screen.getAllByRole("button", { name: "Rechazar" })[1]); expect(onReject).toHaveBeenCalledWith("a-1", "Revisar costos"); });
});
