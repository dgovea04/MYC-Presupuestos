"use client";

import { type KeyboardEvent as ReactKeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { InterSubBudgetParallelism, LevelLinkageMode, WorkScheduleGenerationStrategy, WorkScheduleViewRecord } from "@/types/work-schedule";
import { WORK_FRONT_PHASE_KEYWORDS, type WorkFrontPhase } from "@/lib/work-schedule/work-front-phase";
import { Field } from "./ui-elements";
import type { GenerationLevelPreviewGroup, WorkScheduleGenerationFormState } from "./types";

const PHASE_KEYWORD_FIELDS: Array<{ phase: WorkFrontPhase; label: string }> = [
  { phase: "preliminaries", label: "Preliminares" },
  { phase: "earthwork", label: "Movimiento de tierras" },
  { phase: "structure", label: "Estructura" },
  { phase: "masonry", label: "Albanileria" },
  { phase: "installations", label: "Instalaciones" },
  { phase: "finishes", label: "Acabados" },
  { phase: "testing", label: "Pruebas y entrega" },
];

export function WorkScheduleGenerationDialog({
  open,
  baseStartDate,
  formState,
  previewGroups,
  collapsedGroups,
  reviewedBudgetItemIds,
  saveState,
  error,
  hasExistingSchedule,
  reviewSummary,
  onBaseStartDateChange,
  onFormStateChange,
  onTogglePreviewGroup,
  onSetAllLevelLinkage,
  onToggleReviewedBudgetItem,
  onMarkAllReviewed,
  onClose,
  onSubmit,
}: {
  open: boolean;
  baseStartDate: string;
  formState: WorkScheduleGenerationFormState;
  previewGroups: GenerationLevelPreviewGroup[];
  collapsedGroups: Record<string, boolean>;
  reviewedBudgetItemIds: string[];
  saveState: "idle" | "saving" | "error";
  error: string;
  hasExistingSchedule: boolean;
  reviewSummary: WorkScheduleViewRecord["reviewSummary"];
  onBaseStartDateChange: (value: string) => void;
  onFormStateChange: (value: WorkScheduleGenerationFormState | ((current: WorkScheduleGenerationFormState) => WorkScheduleGenerationFormState)) => void;
  onTogglePreviewGroup: (subBudgetId: string) => void;
  onSetAllLevelLinkage: (mode: LevelLinkageMode) => void;
  onToggleReviewedBudgetItem: (budgetItemId: string) => void;
  onMarkAllReviewed: () => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content asChild>
          <div className="fixed inset-y-0 right-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-[var(--app-border)] bg-[var(--app-surface-muted)] p-5 shadow-2xl outline-none">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title asChild>
                  <h3 className="text-2xl font-semibold text-[var(--app-text-strong)]">Cronograma inteligente</h3>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                    Genera el gantt base usando metrado, rendimiento y cuadrilla, con secuencia por sub presupuesto.
                  </p>
                </Dialog.Description>
              </div>
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
            </div>

            <div className="space-y-6">
              <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
                <CardContent className="space-y-7 p-6">
                  <div className="mb-4">
                    <Field label="Fecha base">
                      <Input type="date" value={baseStartDate} onChange={(event) => onBaseStartDateChange(event.target.value)} />
                    </Field>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Estrategia base" tooltip="Secuencial: una tras otra. Por niveles: agrupa por nivel. Por similitud: agrupa por metrados.">
                      <Select value={formState.strategy} onChange={(event) => onFormStateChange((current) => ({ ...current, strategy: event.target.value as WorkScheduleGenerationStrategy }))}>
                        <option value="sequential">Secuencial</option>
                        <option value="by_level">Por niveles</option>
                        <option value="by_front">Por frentes de obra</option>
                        <option value="by_similarity">Por similitud</option>
                      </Select>
                    </Field>

                    <Field label="Especialidades" tooltip="Independientes: cada especialidad inicia sola. En paralelo: arrancan juntas. Escalonado: inician con N dias de retraso.">
                      <Select value={formState.interSubBudgetParallelism} onChange={(event) => onFormStateChange((current) => ({ ...current, interSubBudgetParallelism: event.target.value as InterSubBudgetParallelism }))}>
                        <option value="independent">Independientes</option>
                        <option value="parallel">En paralelo</option>
                        <option value="staggered">Escalonado</option>
                      </Select>
                    </Field>

                    <Field label="Duracion maxima" tooltip="Limite de dias por partida. Si excede, se divide. Vacio = sin limite.">
                      <Input inputMode="numeric" placeholder="Sin limite" value={formState.maxDurationDays} onChange={(event) => onFormStateChange((current) => ({ ...current, maxDurationDays: event.target.value }))} />
                    </Field>

                    <Field label="Separacion por similitud" tooltip="Dias entre grupos de partidas similares. Escalona bloques de trabajo parecidos.">
                      <Input inputMode="numeric" placeholder="0" value={formState.similarityLagDays} onChange={(event) => onFormStateChange((current) => ({ ...current, similarityLagDays: event.target.value }))} />
                    </Field>
                  </div>

                  {formState.interSubBudgetParallelism === "staggered" ? (
                    <Field label="Escalonado" tooltip="Dias de retraso entre especialidades. La primera inicia en la fecha base.">
                      <Input inputMode="numeric" placeholder="0" value={formState.interSubBudgetStaggerDays} onChange={(event) => onFormStateChange((current) => ({ ...current, interSubBudgetStaggerDays: event.target.value }))} />
                    </Field>
                  ) : null}

                  {formState.strategy === "by_front" ? (
                    <div className="col-span-full space-y-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
                      <div>
                        <p className="text-sm font-semibold text-[var(--app-text-strong)]">Palabras clave por fase</p>
                        <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                          Personaliza las palabras clave (separadas por coma) usadas para clasificar las partidas en la estrategia por frentes.
                        </p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {PHASE_KEYWORD_FIELDS.map((field) => (
                          <Field key={field.phase} label={field.label}>
                            <Input
                              placeholder={WORK_FRONT_PHASE_KEYWORDS[field.phase].join(", ")}
                              value={formState.customPhaseKeywords[field.phase] ?? ""}
                              onChange={(event) =>
                                onFormStateChange((current) => ({
                                  ...current,
                                  customPhaseKeywords: {
                                    ...current.customPhaseKeywords,
                                    [field.phase]: event.target.value,
                                  },
                                }))
                              }
                            />
                          </Field>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {hasExistingSchedule ? (
                    <div className="theme-status-warning theme-status-warning-strong rounded-2xl border px-4 py-3 text-sm">
                      Se reemplazara la programacion actual de las partidas ya programadas.
                    </div>
                  ) : null}

                  {previewGroups.length > 0 ? (
                    <div className="space-y-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--app-text-strong)]">Previsualizacion de niveles</p>
                          <p className="mt-1 text-xs text-[var(--app-text-muted)]">Define si cada titulo o subtitulo debe ejecutarse en paralelo o encadenado.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="inline-flex items-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--app-text-muted)] transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700" onClick={() => onSetAllLevelLinkage("parallel")}>Todo paralelo</button>
                          <button type="button" className="inline-flex items-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--app-text-muted)] transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700" onClick={() => onSetAllLevelLinkage("chain")}>Todo encadenar</button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {previewGroups.map((group) => {
                          const collapsed = collapsedGroups[group.subBudgetId] === true;
                          return (
                            <div key={group.subBudgetId} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
                              <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => onTogglePreviewGroup(group.subBudgetId)}>
                                <span className="text-sm font-semibold text-[var(--app-text-strong)]">{group.subBudgetName} ({group.levels.length})</span>
                                <span className="text-xs text-[var(--app-text-muted)]">{collapsed ? "Expandir" : "Ocultar"}</span>
                              </button>
                              {!collapsed ? (
                                <div className="space-y-2 border-t border-[var(--app-border)] px-4 py-3">
                                  {group.levels.map((level) => {
                                    const linkageMode = formState.levelLinkage[level.levelId] ?? "parallel";
                                    return (
                                      <div key={level.levelId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] px-3 py-2">
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-medium text-[var(--app-text-strong)]">{`${level.itemCode}: ${level.description}`}</p>
                                          <p className="text-xs text-[var(--app-text-muted)]">{level.levelType === "TITLE" ? "Titulo" : "Subtitulo"}</p>
                                        </div>
                                        <button type="button" className="inline-flex items-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--app-text-muted)] transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700" onClick={() => onFormStateChange((current) => ({ ...current, levelLinkage: { ...current.levelLinkage, [level.levelId]: linkageMode === "parallel" ? "chain" : "parallel" } }))}>
                                          {linkageMode === "parallel" ? "Paralelo" : "Encadenar"}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {reviewSummary && reviewSummary.warnings.length > 0 ? (
                    <div className="theme-status-warning theme-status-warning-strong space-y-2 rounded-2xl border px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold">Revision previa recomendada</p>
                        {reviewSummary.warnings.flatMap((w) => w.examples).some((e) => !reviewedBudgetItemIds.includes(e.budgetItemId)) ? (
                          <button type="button" className="inline-flex shrink-0 items-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-[10px] font-medium text-[var(--app-text-muted)] transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700" onClick={onMarkAllReviewed}>Marcar todos como revisados</button>
                        ) : null}
                      </div>
                      {reviewSummary.warnings.map((warning) => (
                        <div key={warning.code} className="space-y-1">
                          <p className="text-xs">{warning.label}</p>
                          <p className="theme-muted-text text-[10px]">{warning.count} partidas afectadas.</p>
                          {warning.examples.length > 0 ? (
                            <div className="space-y-1.5 pt-1">
                              {warning.examples.map((example) => {
                                const reviewed = reviewedBudgetItemIds.includes(example.budgetItemId);
                                return (
                                  <div key={example.budgetItemId} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1">
                                    <span className="min-w-0 truncate text-[11px] text-[var(--app-text-strong)]">{`${example.itemCode}: ${example.description}`}</span>
                                    <button type="button" className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${reviewed ? "border-sky-300 bg-sky-100 text-sky-700 hover:border-sky-400 hover:bg-sky-200" : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"}`} onClick={() => onToggleReviewedBudgetItem(example.budgetItemId)}>
                                      {reviewed ? "Revisada" : "Marcar como revisada"}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={onSubmit} disabled={saveState === "saving" || !baseStartDate}>{saveState === "saving" ? "Generando..." : "Generar base"}</Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
