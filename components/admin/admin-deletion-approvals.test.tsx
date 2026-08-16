/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdminDeletionApprovals } from "@/components/admin/admin-deletion-approvals";

afterEach(() => {
  cleanup();
});

describe("AdminDeletionApprovals", () => {
  const baseProps = {
    currentUserId: "primary-1",
    canApprove: true,
    canManageGracePeriod: true,
    approvals: [],
  };

  it("blocks permanent deletion while the grace period is active", () => {
    render(
      <AdminDeletionApprovals
        {...baseProps}
        scheduledDeletions={[
          {
            id: "approval-1",
            targetUserId: "user-1",
            targetEmail: "user@example.com",
            reason: "Cuenta de prueba suspendida",
            deletionScheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        ]}
      />,
    );

    expect((screen.getByRole("button", { name: "Restaurar" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Eliminar definitivamente" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables permanent deletion only after the grace period", () => {
    render(
      <AdminDeletionApprovals
        {...baseProps}
        scheduledDeletions={[
          {
            id: "approval-1",
            targetUserId: "user-1",
            targetEmail: "user@example.com",
            reason: "Cuenta de prueba suspendida",
            deletionScheduledAt: new Date(Date.now() - 1_000).toISOString(),
          },
        ]}
      />,
    );

    expect((screen.getByRole("button", { name: "Restaurar" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Eliminar definitivamente" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
