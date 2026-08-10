"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Select } from "@/components/ui/select";
import type { WorkspaceSummary } from "@/types/workspace";
import type { WorkspaceRole } from "@/types/workspace";

// Simple in-memory request deduplication for client-side API calls
const fetchCache = new Map<string, { data: unknown; timestamp: number }>();
const FETCH_CACHE_TTL = 30_000; // 30s

async function cachedFetch(url: string): Promise<unknown | null> {
  const cached = fetchCache.get(url);
  if (cached && Date.now() - cached.timestamp < FETCH_CACHE_TTL) {
    return cached.data;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    fetchCache.set(url, { data, timestamp: Date.now() });
    return data;
  } catch {
    return null;
  }
}

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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? "WS";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function WorkspaceSwitcher({ activeWorkspaceId, workspaces }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(activeWorkspaceId);
  const [showPanel, setShowPanel] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());
  const [rejectingIds, setRejectingIds] = useState<Set<string>>(new Set());
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);
  const [suspendUntil, setSuspendUntil] = useState("");
  const [loadError, setLoadError] = useState("");
  const [memberActionError, setMemberActionError] = useState("");
  const [submenuAnchor, setSubmenuAnchor] = useState<{ offsetY: number; memberId: string } | null>(null);
  const [brokenLogoUrls, setBrokenLogoUrls] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const panelPopupRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  // Fetch pending invitations on mount (with dedup cache)
  useEffect(() => {
    cachedFetch("/api/workspaces/pending").then((data) => {
      if (data && typeof data === "object" && "invitations" in data) {
        setPendingInvitations((data as { invitations: PendingInvitation[] }).invitations);
      }
    });
  }, []);

  const handleAccept = useCallback(
    async (companyId: string) => {
      setAcceptingIds((prev) => new Set(prev).add(companyId));
      try {
        const res = await fetch(`/api/workspaces/${companyId}/members/accept`, {
          method: "POST",
        });
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
    },
    [router],
  );

  const handleReject = useCallback(async (companyId: string) => {
    setRejectingIds((prev) => new Set(prev).add(companyId));
    try {
      const res = await fetch(`/api/workspaces/${companyId}/members/reject`, {
        method: "POST",
      });
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

  const handleToggleStatus = useCallback(
    async (userId: string, newStatus: "ACTIVE" | "SUSPENDED", suspendedUntil?: string) => {
      setSubmenuAnchor(null);
      setChangingRoleId(userId);
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
          setMembers((prev) =>
            prev.map((m) =>
              m.userId === userId
                ? { ...m, status: data.member.status, suspendedUntil: data.member.suspendedUntil ?? null }
                : m,
            ),
          );
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
    },
    [activeWorkspaceId],
  );

  const handleChangeRole = useCallback(
    async (userId: string, role: WorkspaceRole) => {
      setSubmenuAnchor(null);
      setChangingRoleId(userId);
      setMemberActionError("");
      try {
        const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, role }),
        });
        if (res.ok) {
          const data = await res.json();
          setMembers((prev) =>
            prev.map((m) => (m.userId === userId ? { ...m, role: data.member.role } : m)),
          );
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
    },
    [activeWorkspaceId],
  );

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      setSubmenuAnchor(null);
      setRemovingId(userId);
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
    },
    [activeWorkspaceId],
  );

  // Close floating submenu on outside click
  useEffect(() => {
    if (!submenuAnchor) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (submenuRef.current && !submenuRef.current.contains(e.target as Node)) {
        setSubmenuAnchor(null);
        setConfirmRemoveUserId(null);
        setSuspendUntil("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [submenuAnchor]);

  // Close panel on outside click (but NOT when clicking inside Radix Select portals)
  useEffect(() => {
    if (!showPanel) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        // Ignore clicks inside Radix UI Select portal content (rendered outside the panel tree)
        if (target.closest('.ui-select-content')) return;
        setShowPanel(false);
        setSubmenuAnchor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPanel]);

  // Re-sync local state when server-side prop changes (e.g. after router.refresh())
  useEffect(() => {
    setSelectedWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId]);

  const handleWorkspaceChange = useCallback(
    async (value: string) => {
      setSelectedWorkspaceId(value);
      try {
        const res = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: value }),
        });
        if (res.ok) {
          router.refresh();
        } else {
          setSelectedWorkspaceId(activeWorkspaceId);
        }
      } catch {
        setSelectedWorkspaceId(activeWorkspaceId);
      }
    },
    [router, activeWorkspaceId],
  );

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    setError("");
    const url = `/api/workspaces/${activeWorkspaceId}/members`;
    const data = await cachedFetch(url);
    if (data && typeof data === "object" && "members" in data) {
      setMembers((data as { members: MemberInfo[] }).members);
    } else {
      // fallback: retry fresh on cache miss
      try {
        const res = await fetch(url);
        if (res.ok) {
          const fresh = await res.json();
          setMembers(fresh.members);
        } else {
          const err = await res.json().catch(() => ({}));
          setLoadError(err.error || "Error al cargar miembros");
        }
      } catch {
        setLoadError("Error de conexión al cargar miembros");
      }
    }
    setIsLoading(false);
  }, [activeWorkspaceId]);

  const handleTogglePanel = useCallback(() => {
    setShowPanel((prev) => {
      if (!prev) {
        setLoadError("");
        loadMembers();
      }
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

  const currentWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);

  const handleLogoError = useCallback((url: string) => {
    setBrokenLogoUrls((prev) => new Set(prev).add(url));
  }, []);

  const logoVisible = currentWorkspace?.logoUrl ? !brokenLogoUrls.has(currentWorkspace.logoUrl) : false;
  const canManage = currentWorkspace && (currentWorkspace.role === "OWNER" || currentWorkspace.role === "ADMIN");
  const activeMembers = members.filter((m) => m.status === "ACTIVE");
  const pendingMembers = members.filter((m) => m.status === "INVITED");
  const suspendedMembers = members.filter((m) => m.status === "SUSPENDED");
  const hasPendingInvites = pendingInvitations.length > 0;
  const targetMember = submenuAnchor ? members.find((m) => m.id === submenuAnchor.memberId) : null;

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
                    <p className="truncate text-xs font-medium text-[#0F172A]">{invitation.companyName}</p>
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

      {/* Icon-only toggle button - matches Tema button dimensions */}
      <div className="relative" ref={panelRef}>
        <button
          type="button"
          onClick={handleTogglePanel}
          className="ui-button inline-flex items-center justify-center h-9 w-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-0 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text-strong)] transition-colors"
          title={currentWorkspace?.name ?? "Workspace"}
          aria-label="Workspace"
        >
          {logoVisible ? (
            <Image
              src={currentWorkspace!.logoUrl!}
              alt={currentWorkspace!.name}
              width={18}
              height={18}
              className="h-[18px] w-[18px] rounded object-contain"
              onError={() => handleLogoError(currentWorkspace!.logoUrl!)}
            />
          ) : (
            <span className="text-[11px] font-bold">
              {currentWorkspace ? getInitials(currentWorkspace.name) : (
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </span>
          )}
        </button>

        {/* Workspace panel popup */}
        {showPanel && (
          <div ref={panelPopupRef} className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border border-[var(--app-border)] bg-white shadow-xl">
            {/* Header: Company logo + name */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-3">
                {logoVisible ? (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] overflow-hidden">
                    <Image
                      src={currentWorkspace!.logoUrl!}
                      alt={currentWorkspace!.name}
                      width={28}
                      height={28}
                      className="max-h-7 w-auto object-contain"
                      onError={() => handleLogoError(currentWorkspace!.logoUrl!)}
                    />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-sm font-bold text-[#2563EB]">
                    {currentWorkspace ? getInitials(currentWorkspace.name) : "WS"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#0F172A]">
                    {currentWorkspace?.name ?? "Workspace"}
                  </p>
                  <p className="truncate text-[11px] text-[var(--app-text-muted)]">
                    {canManage ? "Administrar miembros" : "Miembros del equipo"}
                  </p>
                </div>
                <button
                  type="button"
          onClick={() => {
            setShowPanel(false);
            setSubmenuAnchor(null);
          }}
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-bg-hover)] hover:text-[#0F172A] transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Workspace switcher select (for multiple workspaces) */}
            {workspaces.length > 1 && (
              <div className="px-4 pb-2">
                <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                  Cambiar workspace
                </p>
                <Select
                  value={selectedWorkspaceId}
                  onChange={(e) => handleWorkspaceChange(e.target.value)}
                  className="h-7 rounded-lg text-[11px] leading-none"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name} {workspace.role === "OWNER" ? "(Owner)" : ""}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Divider (only when there's content above to separate) */}
            {(workspaces.length > 1 || canManage) && (
              <div className="mx-4 border-t border-[var(--app-border)]" />
            )}

            {/* Invite section (only for managers) */}
            {canManage && (
              <div className="px-4 pt-2 pb-1">
                <div className="flex gap-1.5">
                  <input
                    id="invite-email"
                    type="email"
                    placeholder="Invitar por email..."
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value);
                      setError("");
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isInviting}
                    className="flex-1 h-8 rounded-lg border border-[var(--app-border)] px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] disabled:opacity-50 placeholder:text-[var(--app-text-subtle)]"
                  />
                  <button
                    type="button"
                    onClick={handleInvite}
                    disabled={isInviting || !inviteEmail.trim()}
                    className="inline-flex items-center h-8 rounded-lg bg-[#2563EB] px-3 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors shrink-0"
                  >
                    {isInviting ? "..." : "Invitar"}
                  </button>
                </div>
                {error && <p className="mt-1 text-[10px] text-[#EF4444] px-1">{error}</p>}
                {memberActionError && <p className="mt-1 text-[10px] text-[#EF4444] px-1">{memberActionError}</p>}
                {successMsg && <p className="mt-1 text-[10px] text-[#10B981] px-1">{successMsg}</p>}
              </div>
            )}

            {/* Divider */}
            {canManage && <div className="mx-4 my-2 border-t border-[var(--app-border)]" />}

            {/* Members list */}
            <div className="max-h-56 overflow-y-auto px-2 pb-2">
              {isLoading ? (
                <p className="px-3 py-4 text-center text-[11px] text-[var(--app-text-muted)]">Cargando...</p>
              ) : loadError ? (
                <p className="px-3 py-4 text-center text-[10px] text-[#EF4444]">{loadError}</p>
              ) : members.length === 0 ? (
                <p className="px-3 py-4 text-center text-[11px] text-[var(--app-text-muted)]">No hay miembros aún</p>
              ) : (
                <div className="space-y-0.5">
                  {/* Active members */}
                  {activeMembers.length > 0 && (
                    <>
                      <p className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                        Miembros activos
                      </p>
                      {activeMembers.map((member) => renderMemberRow({ member, currentWorkspace, panelPopupRef, setSubmenuAnchor }))}
                    </>
                  )}

                  {/* Pending members */}
                  {pendingMembers.length > 0 && (
                    <>
                      <p className="px-2.5 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-600">
                        Pendientes
                      </p>
                      {pendingMembers.map((member) => renderMemberRow({ member, currentWorkspace, panelPopupRef, setSubmenuAnchor }))}
                    </>
                  )}

                  {/* Suspended members */}
                  {suspendedMembers.length > 0 && (
                    <>
                      <p className="px-2.5 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-500">
                        Suspendidos
                      </p>
                      {suspendedMembers.map((member) => renderMemberRow({ member, currentWorkspace, panelPopupRef, setSubmenuAnchor }))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Floating submenu */}
            {targetMember && renderFloatingSubmenu({
              member: targetMember,
              submenuAnchor: submenuAnchor!,
              submenuRef,
              changingRoleId,
              removingId,
              confirmRemoveUserId,
              suspendUntil,
              setSubmenuAnchor,
              setConfirmRemoveUserId,
              setSuspendUntil,
              handleChangeRole,
              handleToggleStatus,
              handleRemoveMember,
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Member row helper ── */

interface MemberRowContext {
  member: MemberInfo;
  currentWorkspace: WorkspaceSummary | undefined;
  panelPopupRef: React.RefObject<HTMLDivElement | null>;
  setSubmenuAnchor: React.Dispatch<React.SetStateAction<{ offsetY: number; memberId: string } | null>>;
}

function renderMemberRow(ctx: MemberRowContext) {
  const { member, currentWorkspace, panelPopupRef, setSubmenuAnchor } = ctx;

  const isOwner = currentWorkspace?.role === "OWNER";
  const isSelfOwner = isOwner && member.role === "OWNER";
  const showControls = isOwner && !isSelfOwner;

  return (
    <div
      key={member.id}
      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--app-bg-hover)] group"
    >
      {/* Avatar */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[10px] font-semibold text-[#2563EB]">
        {member.userName.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-[#0F172A]">{member.userName}</span>
          <span className="shrink-0 text-[10px] text-[var(--app-text-subtle)]">{ROLE_LABEL[member.role]}</span>
        </div>
        <p className="truncate text-[10px] text-[var(--app-text-muted)]">{member.userEmail}</p>
      </div>

      {/* Controls (3-dot menu) */}
      {showControls && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const buttonRect = e.currentTarget.getBoundingClientRect();
            const popupRect = panelPopupRef.current?.getBoundingClientRect();
            if (!popupRect) return;
            const submenuEstimate = 320;
            const margin = 8;
            const maxOffsetY = Math.max(0, popupRect.height - submenuEstimate - margin);
            const offsetY = Math.max(0, Math.min(buttonRect.top - popupRect.top, maxOffsetY));
            setSubmenuAnchor((prev) =>
              prev?.memberId === member.id
                ? null
                : { offsetY, memberId: member.id },
            );
          }}
          className="inline-flex items-center justify-center h-6 w-6 rounded-md text-[var(--app-text-subtle)] opacity-0 group-hover:opacity-100 hover:bg-[var(--app-bg-hover)] hover:text-[#0F172A] transition-all shrink-0"
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ── Floating submenu ── */

function renderFloatingSubmenu(ctx: {
  member: MemberInfo;
  submenuAnchor: { offsetY: number; memberId: string };
  submenuRef: React.RefObject<HTMLDivElement | null>;
  changingRoleId: string | null;
  removingId: string | null;
  confirmRemoveUserId: string | null;
  suspendUntil: string;
  setSubmenuAnchor: React.Dispatch<React.SetStateAction<{ offsetY: number; memberId: string } | null>>;
  setConfirmRemoveUserId: (id: string | null) => void;
  setSuspendUntil: (value: string) => void;
  handleChangeRole: (userId: string, role: WorkspaceRole) => void;
  handleToggleStatus: (userId: string, status: "ACTIVE" | "SUSPENDED", suspendedUntil?: string) => void;
  handleRemoveMember: (userId: string) => void;
}) {
  const {
    member,
    submenuAnchor,
    submenuRef,
    changingRoleId,
    removingId,
    confirmRemoveUserId,
    suspendUntil,
    setSubmenuAnchor,
    setConfirmRemoveUserId,
    setSuspendUntil,
    handleChangeRole,
    handleToggleStatus,
    handleRemoveMember,
  } = ctx;

  const isBusy = changingRoleId === member.userId || removingId === member.userId;

  const close = () => {
    setSubmenuAnchor(null);
    setConfirmRemoveUserId(null);
    setSuspendUntil("");
  };

  return (
    <div
      ref={submenuRef}
      style={{
        position: "absolute",
        left: "calc(100% + 4px)",
        top: submenuAnchor.offsetY,
        zIndex: 100,
      }}
      className="w-44 rounded-xl border border-[var(--app-border)] bg-white shadow-xl py-1.5"
    >
      <p className="px-3 py-1 text-[10px] font-semibold text-[var(--app-text-muted)] uppercase tracking-wide">
        Rol
      </p>
      {(Object.keys(ROLE_LABEL) as WorkspaceRole[]).map((role) => (
        <button
          key={role}
          type="button"
          disabled={member.role === role || isBusy}
          onClick={(e) => {
            e.stopPropagation();
            handleChangeRole(member.userId, role);
          }}
          className={`w-full text-left px-3 py-1 text-[11px] transition-colors ${
            member.role === role
              ? "text-[#2563EB] font-medium bg-[#EFF6FF]"
              : "text-[#0F172A] hover:bg-[var(--app-bg-hover)]"
          } disabled:opacity-50`}
        >
          <span className="flex items-center gap-2">
            {member.role === role && (
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
          className="w-full text-left px-3 py-1 text-[11px] text-[#10B981] hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          Reactivar miembro
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={isBusy || member.status === "INVITED"}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleStatus(member.userId, "SUSPENDED", suspendUntil || undefined);
            }}
            className="w-full text-left px-3 py-1 text-[11px] text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
          >
            Suspender miembro
          </button>
          {member.status !== "INVITED" && (
            <div className="px-3 py-1">
              <input
                type="datetime-local"
                value={suspendUntil}
                onChange={(e) => setSuspendUntil(e.target.value)}
                placeholder="Hasta (opcional)"
                className="w-full rounded-md border border-[var(--app-border)] px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              />
              <p className="mt-0.5 text-[9px] text-[var(--app-text-muted)]">Fecha de reactivación</p>
            </div>
          )}
        </>
      )}

      <div className="border-t border-[var(--app-border)] my-1" />

      {confirmRemoveUserId === member.userId ? (
        <div className="px-3 py-1.5">
          <p className="text-[10px] text-[var(--app-text-muted)] leading-tight mb-2">
            ¿Remover a <span className="font-medium text-[#0F172A]">{member.userName}</span>?
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
                close();
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
            setSuspendUntil("");
          }}
          className="w-full text-left px-3 py-1 text-[11px] text-[#EF4444] hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          Remover miembro
        </button>
      )}
    </div>
  );
}
