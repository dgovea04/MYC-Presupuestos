"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import type { WorkspaceSummary } from "@/types/workspace";

interface WorkspaceSwitcherProps {
  activeWorkspaceId: string;
  workspaces: WorkspaceSummary[];
}

export function WorkspaceSwitcher({ activeWorkspaceId, workspaces }: WorkspaceSwitcherProps) {
  const router = useRouter();

  const handleWorkspaceChange = useCallback(
    async (value: string) => {
      try {
        await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: value }),
        });
        router.refresh();
      } catch {
        // silent
      }
    },
    [router],
  );

  if (workspaces.length <= 1) return null;

  return (
    <Select value={activeWorkspaceId} onChange={(e) => handleWorkspaceChange(e.target.value)}>
      {workspaces.map((workspace) => (
        <option key={workspace.id} value={workspace.id}>
          {workspace.name} {workspace.role === "OWNER" ? "(Owner)" : ""}
        </option>
      ))}
    </Select>
  );
}
