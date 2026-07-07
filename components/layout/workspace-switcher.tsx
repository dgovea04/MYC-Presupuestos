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
  suspendedUntil: string | null;
}

interface PendingInvitation {
  companyId: string;
  companyName: string;
  companyLogoUrl: string | null;
  role: WorkspaceRole;
  invitedByName: string | null;
  invitedAt: string;
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
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());
  const [rejectingIds, setRejectingIds] = useState<Set<string>>(new Set());
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);
  const [suspendUntil, setSuspendUntil] = useState("");
  const [memberActionError, setMemberActionError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Fetch pending invitations on mount
  useEffect(() => {
    fetch("/api/workspaces/pending")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.invitations) setPendingInvitations(data.invitations);
      })
      .catch(() => {});
  }, []);

  const handleAccept = useCallback(async (companyId: string) => {
    setAcceptingIds((prev) => new Set(prev).add(companyId));
    try {
      const res = await fetch(`/api/workspaces/${companyId}/members/accept`, { method: "POST" });
      if (res.ok) {
        setPendingInvitations((prev) => prev.filter((inv) => inv.companyId !== companyId));
        router.refresh();
      }
    } catch {
      // silent
    } finally {
      setAcceptingIds((prev) => {
        const next = new Set(prev);
        next.delete(companyId);
        return next;
      });
    }
  }, [router]);

  const handleReject = useCallback(async (companyId: string) => {
    setRejectingIds((prev) => new Set(prev).add(companyId));
    try {
      const res = await fetch(`/api/workspaces/${companyId}/members/reject`, { method: "POST" });
      if (res.ok) {
        setPendingInvitations((prev) => prev.filter((inv) => inv.companyId !== companyId));
      }
    } catch {
      // silent
    } finally {
      setRejectingIds((prev) => {
        const next = new Set(prev);
        next.delete(companyId);
        return next;
      });
    }
  }, []);

  const handleToggleStatus = useCallback(async (userId: string, newStatus: "ACTIVE" | "SUSPENDED", suspendedUntil?: string) => {
    setChangingRoleId(userId);
    setOpenDropdownId(null);
    setSuspendUntil("");
    setMemberActionError("");
    try {
      const body: Record<string, unknown> = { userId, status: newStatus };
      if (newStatus === "SUSPENDED" && suspendedUntil) {
        body.suspendedUntil = new Date(suspendedUntil).toISOString();
      }
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, status: data.member.status, suspendedUntil: data.member.suspendedUntil ?? null } : m)));
      } else {
        const data = await res.json().catch(() => ({}));
        setMemberActionError(data.error || "Error al cambiar estado");
        setTimeout(() => setMemberActionError(""), 4000);
      }
    } catch {
      setMemberActionError("Error de conexión");
      setTimeout(() => setMemberActionError(""), 4000);
    } finally {
      setChangingRoleId(null);
    }
  }, [activeWorkspaceId]);

  const handleChangeRole = useCallback(async (userId: string, role: WorkspaceRole) => {
    setChangingRoleId(userId);
    setOpenDropdownId(null);
    setMemberActionError("");
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (res.ok) {
        const data = await res.json();
        setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role: data.member.role } : m)));
      } else {
        const data = await res.json().catch(() => ({}));
        setMemberActionError(data.error || "Error al cambiar rol");
        setTimeout(() => setMemberActionError(""), 4000);
      }
    } catch {
      setMemberActionError("Error de conexión");
      setTimeout(() => setMemberActionError(""), 4000);
    } finally {
      setChangingRoleId(null);
    }
  }, [activeWorkspaceId]);

  const handleRemoveMember = useCallback(async (userId: string) => {
    setRemovingId(userId);
    setOpenDropdownId(null);
    setMemberActionError("");
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
      } else {
        const data = await res.json().catch(() => ({}));
        setMemberActionError(data.error || "Error al remover miembro");
        setTimeout(() => setMemberActionError(""), 4000);
      }
    } catch {
      setMemberActionError("Error de conexión");
      setTimeout(() => setMemberActionError(""), 4000);
    } finally {
      setRemovingId(null);
    }
  }, [activeWorkspaceId]);

  // Close role dropdown on outside click
  useEffect(() => {
    if (!openDropdownId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const dropdown = dropdownRefs.current.get(openDropdownId);
      if (dropdown && !dropdown.contains(e.target as Node)) {
        setOpenDropdownId(null);
        setConfirmRemoveUserId(null);
        setSuspendUntil("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdownId]);

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
  const hasPendingInvites = pendingInvitations.length > 0;

  return (
    <div className="relative flex items-center gap-2">
      {/* Pending invitations badge */}
      {hasPendingInvites && (
        <div className="relative group">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            title="Invitaciones pendientes"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="font-semibold">{pendingInvitations.length}</span>
          </button>

          {/* Dropdown with pending invitations */}
          <div className="absolute right-0 top-full mt-2 z-50 w-72 hidden group-hover:block rounded-xl border border-[var(--app-border)] bg-white shadow-lg">
            <div className="p-2.5 border-b border-[var(--app-border)]">
              <h3 className="text-xs font-semibold text-[#0F172A]">Invitaciones pendientes</h3>
            </div>
            <div className="max-h-52 overflow-y-auto p-1">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.companyId}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-[var(--app-bg-hover)]"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-700">
                    {invitation.companyName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium text-[#0F172A]">
                      {invitation.companyName}
                    </p>
                    <p className="truncate text-[10px] text-[var(--app-text-muted)]">
                      {ROLE_LABEL[invitation.role]}
                      {invitation.invitedByName && ` · por ${invitation.invitedByName}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAccept(invitation.companyId)}
                      disabled={acceptingIds.has(invitation.companyId) || rejectingIds.has(invitation.companyId)}
                      className="rounded-lg bg-[#2563EB] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
                    >
                      {acceptingIds.has(invitation.companyId) ? "..." : "Aceptar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(invitation.companyId)}
                      disabled={rejectingIds.has(invitation.companyId) || acceptingIds.has(invitation.companyId)}
                      className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-[10px] font-medium text-[var(--app-text-muted)] hover:bg-red-50 hover:text-[#EF4444] hover:border-red-200 disabled:opacity-50 transition-colors"
                    >
                      {rejectingIds.has(invitation.companyId) ? "..." : "×"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
                {memberActionError && (
                  <p className="mt-1.5 text-[11px] text-[#EF4444]">{memberActionError}</p>
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
                    {members.map((member) => {
                      const isOwner = currentWorkspace?.role === "OWNER";
                      const isSelfOwner = isOwner && member.role === "OWNER";
                      const showControls = isOwner && !isSelfOwner;
                      const isBusy = changingRoleId === member.userId || removingId === member.userId;

                      return (
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
                            {isBusy ? (
                              <span className="shrink-0 text-[10px] text-[var(--app-text-muted)]">...</span>
                            ) : (
                              <span className="shrink-0 text-[10px] text-[var(--app-text-muted)]">
                                {ROLE_LABEL[member.role]}
                              </span>
                            )}
                            {member.status === "INVITED" && (
                              <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                Pendiente
                              </span>
                            )}
                            {member.status === "SUSPENDED" && (
                              <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                                Suspendido
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[10px] text-[var(--app-text-muted)]">
                            {member.userEmail}
                            {member.invitedByName && ` · Invitado por ${member.invitedByName}`}
                          </p>
                        </div>
                        {showControls && (
                          <div className="relative shrink-0" ref={(el) => { if (el) dropdownRefs.current.set(member.id, el); else dropdownRefs.current.delete(member.id); }}>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmRemoveUserId(null);
                                setSuspendUntil("");
                                setOpenDropdownId(openDropdownId === member.id ? null : member.id);
                              }}
                              className="inline-flex items-center justify-center h-6 w-6 rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-bg-hover)] hover:text-[#0F172A] disabled:opacity-50 transition-colors"
                            >
                              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>

                            {openDropdownId === member.id && (
                              <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-xl border border-[var(--app-border)] bg-white shadow-lg py-1">
                                <p className="px-2.5 py-1 text-[10px] font-semibold text-[var(--app-text-muted)] uppercase tracking-wide">Cambiar rol</p>
                                {(Object.keys(ROLE_LABEL) as WorkspaceRole[]).map((role) => (
                                  <button
                                    key={role}
                                    type="button"
                                    disabled={member.role === role || isBusy}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleChangeRole(member.userId, role);
                                    }}
                                    className={`w-full text-left px-2.5 py-1 text-[11px] transition-colors ${
                                      member.role === role
                                        ? "text-[#2563EB] font-medium bg-[#EFF6FF]"
                                        : "text-[#0F172A] hover:bg-[var(--app-bg-hover)]"
                                    } disabled:opacity-50`}
                                  >
                                    <span className="flex items-center gap-1.5">
                                      {member.role === role && (
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                      {ROLE_LABEL[role]}
                                    </span>
                                  </button>
                                ))}
                                <div className="border-t border-[var(--app-border)] my-1" />
                                {member.status === "SUSPENDED" ? (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleStatus(member.userId, "ACTIVE");
                                    }}
                                    className="w-full text-left px-2.5 py-1 text-[11px] text-[#10B981] hover:bg-green-50 transition-colors disabled:opacity-50"
                                  >
                                    Reactivar miembro
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isBusy || member.status === "INVITED"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleStatus(member.userId, "SUSPENDED", suspendUntil || undefined);
                                    }}
                                    className="w-full text-left px-2.5 py-1 text-[11px] text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
                                  >
                                    Suspender miembro
                                  </button>
                                )}
                                {member.status !== "SUSPENDED" && member.status !== "INVITED" && (
                                  <div className="px-2.5 pb-1.5">
                                    <input
                                      type="datetime-local"
                                      value={suspendUntil}
                                      onChange={(e) => setSuspendUntil(e.target.value)}
                                      placeholder="Hasta (opcional)"
                                      className="w-full rounded-md border border-[var(--app-border)] px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                                    />
                                    <p className="mt-0.5 text-[9px] text-[var(--app-text-muted)]">
                                      Fecha opcional de reactivación
                                    </p>
                                  </div>
                                )}
                                <div className="border-t border-[var(--app-border)] my-1" />
                                {confirmRemoveUserId === member.userId ? (
                                  <div className="px-2.5 py-1.5">
                                    <p className="text-[10px] text-[var(--app-text-muted)] leading-tight mb-2">
                                      ¿Estás seguro de remover a <span className="font-medium text-[#0F172A]">{member.userName}</span>?
                                    </p>
                                    <div className="flex gap-1.5">
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmRemoveUserId(null);
                                        }}
                                        className="flex-1 rounded-md border border-[var(--app-border)] px-2 py-1 text-[10px] font-medium text-[var(--app-text-muted)] hover:bg-[var(--app-bg-hover)] disabled:opacity-50 transition-colors"
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmRemoveUserId(null);
                                          handleRemoveMember(member.userId);
                                        }}
                                        className="flex-1 rounded-md bg-[#EF4444] px-2 py-1 text-[10px] font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                                      >
                                        {removingId === member.userId ? "..." : "Remover"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmRemoveUserId(member.userId);
                                    }}
                                    className="w-full text-left px-2.5 py-1 text-[11px] text-[#EF4444] hover:bg-red-50 transition-colors disabled:opacity-50"
                                  >
                                    Remover miembro
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                      );
                    })}
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
