"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Loader2, MessageSquarePlus, StickyNote, Trash2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { NoteTaskPriority, NoteTaskRecord } from "@/types/notes";

const OPEN_NOTE_DRAFT_EVENT = "myc:open-note-draft";

export type NoteDraftContext = {
  projectId?: string;
  budgetId?: string;
  budgetItemId?: string;
  budgetItemCode?: string;
  budgetItemDescription?: string;
  sourcePath?: string;
  initialBody?: string;
};

export function openNoteDraft(context: NoteDraftContext = {}) {
  window.dispatchEvent(new CustomEvent<NoteDraftContext>(OPEN_NOTE_DRAFT_EVENT, { detail: context }));
}

export function NotesDrawer() {
  const pathname = usePathname() ?? "/dashboard";
  const router = useRouter();
  const { isExcelMode } = useAppViewMode();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<NoteTaskRecord[]>([]);
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<NoteTaskPriority>("MEDIUM");
  const [draftContext, setDraftContext] = useState<NoteDraftContext>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const effectiveSourcePath = draftContext.sourcePath ?? pathname;

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/notes?status=OPEN");
      const payload = (await response.json()) as { notes?: NoteTaskRecord[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudieron cargar las notas");
      }
      setNotes(payload.notes ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las notas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    function handleOpenDraft(event: Event) {
      const detail = (event as CustomEvent<NoteDraftContext>).detail ?? {};
      setDraftContext(detail);
      setBody(detail.initialBody ?? "");
      setPriority("MEDIUM");
      setOpen(true);
      void loadNotes();
    }

    window.addEventListener(OPEN_NOTE_DRAFT_EVENT, handleOpenDraft as EventListener);
    return () => window.removeEventListener(OPEN_NOTE_DRAFT_EVENT, handleOpenDraft as EventListener);
  }, [loadNotes]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        void loadNotes();
      }
    },
    [loadNotes],
  );

  const contextualNotes = useMemo(
    () =>
      notes.filter(
        (note) =>
          note.sourcePath === pathname ||
          (draftContext.budgetItemId && note.budgetItemId === draftContext.budgetItemId) ||
          (draftContext.budgetId && note.budgetId === draftContext.budgetId) ||
          (draftContext.projectId && note.projectId === draftContext.projectId),
      ),
    [draftContext.budgetId, draftContext.budgetItemId, draftContext.projectId, notes, pathname],
  );
  const generalNotes = useMemo(
    () => notes.filter((note) => !contextualNotes.some((contextualNote) => contextualNote.id === note.id)),
    [contextualNotes, notes],
  );

  async function createNote() {
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError("Ingresa una nota");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmedBody,
          priority,
          sourcePath: effectiveSourcePath,
          projectId: draftContext.projectId,
          budgetId: draftContext.budgetId,
          budgetItemId: draftContext.budgetItemId,
        }),
      });
      const payload = (await response.json()) as { note?: NoteTaskRecord; error?: string };
      if (!response.ok || !payload.note) {
        throw new Error(payload.error ?? "No se pudo crear la nota");
      }

      setNotes((current) => [payload.note!, ...current]);
      setBody("");
      setDraftContext({});
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear la nota");
    } finally {
      setSaving(false);
    }
  }

  async function updateNoteStatus(note: NoteTaskRecord, status: "OPEN" | "RESOLVED") {
    setError("");
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as { note?: NoteTaskRecord; error?: string };
      if (!response.ok || !payload.note) {
        throw new Error(payload.error ?? "No se pudo actualizar la nota");
      }

      setNotes((current) =>
        status === "RESOLVED" ? current.filter((candidate) => candidate.id !== note.id) : current.map((candidate) => (candidate.id === note.id ? payload.note! : candidate)),
      );
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo actualizar la nota");
    }
  }

  async function deleteNote(note: NoteTaskRecord) {
    setError("");
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "No se pudo eliminar la nota");
      }

      setNotes((current) => current.filter((candidate) => candidate.id !== note.id));
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la nota");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <StickyNote className="h-4 w-4" />
          Notas
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={cn("fixed inset-0 z-50 bg-slate-950/30", isExcelMode ? "backdrop-blur-0" : "backdrop-blur-sm")} />
        <Dialog.Content
          asChild
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeButtonRef.current?.focus();
          }}
        >
          <aside
            className={cn(
              "theme-surface-card fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-xl flex-col border-l p-5 outline-none",
              isExcelMode ? "border-[var(--table-border-strong)] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.16)]" : "border-[var(--app-border)] shadow-2xl",
            )}
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="theme-muted-text text-sm">Pendientes operativos</p>
                <Dialog.Title className="theme-strong-text text-2xl font-semibold">Sticky notes</Dialog.Title>
                <Dialog.Description className="theme-muted-text mt-1 text-sm">
                  Crea notas rapidas y conviertelas en pendientes visibles en el dashboard.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button ref={closeButtonRef} variant="outline" size="sm" className="gap-2">
                  <X className="h-4 w-4" />
                  Cerrar
                </Button>
              </Dialog.Close>
            </header>

            <section className="theme-surface-card mt-5 rounded-2xl border p-4 shadow-sm shadow-slate-100/70">
              <div className="theme-strong-text flex items-center gap-2 text-sm font-semibold">
                <MessageSquarePlus className="h-4 w-4 text-sky-600" />
                Nueva nota
              </div>
              {draftContext.budgetItemId ? (
                <div className="theme-status-warning theme-status-warning-strong mt-3 rounded-xl border px-3 py-2 text-sm">
                  <p className="font-medium">{draftContext.budgetItemCode ?? "Partida seleccionada"}</p>
                  {draftContext.budgetItemDescription ? <p className="mt-1">{draftContext.budgetItemDescription}</p> : null}
                </div>
              ) : null}
              <div className="mt-3 space-y-3">
                <Textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Escribe una nota breve..."
                  className="min-h-28"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Select value={priority} onChange={(event) => setPriority(event.target.value as NoteTaskPriority)} className="sm:w-44">
                    <option value="HIGH">Alta</option>
                    <option value="MEDIUM">Media</option>
                    <option value="LOW">Baja</option>
                  </Select>
                  <Button type="button" onClick={() => void createNote()} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />}
                    Crear nota
                  </Button>
                </div>
              </div>
            </section>

            {error ? <p className="theme-status-error mt-4 rounded-xl border px-3 py-2 text-sm">{error}</p> : null}

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
              {loading ? (
                <div className="theme-surface-card theme-muted-text flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando notas...
                </div>
              ) : notes.length === 0 ? (
                <div className="theme-dashed-panel theme-muted-text rounded-2xl border border-dashed px-4 py-6 text-sm">
                  <p className="theme-strong-text font-medium">Sin notas abiertas</p>
                  <p className="mt-1">Crea una nota para verla en pendientes por atender.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <NoteList title="Contexto actual" notes={contextualNotes} onResolve={updateNoteStatus} onDelete={deleteNote} />
                  <NoteList title="Otros pendientes" notes={generalNotes} onResolve={updateNoteStatus} onDelete={deleteNote} />
                </div>
              )}
            </div>
          </aside>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NoteList({
  title,
  notes,
  onResolve,
  onDelete,
}: {
  title: string;
  notes: NoteTaskRecord[];
  onResolve: (note: NoteTaskRecord, status: "RESOLVED") => Promise<void>;
  onDelete: (note: NoteTaskRecord) => Promise<void>;
}) {
  if (notes.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <p className="theme-muted-text text-xs font-semibold uppercase tracking-wide">{title}</p>
      {notes.map((note) => (
        <article key={note.id} className="theme-surface-card rounded-2xl border p-4 shadow-sm shadow-slate-100/70">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="theme-strong-text whitespace-pre-wrap text-sm font-medium">{note.body}</p>
              <p className="theme-muted-text mt-2 text-xs">{getNoteContextLabel(note)}</p>
            </div>
            <span className={cn("rounded-full px-2 py-1 text-[11px] font-semibold", getPriorityClassName(note.priority))}>
              {getPriorityLabel(note.priority)}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void onResolve(note, "RESOLVED")}>
              <Check className="h-4 w-4" />
              Resolver
            </Button>
            <Button type="button" variant="ghost" size="sm" className="gap-2 text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10" onClick={() => void onDelete(note)}>
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}

function getNoteContextLabel(note: NoteTaskRecord) {
  if (note.budgetItemCode || note.budgetItemDescription) {
    return [note.budgetItemCode, note.budgetItemDescription].filter(Boolean).join(" - ");
  }

  return note.budgetName ?? note.projectName ?? "Nota general";
}

function getPriorityLabel(priority: NoteTaskPriority) {
  if (priority === "HIGH") return "Alta";
  if (priority === "MEDIUM") return "Media";
  return "Baja";
}

function getPriorityClassName(priority: NoteTaskPriority) {
  if (priority === "HIGH") return "theme-status-error";
  if (priority === "MEDIUM") return "theme-status-warning";
  return "theme-badge-slate";
}
