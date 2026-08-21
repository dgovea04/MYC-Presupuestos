"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type WorkspaceMember = {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  status: string;
};

type ProjectShare = {
  id: string;
  userId: string;
  role: "VIEWER" | "EDITOR" | "ADMIN";
  user: { id: string; name: string; email: string };
};

const PROJECT_ROLE_LABELS: Record<ProjectShare["role"], string> = {
  VIEWER: "Lector",
  EDITOR: "Editor",
  ADMIN: "Admin",
};

export function ProjectSharePanel({ projectId, companyId }: { projectId: string; companyId: string }) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [shares, setShares] = useState<ProjectShare[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<ProjectShare["role"]>("VIEWER");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forbidden, setForbidden] = useState(false);

  const loadData = () => {
    setLoading(true);
    setError("");
    void Promise.all([
      fetch(`/api/projects/${projectId}/shares`, { cache: "no-store" }),
      fetch(`/api/workspaces/${companyId}/members`, { cache: "no-store" }),
    ])
      .then(async ([sharesResponse, membersResponse]) => {
        const sharesPayload: unknown = await sharesResponse.json();
        const membersPayload: unknown = await membersResponse.json();

        if (sharesResponse.status === 403 || membersResponse.status === 403) {
          setForbidden(true);
          return;
        }
        if (!sharesResponse.ok || !isSharesPayload(sharesPayload)) {
          throw new Error(readError(sharesPayload, "No se pudo cargar el acceso del proyecto"));
        }
        if (!membersResponse.ok || !isMembersPayload(membersPayload)) {
          throw new Error(readError(membersPayload, "No se pudieron cargar los miembros"));
        }

        setShares(sharesPayload.shares);
        setMembers(membersPayload.members);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo cargar el acceso del proyecto"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => loadData(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, companyId]);

  const sharedUserIds = useMemo(() => new Set(shares.map((share) => share.userId)), [shares]);
  const eligibleMembers = useMemo(
    () => members.filter((member) => member.status === "ACTIVE" && member.role !== "OWNER" && member.role !== "ADMIN" && !sharedUserIds.has(member.userId)),
    [members, sharedUserIds],
  );

  async function handleShare() {
    if (!selectedUserId || pending) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${projectId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(readError(payload, "No se pudo compartir el proyecto"));
      setSelectedUserId("");
      setSelectedRole("VIEWER");
      setNotice("Acceso otorgado.");
      loadData();
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "No se pudo compartir el proyecto");
    } finally {
      setPending(false);
    }
  }

  async function handleRevoke(userId: string) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${projectId}/shares`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(readError(payload, "No se pudo revocar el acceso"));
      setNotice("Acceso revocado.");
      loadData();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "No se pudo revocar el acceso");
    } finally {
      setPending(false);
    }
  }

  if (forbidden) {
    return null;
  }

  return (
    <Card className="theme-surface-card rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Compartir proyecto
        </CardTitle>
        <CardDescription>Otorga acceso a miembros restringidos del workspace solo para este proyecto.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="space-y-2 text-sm font-medium">
            Miembro
            <select
              className="flex h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
            >
              <option value="">Selecciona un miembro…</option>
              {eligibleMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.userName || member.userEmail} ({member.userEmail})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            Rol
            <select
              className="flex h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as ProjectShare["role"])}
            >
              {(Object.keys(PROJECT_ROLE_LABELS) as ProjectShare["role"][]).map((role) => (
                <option key={role} value={role}>
                  {PROJECT_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button type="button" className="gap-2" disabled={pending || !selectedUserId} onClick={() => void handleShare()}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Compartir
            </Button>
          </div>
        </div>

        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-[var(--app-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando acceso…
          </div>
        ) : shares.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--app-border)] px-4 py-8 text-center text-sm text-[var(--app-text-muted)]">
            Este proyecto todavía no se comparte con miembros restringidos.
          </p>
        ) : (
          <div className="space-y-3">
            {shares.map((share) => (
              <div key={share.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--app-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--app-text-strong)]">{share.user.name || share.user.email}</p>
                  <p className="truncate text-sm text-[var(--app-text-muted)]">{share.user.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700">{PROJECT_ROLE_LABELS[share.role]}</span>
                  <Button type="button" variant="ghost" className="gap-2 text-rose-600 hover:text-rose-700" disabled={pending} onClick={() => void handleRevoke(share.userId)}>
                    <Trash2 className="h-4 w-4" />
                    Revocar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function isSharesPayload(value: unknown): value is { shares: ProjectShare[] } {
  return typeof value === "object" && value !== null && "shares" in value && Array.isArray((value as { shares?: unknown }).shares);
}

function isMembersPayload(value: unknown): value is { members: WorkspaceMember[] } {
  return typeof value === "object" && value !== null && "members" in value && Array.isArray((value as { members?: unknown }).members);
}

function readError(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : fallback;
}
