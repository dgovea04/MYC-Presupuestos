"use client";

import { useEffect, useState } from "react";
import { Ban, CalendarDays, Calendar, Clock, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { countBits, formatWorkDaysLabel } from "@/lib/work-schedule/calendar";
import { cn } from "@/lib/utils";

type WorkCalendarItem = {
  id: string;
  name: string;
  workDays: number;
  workHoursPerDay: number;
};

type ExceptionItem = {
  id: string;
  workCalendarId: string;
  date: string;
  type: "HOLIDAY" | "WORK_DAY";
  description: string | null;
};

const DAY_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  HOLIDAY: "Feriado / No laborable",
  WORK_DAY: "Dia laborable extra",
};

export function WorkCalendarsSettings({ initialCalendars }: { initialCalendars?: WorkCalendarItem[] }) {
  const [calendars, setCalendars] = useState<WorkCalendarItem[]>(initialCalendars ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [editingWorkDays, setEditingWorkDays] = useState(31);
  const [editingWorkHoursPerDay, setEditingWorkHoursPerDay] = useState("8");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void loadCalendars();
  }, []);

  async function loadCalendars() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/work-calendars");
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? "No se pudieron cargar los calendarios");
      }
      setCalendars(await response.json() as WorkCalendarItem[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }

  function startCreating() {
    setCreating(true);
    setEditingId(null);
    setEditingName("");
    setEditingWorkDays(31);
    setEditingWorkHoursPerDay("8");
  }

  function startEditing(calendar: WorkCalendarItem) {
    setCreating(false);
    setEditingId(calendar.id);
    setEditingName(calendar.name);
    setEditingWorkDays(calendar.workDays);
    setEditingWorkHoursPerDay(String(calendar.workHoursPerDay));
  }

  function cancelEditing() {
    setCreating(false);
    setEditingId(null);
    setEditingName("");
    setEditingWorkDays(31);
    setEditingWorkHoursPerDay("8");
  }

  function toggleDay(index: number) {
    setEditingWorkDays((current) => current ^ (1 << index));
  }

  async function handleSave() {
    const name = editingName.trim();
    if (!name) {
      setError("El nombre del calendario es requerido");
      return;
    }

    const hours = parseFloat(editingWorkHoursPerDay);
    if (isNaN(hours) || hours < 0.5 || hours > 24) {
      setError("Horas por dia debe ser entre 0.5 y 24");
      return;
    }

    if (editingWorkDays === 0) {
      setError("Selecciona al menos un dia laborable");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (editingId) {
        const response = await fetch(`/api/work-calendars?id=${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            workDays: editingWorkDays,
            workHoursPerDay: hours,
          }),
        });
        if (!response.ok) {
          const payload = await response.json() as { error?: string };
          throw new Error(payload.error ?? "Error al actualizar");
        }
      } else {
        const response = await fetch("/api/work-calendars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            workDays: editingWorkDays,
            workHoursPerDay: hours,
          }),
        });
        if (!response.ok) {
          const payload = await response.json() as { error?: string };
          throw new Error(payload.error ?? "Error al crear");
        }
      }

      cancelEditing();
      await loadCalendars();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError("");
    setConfirmDeleteId(null);

    try {
      const response = await fetch(`/api/work-calendars?id=${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? "Error al eliminar");
      }
      await loadCalendars();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  const isEditing = creating || editingId !== null;

  // Exceptions state
  const [expandedCalendarId, setExpandedCalendarId] = useState<string | null>(null);
  const [exceptionsByCalendar, setExceptionsByCalendar] = useState<Record<string, ExceptionItem[]>>({});
  const [exceptionsLoading, setExceptionsLoading] = useState(false);
  const [exceptionAdding, setExceptionAdding] = useState(false);
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionType, setExceptionType] = useState<"HOLIDAY" | "WORK_DAY">("HOLIDAY");
  const [exceptionDescription, setExceptionDescription] = useState("");
  const [exceptionSaving, setExceptionSaving] = useState(false);
  const [exceptionDeletingId, setExceptionDeletingId] = useState<string | null>(null);

  async function toggleExceptions(calendarId: string) {
    if (expandedCalendarId === calendarId) {
      setExpandedCalendarId(null);
      return;
    }

    setExpandedCalendarId(calendarId);

    if (!exceptionsByCalendar[calendarId]) {
      setExceptionsLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/work-calendars/exceptions?workCalendarId=${calendarId}`);
        if (!response.ok) {
          const payload = await response.json() as { error?: string };
          throw new Error(payload.error ?? "No se pudieron cargar las excepciones");
        }
        setExceptionsByCalendar((prev) => ({
          ...prev,
          [calendarId]: await response.json() as ExceptionItem[],
        }));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Error al cargar excepciones");
      } finally {
        setExceptionsLoading(false);
      }
    }
  }

  function startAddingException() {
    setExceptionAdding(true);
    setExceptionDate("");
    setExceptionType("HOLIDAY");
    setExceptionDescription("");
  }

  function cancelAddingException() {
    setExceptionAdding(false);
    setExceptionDate("");
    setExceptionDescription("");
  }

  async function handleSaveException() {
    if (!expandedCalendarId) return;
    if (!exceptionDate) {
      setError("Selecciona una fecha");
      return;
    }

    setExceptionSaving(true);
    setError("");

    try {
      const response = await fetch("/api/work-calendars/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workCalendarId: expandedCalendarId,
          date: exceptionDate,
          type: exceptionType,
          description: exceptionDescription.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? "Error al crear excepcion");
      }

      cancelAddingException();
      // Reload exceptions
      const reloadResponse = await fetch(`/api/work-calendars/exceptions?workCalendarId=${expandedCalendarId}`);
      if (reloadResponse.ok) {
        setExceptionsByCalendar((prev) => ({
          ...prev,
          [expandedCalendarId]: await reloadResponse.json() as ExceptionItem[],
        }));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error al guardar excepcion");
    } finally {
      setExceptionSaving(false);
    }
  }

  async function handleDeleteException(exceptionId: string) {
    if (!expandedCalendarId) return;
    setExceptionDeletingId(exceptionId);
    setError("");

    try {
      const response = await fetch(`/api/work-calendars/exceptions?id=${exceptionId}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? "Error al eliminar excepcion");
      }

      // Reload exceptions
      const reloadResponse = await fetch(`/api/work-calendars/exceptions?workCalendarId=${expandedCalendarId}`);
      if (reloadResponse.ok) {
        setExceptionsByCalendar((prev) => ({
          ...prev,
          [expandedCalendarId]: await reloadResponse.json() as ExceptionItem[],
        }));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error al eliminar excepcion");
    } finally {
      setExceptionDeletingId(null);
    }
  }

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[var(--app-primary-muted)] p-2 text-[var(--app-text-strong)]">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Calendarios laborales</CardTitle>
              <CardDescription>
                Define calendarios personalizados con los dias y horas laborables. Asignalos a tus proyectos desde el formulario de creacion o edicion.
              </CardDescription>
            </div>
          </div>
          {!isEditing ? (
            <Button
              type="button"
              onClick={startCreating}
              disabled={loading}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Crear calendario
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--app-text-subtle)]" />
          </div>
        ) : (
          <div className="space-y-3">
            {calendars.map((calendar) => {
              const isEditingThis = editingId === calendar.id;
              const isDeletingThis = deletingId === calendar.id;

              if (isEditingThis) {
                return (
                  <CalendarEditCard
                    key={calendar.id}
                    name={editingName}
                    workDays={editingWorkDays}
                    workHoursPerDay={editingWorkHoursPerDay}
                    saving={saving}
                    isCreating={false}
                    onNameChange={setEditingName}
                    onToggleDay={toggleDay}
                    onHoursChange={setEditingWorkHoursPerDay}
                    onSave={() => void handleSave()}
                    onCancel={cancelEditing}
                  />
                );
              }

              return (
                <div
                  key={calendar.id}
                  className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--app-text-strong)]">{calendar.name}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-muted)]">
                        <span>{formatWorkDaysLabel(calendar.workDays)}</span>
                        <span className="text-[var(--app-border-strong)]">|</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {calendar.workHoursPerDay}h / dia
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {DAY_LABELS.map((label, index) => (
                          <span
                            key={index}
                            className={cn(
                              "inline-flex h-6 w-7 items-center justify-center rounded-md text-[10px] font-semibold",
                              (calendar.workDays & (1 << index)) !== 0
                                ? "bg-[var(--app-primary-muted)] text-[var(--app-primary-strong)]"
                                : "border border-[var(--app-border-soft)] bg-[var(--app-surface)] text-[var(--app-text-subtle)]",
                            )}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void toggleExceptions(calendar.id)}
                        disabled={isEditing || deletingId !== null}
                        className="h-8 text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]"
                        title="Excepciones"
                      >
                        <CalendarDays className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(calendar)}
                        disabled={isEditing || deletingId !== null}
                        className="h-8 text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {confirmDeleteId === calendar.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-8 text-xs text-[var(--app-text-muted)]"
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={() => void handleDelete(calendar.id)}
                            disabled={isDeletingThis}
                            className="h-8 bg-rose-600 text-xs hover:bg-rose-700"
                          >
                            {isDeletingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : "Eliminar"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(calendar.id)}
                          disabled={isEditing || deletingId !== null}
                          className="h-8 text-[var(--app-text-muted)] hover:text-rose-600"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {expandedCalendarId === calendar.id ? (
                    <div className="mt-4 border-t border-[var(--app-border-soft)] pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[var(--app-text-strong)]">
                          Excepciones ({exceptionsByCalendar[calendar.id]?.length ?? 0})
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={startAddingException}
                          disabled={exceptionAdding || exceptionSaving}
                          className="h-7 gap-1 text-xs"
                        >
                          <Plus className="h-3 w-3" />
                          Agregar
                        </Button>
                      </div>

                      {exceptionsLoading ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-[var(--app-text-subtle)]" />
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1.5">
                          {(exceptionsByCalendar[calendar.id] ?? []).map((exc) => (
                            <div
                              key={exc.id}
                              className="flex items-center justify-between gap-2 rounded-lg bg-[var(--app-surface)] px-3 py-1.5"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {exc.type === "HOLIDAY" ? (
                                  <Ban className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                                ) : (
                                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                )}
                                <span className="text-xs font-medium text-[var(--app-text-strong)]">
                                  {exc.date}
                                </span>
                                <span className="text-[10px] text-[var(--app-text-muted)]">
                                  {EXCEPTION_TYPE_LABELS[exc.type] ?? exc.type}
                                </span>
                                {exc.description ? (
                                  <span className="truncate text-[10px] text-[var(--app-text-subtle)]">
                                    {exc.description}
                                  </span>
                                ) : null}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleDeleteException(exc.id)}
                                disabled={exceptionDeletingId === exc.id}
                                className="h-6 w-6 shrink-0 p-0 text-[var(--app-text-muted)] hover:text-rose-600"
                                title="Eliminar"
                              >
                                {exceptionDeletingId === exc.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {exceptionAdding ? (
                        <div className="mt-2 rounded-xl border border-sky-200 bg-[var(--app-surface)] p-3 dark:border-sky-500/30">
                          <div className="flex flex-wrap gap-2">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-medium text-[var(--app-text-muted)]">Fecha</label>
                              <Input
                                type="date"
                                value={exceptionDate}
                                onChange={(event) => setExceptionDate(event.target.value)}
                                className="h-8 w-36 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[10px] font-medium text-[var(--app-text-muted)]">Tipo</label>
                              <select
                                value={exceptionType}
                                onChange={(event) => setExceptionType(event.target.value as "HOLIDAY" | "WORK_DAY")}
                                className="h-8 rounded-lg border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-2 text-xs"
                              >
                                <option value="HOLIDAY">Feriado</option>
                                <option value="WORK_DAY">Dia extra</option>
                              </select>
                            </div>
                            <div className="flex-1 space-y-1">
                              <label className="block text-[10px] font-medium text-[var(--app-text-muted)]">Descripcion</label>
                              <Input
                                value={exceptionDescription}
                                onChange={(event) => setExceptionDescription(event.target.value)}
                                placeholder="Ej: Navidad"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleSaveException()}
                              disabled={exceptionSaving || !exceptionDate}
                              className="h-7 gap-1 text-xs"
                            >
                              {exceptionSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              Guardar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={cancelAddingException}
                              disabled={exceptionSaving}
                              className="h-7 text-xs"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {!isEditing && calendars.length === 0 ? (
              <div className="theme-status-info theme-status-info-strong rounded-2xl border px-4 py-8 text-center">
                <p className="text-sm font-medium">Sin calendarios personalizados</p>
                <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                  Crea tu primer calendario laboral para asignarlo a tus proyectos.
                </p>
              </div>
            ) : null}

            {creating ? (
              <CalendarEditCard
                name={editingName}
                workDays={editingWorkDays}
                workHoursPerDay={editingWorkHoursPerDay}
                saving={saving}
                isCreating
                onNameChange={setEditingName}
                onToggleDay={toggleDay}
                onHoursChange={setEditingWorkHoursPerDay}
                onSave={() => void handleSave()}
                onCancel={cancelEditing}
              />
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CalendarEditCard({
  name,
  workDays,
  workHoursPerDay,
  saving,
  isCreating,
  onNameChange,
  onToggleDay,
  onHoursChange,
  onSave,
  onCancel,
}: {
  name: string;
  workDays: number;
  workHoursPerDay: string;
  saving: boolean;
  isCreating: boolean;
  onNameChange: (value: string) => void;
  onToggleDay: (index: number) => void;
  onHoursChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const activeDaysCount = countBits(workDays);

  return (
    <div className="rounded-2xl border-2 border-sky-200 bg-[var(--app-surface)] p-4 dark:border-sky-500/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--app-text-strong)]">
          {isCreating ? "Nuevo calendario" : "Editar calendario"}
        </p>
      </div>

      <div className="mt-3 space-y-2">
        <label className="block text-xs font-medium text-[var(--app-text-muted)]">
          Nombre
        </label>
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Ej: Lun-Vie 8h"
          autoFocus
        />
      </div>

      <div className="mt-3 space-y-2">
        <label className="block text-xs font-medium text-[var(--app-text-muted)]">
          Dias laborables ({activeDaysCount} de 7)
        </label>
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((label, index) => {
            const isActive = (workDays & (1 << index)) !== 0;

            return (
              <button
                key={index}
                type="button"
                onClick={() => onToggleDay(index)}
                className={cn(
                  "flex h-10 w-11 items-center justify-center rounded-xl border text-sm font-semibold transition",
                  isActive
                    ? "border-sky-300 bg-sky-50 text-sky-700 shadow-sm dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-300"
                    : "border-[var(--app-border-soft)] bg-[var(--app-surface-muted)] text-[var(--app-text-subtle)] hover:border-[var(--app-border)] hover:text-[var(--app-text-muted)]",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <label className="block text-xs font-medium text-[var(--app-text-muted)]">
          Horas por dia
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min="0.5"
            max="24"
            step="0.5"
            value={workHoursPerDay}
            onChange={(event) => onHoursChange(event.target.value)}
            className="w-24"
          />
          <span className="text-xs text-[var(--app-text-muted)]">h/dia</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isCreating ? "Crear" : "Guardar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}


