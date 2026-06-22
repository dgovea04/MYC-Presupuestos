"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, GitCompareArrows, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { formatCurrency } from "@/lib/utils";
import type { CatalogPartidaRecord, PartidaApuRowRecord } from "@/types/partida";
import type { PartidaGenerationSaveResult, PartidaGenerationSearchResult, SimilarPartidaResult, SuggestedInsumo } from "@/types/partida-generation";
import type { ResourceRecord } from "@/types/resource";

type CandidateSelection = {
  partida: CatalogPartidaRecord;
  score: number;
  isPrimary: boolean;
};

type EditableSuggestedInsumo = SuggestedInsumo & {
  finalCrew: number | null;
  finalQuantity: number;
  finalUnitPrice: number;
  included: boolean;
};

type ApuGroupKey = "LABOR" | "MATERIAL" | "EQUIPMENT" | "SUBPARTIDA";

const APU_GROUPS: Array<{ key: ApuGroupKey; label: string }> = [
  { key: "LABOR", label: "Mano de Obra" },
  { key: "MATERIAL", label: "Materiales" },
  { key: "EQUIPMENT", label: "Equipos" },
  { key: "SUBPARTIDA", label: "Subpartidas" },
];

export function PartidaSimilarityGeneratorPageContent({
  partidas,
  resourcesCatalog,
  initialSourceText = "",
  initialUnit = "",
  initialGeneratedName = "",
}: {
  partidas: CatalogPartidaRecord[];
  resourcesCatalog: ResourceRecord[];
  initialSourceText?: string;
  initialUnit?: string;
  initialGeneratedName?: string;
}) {
  const router = useRouter();
  const { isExcelMode } = useAppViewMode();
  const [sourceText, setSourceText] = useState(initialSourceText);
  const [unit, setUnit] = useState(initialUnit);
  const [generatedName, setGeneratedName] = useState(initialGeneratedName || initialSourceText);
  const [performance, setPerformance] = useState(1);
  const [manualFilter, setManualFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [searchResult, setSearchResult] = useState<PartidaGenerationSearchResult | null>(null);
  const [selectedSources, setSelectedSources] = useState<CandidateSelection[]>([]);
  const [suggestedInsumos, setSuggestedInsumos] = useState<EditableSuggestedInsumo[]>([]);
  const [loadingState, setLoadingState] = useState<"idle" | "searching" | "aggregating" | "saving">("idle");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [maxVisibleStep, setMaxVisibleStep] = useState(1);

  const selectedIds = useMemo(() => new Set(selectedSources.map((source) => source.partida.id)), [selectedSources]);
  const primarySource = selectedSources.find((source) => source.isPrimary) ?? null;
  const includedInsumos = suggestedInsumos.filter((insumo) => insumo.included);
  const bestScore = selectedSources.reduce((max, source) => Math.max(max, source.score), 0);
  const finalTotal = includedInsumos.reduce((sum, insumo) => sum + insumo.finalQuantity * insumo.finalUnitPrice, 0);
  const suggestedPerformance = useMemo(() => calculateSuggestedPerformance(selectedSources), [selectedSources]);

  const manualMatches = useMemo(() => {
    const query = manualFilter.trim().toLowerCase();
    if (!query) return [];

    return partidas
      .filter((partida) => !selectedIds.has(partida.id))
      .filter((partida) => `${partida.description} ${partida.unit}`.toLowerCase().includes(query))
      .slice(0, 6);
  }, [manualFilter, partidas, selectedIds]);

  const resourceMatches = useMemo(() => {
    const query = resourceFilter.trim().toLowerCase();
    if (!query) return [];

    return resourcesCatalog
      .filter((resource) => `${resource.code} ${resource.description} ${resource.unit} ${resource.category}`.toLowerCase().includes(query))
      .slice(0, 6);
  }, [resourceFilter, resourcesCatalog]);

  async function searchCandidates() {
    if (!sourceText.trim()) {
      setError("Ingresa una descripcion para buscar partidas similares.");
      return;
    }

    setLoadingState("searching");
    setError("");
    setFeedback("");
    setSuggestedInsumos([]);
    setMaxVisibleStep(1);

    try {
      const response = await fetch("/api/partidas/similarity/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText, unit: unit || undefined, limit: 10 }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(readErrorMessage(payload, "No se pudieron buscar partidas similares."));
      }

      const result = (await response.json()) as PartidaGenerationSearchResult;
      const initialSources = result.candidates
        .filter((candidate) => candidate.score >= 0.5)
        .slice(0, 3)
        .map((candidate, index) => ({
          partida: candidate.partida,
          score: candidate.score,
          isPrimary: index === 0,
        }));

      const nextSources = initialSources.length ? initialSources : result.candidates.slice(0, 1).map((candidate) => ({
        partida: candidate.partida,
        score: candidate.score,
        isPrimary: true,
      }));

      setSearchResult(result);
      setSelectedSources(nextSources);
      setPerformance(calculateSuggestedPerformance(nextSources));
      setGeneratedName((current) => current || sourceText);
      setUnit((current) => current || result.candidates[0]?.partida.unit || "");
      revealStep(2);
      setFeedback(`${result.candidates.length} candidatas encontradas. Revisa la seleccion antes de agregar insumos.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudieron buscar partidas similares.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function aggregateInsumos() {
    if (!selectedSources.length) {
      setError("Selecciona al menos una partida fuente.");
      return;
    }

    setLoadingState("aggregating");
    setError("");
    setFeedback("");

    try {
      const response = await fetch("/api/partidas/similarity/aggregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedSources: selectedSources.map((source) => ({
            partidaId: source.partida.id,
            score: source.score,
            isPrimary: source.isPrimary,
          })),
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(readErrorMessage(payload, "No se pudieron agregar los insumos."));
      }

      const suggestions = (await response.json()) as SuggestedInsumo[];
      setSuggestedInsumos(suggestions.map((suggestion) => ({
        ...suggestion,
        finalCrew: suggestion.suggestedCrew,
        finalQuantity: suggestion.suggestedQuantity,
        finalUnitPrice: suggestion.unitPrice ?? 0,
        included: suggestion.confidenceLevel !== "optional",
      })));
      revealStep(3);
      setFeedback(`${suggestions.length} insumos sugeridos listos para revisar.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudieron agregar los insumos.");
    } finally {
      setLoadingState("idle");
    }
  }

  async function saveGeneratedPartida() {
    if (!generatedName.trim() || !unit.trim()) {
      setError("Completa nombre generado y unidad antes de guardar.");
      return;
    }

    setLoadingState("saving");
    setError("");
    setFeedback("");

    try {
      const response = await fetch("/api/partidas/similarity/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText,
          generatedName,
          unit,
          performance,
          similarityScore: bestScore,
          selectedSources: selectedSources.map((source) => ({
            partidaId: source.partida.id,
            score: source.score,
            isPrimary: source.isPrimary,
          })),
          insumos: includedInsumos.map((insumo) => ({
            resourceId: insumo.resourceId,
            description: insumo.description,
            unit: insumo.unit,
            resourceType: insumo.resourceType,
            suggestedCrew: insumo.suggestedCrew,
            finalCrew: insumo.finalCrew,
            suggestedQuantity: insumo.suggestedQuantity,
            finalQuantity: insumo.finalQuantity,
            unitPrice: insumo.finalUnitPrice,
            confidence: insumo.frequency,
            confidenceLevel: insumo.confidenceLevel,
            calculationMethod: insumo.calculationMethod,
            sourcePartidaIds: insumo.sourcePartidaIds,
            statistics: insumo.statistics,
          })),
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(readErrorMessage(payload, "No se pudo guardar la partida generada."));
      }

      const result = (await response.json()) as PartidaGenerationSaveResult;
      setFeedback(`Partida guardada: ${result.catalogPartida.description}`);
      router.push("/partidas");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo guardar la partida generada.");
    } finally {
      setLoadingState("idle");
    }
  }

  function toggleCandidate(candidate: SimilarPartidaResult) {
    setSelectedSources((current) => {
      if (current.some((source) => source.partida.id === candidate.partida.id)) {
        const nextSources = ensurePrimarySource(current.filter((source) => source.partida.id !== candidate.partida.id));
        setPerformance(calculateSuggestedPerformance(nextSources));
        return nextSources;
      }

      const nextSources = ensurePrimarySource([...current, { partida: candidate.partida, score: candidate.score, isPrimary: current.length === 0 }]);
      setPerformance(calculateSuggestedPerformance(nextSources));
      return nextSources;
    });
  }

  function addManualSource(partida: CatalogPartidaRecord) {
    setSelectedSources((current) => {
      const nextSources = ensurePrimarySource([...current, { partida, score: 0, isPrimary: current.length === 0 }]);
      setPerformance(calculateSuggestedPerformance(nextSources));
      return nextSources;
    });
    setManualFilter("");
  }

  function markPrimary(partidaId: string) {
    setSelectedSources((current) => current.map((source) => ({
      ...source,
      isPrimary: source.partida.id === partidaId,
    })));
  }

  function patchInsumo(key: string, changes: Partial<EditableSuggestedInsumo>) {
    setSuggestedInsumos((current) => current.map((insumo) => (insumo.key === key ? { ...insumo, ...changes } : insumo)));
  }

  function addCatalogInsumo(resource: ResourceRecord) {
    const key = `manual-${resource.id}-${crypto.randomUUID()}`;
    setSuggestedInsumos((current) => [
      ...current,
      {
        key,
        resourceId: resource.id,
        description: resource.description,
        unit: resource.unit,
        resourceType: resource.category,
        frequency: 0,
        confidenceLevel: "optional",
        suggestedCrew: null,
        suggestedQuantity: 1,
        finalCrew: null,
        finalQuantity: 1,
        unitPrice: resource.unitPrice,
        finalUnitPrice: resource.unitPrice,
        priceSource: "catalog",
        calculationMethod: "weighted_median",
        statistics: {
          average: 1,
          median: 1,
          minimum: 1,
          maximum: 1,
          standardDeviation: 0,
        },
        sourcePartidaIds: [],
        included: true,
      },
    ]);
    setResourceFilter("");
  }

  function removeInsumo(key: string) {
    setSuggestedInsumos((current) => current.filter((insumo) => insumo.key !== key));
  }

  function includeAllInsumos() {
    setSuggestedInsumos((current) => current.map((insumo) => ({ ...insumo, included: true })));
  }

  function revealStep(step: number) {
    setMaxVisibleStep((current) => Math.max(current, step));
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Generacion semimanual V1</p>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Flujo deterministico sin IA: busca fuentes, revisa candidatas, agrega insumos y guarda solo al confirmar.
          </p>
        </div>
        <Link href="/partidas">
          <Button variant="outline">Volver al catalogo</Button>
        </Link>
      </div>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {feedback ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</p> : null}

      <StepSection number={1} title="Nueva generacion">
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <Input value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Descripcion partida" />
          <Button onClick={() => void searchCandidates()} disabled={loadingState !== "idle"} className="gap-2">
            <Search className="h-4 w-4" />
            {loadingState === "searching" ? "Buscando..." : "Buscar similares"}
          </Button>
        </div>
      </StepSection>

      {maxVisibleStep >= 2 ? (
      <StepSection number={2} title="Partidas candidatas">
        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="space-y-3">
            <div className={getTableFrameClassName(isExcelMode)}>
              <Table className="table-fixed text-xs">
                <colgroup>
                  <col className="w-[8%]" />
                  <col className="w-[42%]" />
                  <col className="w-[9%]" />
                  <col className="w-[14%]" />
                  <col className="w-[27%]" />
                </colgroup>
                <THead>
                  <TR className="bg-slate-50 hover:bg-slate-50">
                    <TH className="whitespace-nowrap px-2 py-2">Score</TH>
                    <TH className="px-2 py-2">Partida</TH>
                    <TH className="whitespace-nowrap px-2 py-2">Unidad</TH>
                    <TH className="whitespace-nowrap px-2 py-2 text-right">Rendimiento</TH>
                    <TH className="whitespace-nowrap px-2 py-2">Estado</TH>
                  </TR>
                </THead>
                <TBody>
                  {(searchResult?.candidates ?? []).map((candidate) => {
                    const selected = selectedSources.find((source) => source.partida.id === candidate.partida.id);
                    return (
                      <TR key={candidate.partida.id}>
                        <TD className="whitespace-nowrap px-2 py-2 tabular-nums">{Math.round(candidate.score * 100)}%</TD>
                        <TD className="px-2 py-2 font-medium text-slate-900">{candidate.partida.description}</TD>
                        <TD className="whitespace-nowrap px-2 py-2">{candidate.partida.unit}</TD>
                        <TD className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatPerformanceRate(candidate.partida.performance, candidate.partida.performanceUnit ?? candidate.partida.unit, candidate.partida.performanceRate ?? null)}</TD>
                        <TD className="px-2 py-2">
                          <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                            <Button size="sm" variant={selected ? "secondary" : "outline"} onClick={() => toggleCandidate(candidate)} className="h-7 min-w-0 gap-1 px-2 text-[10px]">
                              {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                              <span className="truncate">{selected ? "Seleccionada" : "Seleccionar"}</span>
                            </Button>
                            {selected ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markPrimary(candidate.partida.id)}
                                className={selected.isPrimary
                                  ? "h-7 min-w-0 border-blue-200 bg-blue-50 px-2 text-[10px] font-medium text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                                  : "h-7 min-w-0 border-slate-200 px-2 text-[10px] text-slate-600 hover:bg-slate-50 hover:text-slate-900"}
                              >
                                Principal
                              </Button>
                            ) : null}
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>

            <div className="grid gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 md:grid-cols-[1fr_120px_160px_160px]">
              <Input value={generatedName} onChange={(event) => setGeneratedName(event.target.value)} placeholder="Nombre final" />
              <Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Unidad" />
              <div className="space-y-1">
                <Input type="number" step="0.0001" min="0.0001" value={performance} onChange={(event) => setPerformance(Number(event.target.value))} placeholder="Rendimiento sugerido" />
                <p className="text-[11px] text-[var(--app-text-muted)]">Sugerido: {formatPerformanceRate(suggestedPerformance, unit)}</p>
              </div>
              <Button variant="outline" onClick={() => void aggregateInsumos()} disabled={loadingState !== "idle" || !selectedSources.length} className="gap-2 bg-[var(--app-surface)]">
                <GitCompareArrows className="h-4 w-4" />
                Agregar
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-[var(--app-text-strong)]">Agregar fuente manual</h4>
            <Input value={manualFilter} onChange={(event) => setManualFilter(event.target.value)} placeholder="Buscar partida" />
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
              {manualMatches.length ? manualMatches.map((partida) => (
                <button key={partida.id} type="button" onClick={() => addManualSource(partida)} className="flex w-full items-center justify-between gap-3 border-b border-[var(--app-border-soft)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--app-surface-hover)]">
                  <span className="text-sm font-medium text-[var(--app-text-strong)]">{partida.description}</span>
                  <span className="text-xs text-[var(--app-text-muted)]">{partida.unit}</span>
                </button>
              )) : <p className="px-3 py-4 text-sm text-[var(--app-text-muted)]">Escribe para encontrar partidas adicionales.</p>}
            </div>
          </div>
        </div>
      </StepSection>
      ) : null}

      {maxVisibleStep >= 3 ? (
        <StepSection number={3} title="Insumos sugeridos">
          <div className="space-y-4">
            <GroupedInsumosTable insumos={suggestedInsumos} isExcelMode={isExcelMode} editable={false} onPatch={patchInsumo} onRemove={removeInsumo} />
            <div className="flex justify-end">
              <Button type="button" onClick={() => revealStep(4)} disabled={!suggestedInsumos.length}>
                Continuar a revision final
              </Button>
            </div>
          </div>
        </StepSection>
      ) : null}

      {maxVisibleStep >= 4 ? (
      <StepSection number={4} title="Revision final / Vista final">
        <div className="space-y-5">
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={includeAllInsumos} disabled={!suggestedInsumos.length}>
              Incluir todos
            </Button>
          </div>

          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
            <h4 className="mb-3 text-sm font-semibold text-[var(--app-text-strong)]">Agregar insumo desde catalogo</h4>
            <Input value={resourceFilter} onChange={(event) => setResourceFilter(event.target.value)} placeholder="Buscar insumo" />
            {resourceFilter.trim() ? (
              <div className="mt-3 grid gap-2">
                {resourceMatches.length ? resourceMatches.map((resource) => (
                  <button key={resource.id} type="button" onClick={() => addCatalogInsumo(resource)} className="grid gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-left hover:bg-[var(--app-surface-hover)] md:grid-cols-[1fr_80px_100px]">
                    <span className="font-medium text-[var(--app-text-strong)]">{resource.description}</span>
                    <span className="text-sm text-[var(--app-text-muted)]">{resource.unit}</span>
                    <span className="text-right text-sm tabular-nums text-[var(--app-text)]">{formatCurrency(resource.unitPrice)}</span>
                  </button>
                )) : (
                  <p className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text-muted)]">Sin coincidencias en el catalogo.</p>
                )}
              </div>
            ) : null}
          </div>

          <GroupedInsumosTable insumos={suggestedInsumos} isExcelMode={isExcelMode} editable onPatch={patchInsumo} onRemove={removeInsumo} />
          <ComparisonPanel
            primaryPartida={primarySource?.partida ?? null}
            insumos={includedInsumos}
            total={finalTotal}
            generatedPerformance={performance}
            generatedUnit={unit}
            isExcelMode={isExcelMode}
          />
          <div className="flex justify-end">
            <Button type="button" onClick={() => revealStep(5)} disabled={!includedInsumos.length}>
              Continuar a guardar
            </Button>
          </div>
        </div>
      </StepSection>
      ) : null}

      {maxVisibleStep >= 5 ? (
      <StepSection number={5} title="Guardar">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Nada se guarda hasta confirmar. La trazabilidad conserva fuentes, scores y calculos sugeridos.</p>
          <Button onClick={() => void saveGeneratedPartida()} disabled={loadingState !== "idle" || !selectedSources.length} className="gap-2">
            <Check className="h-4 w-4" />
            {loadingState === "saving" ? "Guardando..." : "Guardar partida"}
          </Button>
        </div>
      </StepSection>
      ) : null}
    </div>
  );
}

function GroupedInsumosTable({
  insumos,
  isExcelMode,
  editable,
  onPatch,
  onRemove,
}: {
  insumos: EditableSuggestedInsumo[];
  isExcelMode: boolean;
  editable: boolean;
  onPatch: (key: string, changes: Partial<EditableSuggestedInsumo>) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="grid gap-4">
      {APU_GROUPS.map((group) => {
        const rows = insumos.filter((insumo) => resolveApuGroup(insumo.resourceType) === group.key);
        return (
          <div key={group.key} className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-800">{group.label}</h4>
            <div className={getTableFrameClassName(isExcelMode)}>
              <Table className="table-fixed">
                <GroupedInsumosColGroup editable={editable} />
                <THead>
                  <TR className="bg-slate-50 hover:bg-slate-50">
                    <TH>Insumo</TH>
                    <TH>Frecuencia</TH>
                    <TH>Cuadrilla</TH>
                    <TH>Cantidad sugerida</TH>
                    <TH>Confianza</TH>
                    <TH>Precio</TH>
                    <TH>Parcial</TH>
                    {editable ? <TH>Accion</TH> : null}
                  </TR>
                </THead>
                <TBody>
                  {rows.length ? rows.map((insumo) => (
                    <TR key={insumo.key} className={!insumo.included ? "opacity-55" : undefined}>
                      <TD className="font-medium text-slate-900">{insumo.description}</TD>
                      <TD className="tabular-nums">{Math.round(insumo.frequency * 100)}%</TD>
                      <TD>
                        {editable ? (
                          <Input type="number" step="0.0001" value={insumo.finalCrew ?? ""} onChange={(event) => onPatch(insumo.key, { finalCrew: event.target.value ? Number(event.target.value) : null })} className="w-24 text-right tabular-nums" />
                        ) : (
                          <span className="tabular-nums">{formatOptionalNumber(insumo.suggestedCrew)}</span>
                        )}
                      </TD>
                      <TD>
                        {editable ? (
                          <Input type="number" step="0.0001" value={insumo.finalQuantity} onChange={(event) => onPatch(insumo.key, { finalQuantity: Number(event.target.value) })} className="w-28 text-right tabular-nums" />
                        ) : (
                          <span className="tabular-nums">{insumo.suggestedQuantity}</span>
                        )}
                      </TD>
                      <TD>{confidenceLabel(insumo.confidenceLevel)}</TD>
                      <TD>
                        {editable ? (
                          <Input type="number" step="0.0001" value={insumo.finalUnitPrice} onChange={(event) => onPatch(insumo.key, { finalUnitPrice: Number(event.target.value) })} className="w-28 text-right tabular-nums" />
                        ) : (
                          <span>{insumo.unitPrice == null ? "Sin match" : formatCurrency(insumo.unitPrice)}</span>
                        )}
                      </TD>
                      <TD className="tabular-nums">{formatCurrency(insumo.finalUnitPrice * insumo.finalQuantity)}</TD>
                      {editable ? (
                        <TD>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => onPatch(insumo.key, { included: !insumo.included })}>
                              {insumo.included ? "Quitar" : "Incluir"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => onRemove(insumo.key)} aria-label={`Eliminar ${insumo.description}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TD>
                      ) : null}
                    </TR>
                  )) : (
                    <TR>
                      <TD colSpan={editable ? 8 : 7} className="text-sm text-slate-500">Sin insumos en este grupo.</TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GroupedInsumosColGroup({ editable }: { editable: boolean }) {
  const widthClasses = editable
    ? ["w-[28%]", "w-[9%]", "w-[10%]", "w-[14%]", "w-[10%]", "w-[10%]", "w-[10%]", "w-[9%]"]
    : ["w-[34%]", "w-[10%]", "w-[11%]", "w-[16%]", "w-[10%]", "w-[10%]", "w-[9%]"];

  return (
    <colgroup>
      {widthClasses.map((className, index) => (
        <col key={`${editable ? "editable" : "readonly"}-${index}`} className={className} />
      ))}
    </colgroup>
  );
}

function ComparisonPanel({
  primaryPartida,
  insumos,
  total,
  generatedPerformance,
  generatedUnit,
  isExcelMode,
}: {
  primaryPartida: CatalogPartidaRecord | null;
  insumos: EditableSuggestedInsumo[];
  total: number;
  generatedPerformance: number;
  generatedUnit: string;
  isExcelMode: boolean;
}) {
  const baseRows = [...(primaryPartida?.apuRows ?? [])].sort((left, right) => left.sortOrder - right.sortOrder);
  const baseTotal = primaryPartida?.unitPrice ?? 0;
  const generatedRows = orderGeneratedRowsLikeBase(
    insumos.map((insumo, index) => ({
      id: insumo.key,
      catalogPartidaId: "generated",
      resourceId: insumo.resourceId,
      description: insumo.description,
      unit: insumo.unit,
      crew: insumo.finalCrew,
      quantity: insumo.finalQuantity,
      unitPrice: insumo.finalUnitPrice,
      subtotal: insumo.finalQuantity * insumo.finalUnitPrice,
      resourceType: insumo.resourceType,
      sortOrder: index,
    })),
    baseRows,
  );

  return (
    <aside className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">Comparativo con partida principal</h4>
        <p className="mt-1 text-xs text-slate-500">{primaryPartida ? primaryPartida.description : "Marca una partida principal para comparar lado a lado."}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ComparisonColumn
          title="Base principal"
          rows={baseRows}
          total={baseTotal}
          performanceLabel={formatPerformanceRate(primaryPartida?.performance ?? null, primaryPartida?.performanceUnit ?? primaryPartida?.unit ?? null, primaryPartida?.performanceRate ?? null)}
          isExcelMode={isExcelMode}
        />
        <ComparisonColumn
          title="Partida generada"
          rows={generatedRows}
          total={total}
          performanceLabel={formatPerformanceRate(generatedPerformance, generatedUnit)}
          isExcelMode={isExcelMode}
        />
      </div>
    </aside>
  );
}

function ComparisonColumn({
  title,
  rows,
  total,
  performanceLabel,
  isExcelMode,
}: {
  title: string;
  rows: PartidaApuRowRecord[];
  total: number;
  performanceLabel: string;
  isExcelMode: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--app-border-soft)] pb-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--app-text-muted)]">{title}</p>
          <p className="mt-1 text-[11px] font-medium text-[var(--app-text-muted)]">Rendimiento: {performanceLabel}</p>
        </div>
        <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-[var(--app-text-strong)]">{formatCurrency(total)}</p>
      </div>
      {APU_GROUPS.map((group) => {
        const groupRows = rows.filter((row) => resolveApuGroup(row.resourceType ?? null) === group.key);

        return (
          <div key={`${title}-${group.key}`} className="space-y-2">
            <h5 className="text-xs font-semibold uppercase text-[var(--app-text-muted)]">{group.label}</h5>
            <div className={getTableFrameClassName(isExcelMode)}>
              <Table className="text-[11px] leading-tight">
                <THead>
                  <TR className="bg-slate-50 hover:bg-slate-50">
                    <TH className="whitespace-nowrap px-2 py-2">Descripcion</TH>
                    <TH className="whitespace-nowrap px-2 py-2">Unidad</TH>
                    <TH className="whitespace-nowrap px-2 py-2 text-right">Cuadrilla</TH>
                    <TH className="whitespace-nowrap px-2 py-2 text-right">Cantidad</TH>
                    <TH className="whitespace-nowrap px-2 py-2 text-right">PU</TH>
                    <TH className="whitespace-nowrap px-2 py-2 text-right">Parcial</TH>
                  </TR>
                </THead>
                <TBody>
                  {groupRows.length ? groupRows.map((row) => (
                    <TR key={row.id}>
                      <TD className="max-w-56 truncate px-2 py-1.5 font-medium text-[var(--app-text-strong)]" title={row.description}>{row.description}</TD>
                      <TD className="whitespace-nowrap px-2 py-1.5">{row.unit}</TD>
                      <TD className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatOptionalNumber(row.crew ?? null)}</TD>
                      <TD className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatCompactNumber(row.quantity)}</TD>
                      <TD className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatCurrency(row.unitPrice)}</TD>
                      <TD className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatCurrency(row.subtotal)}</TD>
                    </TR>
                  )) : (
                    <TR>
                      <TD colSpan={6} className="px-2 py-2 text-xs text-[var(--app-text-muted)]">Sin insumos en este grupo.</TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepSection({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm shadow-slate-950/5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">{number}</span>
        <h3 className="text-xl font-semibold text-[var(--app-text-strong)]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ensurePrimarySource(sources: CandidateSelection[]) {
  if (!sources.length || sources.some((source) => source.isPrimary)) return sources;
  return sources.map((source, index) => ({ ...source, isPrimary: index === 0 }));
}

function calculateSuggestedPerformance(sources: CandidateSelection[]) {
  const validSources = sources.filter((source) => source.partida.performance > 0);
  if (!validSources.length) return 1;

  const weightedTotal = validSources.reduce((sum, source) => {
    const weight = source.score > 0 ? source.score : 1;
    return sum + source.partida.performance * weight;
  }, 0);
  const totalWeight = validSources.reduce((sum, source) => sum + (source.score > 0 ? source.score : 1), 0);

  return roundToFourDecimals(weightedTotal / totalWeight);
}

function resolveApuGroup(resourceType: string | null): ApuGroupKey {
  const normalized = (resourceType ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  if (normalized === "LABOR" || normalized === "MO" || normalized === "MANO DE OBRA") return "LABOR";
  if (normalized === "EQUIPMENT" || normalized === "TOOLS" || normalized === "EQUIPO" || normalized === "HERRAMIENTAS") return "EQUIPMENT";
  if (normalized === "SUBPARTIDA" || normalized === "SUB PARTIDA") return "SUBPARTIDA";
  return "MATERIAL";
}

function confidenceLabel(value: SuggestedInsumo["confidenceLevel"]) {
  if (value === "auto") return "Alta";
  if (value === "review") return "Revisar";
  return "Opcional";
}

function orderGeneratedRowsLikeBase(rows: PartidaApuRowRecord[], baseRows: PartidaApuRowRecord[]) {
  const baseOrder = new Map<string, number>();

  baseRows.forEach((row, index) => {
    baseOrder.set(buildComparisonRowKey(row), index);
  });

  return [...rows].sort((left, right) => {
    const leftGroupIndex = APU_GROUPS.findIndex((group) => group.key === resolveApuGroup(left.resourceType ?? null));
    const rightGroupIndex = APU_GROUPS.findIndex((group) => group.key === resolveApuGroup(right.resourceType ?? null));

    if (leftGroupIndex !== rightGroupIndex) return leftGroupIndex - rightGroupIndex;

    const leftBaseOrder = baseOrder.get(buildComparisonRowKey(left)) ?? Number.MAX_SAFE_INTEGER;
    const rightBaseOrder = baseOrder.get(buildComparisonRowKey(right)) ?? Number.MAX_SAFE_INTEGER;

    if (leftBaseOrder !== rightBaseOrder) return leftBaseOrder - rightBaseOrder;
    return left.sortOrder - right.sortOrder || left.description.localeCompare(right.description, "es");
  });
}

function buildComparisonRowKey(row: PartidaApuRowRecord) {
  if (row.resourceId) return `resource:${row.resourceId}`;
  return `natural:${normalizeComparisonText(row.description)}|${normalizeComparisonText(row.unit)}`;
}

function normalizeComparisonText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
}

function formatPerformanceRate(performance: number | null, unit: string | null, persistedRate?: string | null) {
  if (persistedRate?.trim()) return persistedRate.trim();

  const normalizedUnit = unit?.trim();
  if (!performance && !normalizedUnit) return "-";
  if (!normalizedUnit) return formatCompactNumber(performance ?? 0);
  return `${formatCompactNumber(performance ?? 0)} ${normalizedUnit}/DIA`;
}

function formatOptionalNumber(value: number | null) {
  return value === null ? "-" : formatCompactNumber(value);
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/g, "").replace(/\.$/g, "");
}

function roundToFourDecimals(value: number) {
  return Math.round(value * 10000) / 10000;
}

function readErrorMessage(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}
