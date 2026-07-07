"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import type { WorkspaceSummary } from "@/types/workspace";
import type { WorkspaceRole } from "@/types/workspace";

interface MemberInfo {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
  role: WorkspaceRole;
  status: "ACTIVE" | "INVITED" | "SUSPENDED";
  invitedByName: string | null;
  joinedAt: string;
}

interface WorkspaceSwitcherProps {
  activeWorkspaceId: string;
  workspaces: WorkspaceSummary[];
}

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

export function WorkspaceSwitcher({ activeWorkspaceId, workspaces }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    if (!showInvitePanel) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowInvitePanel(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showInvitePanel]);

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

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId]);

  const handleTogglePanel = useCallback(() => {
    setShowInvitePanel((prev) => {
      if (!prev) loadMembers();
      return !prev;
    });
  }, [loadMembers]);

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(`Invitación enviada a ${data.member.userEmail}`);
        setInviteEmail("");
        setMembers((prev) => [...prev, data.member]);
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        setError(data.error || "Error al invitar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setIsInviting(false);
    }
  }, [inviteEmail, activeWorkspaceId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleInvite();
      }
    },
    [handleInvite],
  );

  const currentWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const canManage = currentWorkspace && (currentWorkspace.role === "OWNER" || currentWorkspace.role === "ADMIN");
  const pendingCount = members.filter((m) => m.status === "INVITED").length;
  const activeCount = members.filter((m) => m.status === "ACTIVE").length;

  if (workspaces.length <= 1 && !canManage) return null;

  return (
    <div className="relative flex items-center gap-2">
      {workspaces.length > 1 && (
        <Select value={activeWorkspaceId} onChange={(e) => handleWorkspaceChange(e.target.value)}>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name} {workspace.role === "OWNER" ? "(Owner)" : ""}
            </option>
          ))}
        </Select>
      )}

      {canManage && (
        <div className="relative" ref={panelRef}>
          <button
            type="button"
            onClick={handleTogglePanel}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--app-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--app-text-muted)] hover:bg-[var(--app-bg-hover)] transition-colors"
            title="Gestionar miembros"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {activeCount > 0 && (
              <span className="text-[10px] font-semibold">{activeCount}</span>
            )}
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-semibold">
                {pendingCount} pend.
              </span>
            )}
          </button>

          {showInvitePanel && (
            <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-[var(--app-border)] bg-white shadow-lg">
              <div className="p-3 border-b border-[var(--app-border)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0F172A]">
                    Miembros de {currentWorkspace?.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowInvitePanel(false)}
                    className="text-[var(--app-text-muted)] hover:text-[#0F172A]"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-3 border-b border-[var(--app-border)]">
                <label htmlFor="invite-email" className="block text-[11px] font-medium text-[var(--app-text-muted)] mb-1.5">
                  Invitar por email
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="invite-email"
                    type="email"
                    placeholder="usuario@email.com"
                    value={inviteEmail}
                    onChange={(e) => { setInviteEmail(e.target.value); setError(""); }}
                    onKeyDown={handleKeyDown}
                    disabled={isInviting}
                    className="flex-1 rounded-lg border border-[var(--app-border)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleInvite}
                    disabled={isInviting || !inviteEmail.trim()}
                    className="inline-flex items-center rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
                  >
                    {isInviting ? "..." : "Invitar"}
                  </button>
                </div>
                {error && (
                  <p className="mt-1.5 text-[11px] text-[#EF4444]">{error}</p>
                )}
                {successMsg && (
                  <p className="mt-1.5 text-[11px] text-[#10B981]">{successMsg}</p>
                )}
              </div>

              <div className="max-h-52 overflow-y-auto p-1">
                {isLoading ? (
                  <p className="px-3 py-4 text-center text-[11px] text-[var(--app-text-muted)]">
                    Cargando...
                  </p>
                ) : members.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[11px] text-[var(--app-text-muted)]">
                    No hay miembros aún
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {members.map((member) => (
                      <li
                        key={member.id}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-[var(--app-bg-hover)]"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[10px] font-semibold text-[#2563EB]">
                          {member.userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-medium text-[#0F172A]">
                              {member.userName}
                            </span>
                            <span className="shrink-0 text-[10px] text-[var(--app-text-muted)]">
                              {ROLE_LABEL[member.role]}
                            </span>
                            {member.status === "INVITED" && (
                              <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                Pendiente
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[10px] text-[var(--app-text-muted)]">
                            {member.userEmail}
                            {member.invitedByName && ` · Invitado por ${member.invitedByName}`}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
