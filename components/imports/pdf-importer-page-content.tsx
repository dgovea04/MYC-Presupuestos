"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Loader2, Upload } from "lucide-react";
import { ImportProgressPanel, type ImportProgressPanelStep } from "@/components/imports/import-progress-panel";
import { ImportWarningSummary } from "@/components/imports/import-warning-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculatePdfImportDraftTotals } from "@/lib/pdf-import/calculations";
import type { PdfAiImportDraft, PdfImportDocumentRole, PdfImportLink, PdfImportSourceEvidence } from "@/lib/pdf-import/types";

type RequestState = "idle" | "loading" | "success" | "error";

type CompanyOption = {
  id: string;
  name: string;
};

type PdfImporterPageContentProps = {
  companies: CompanyOption[];
  initialDraft?: PdfAiImportDraft;
};

type PdfImportResult = {
  projectId: string;
  projectName: string;
  generalBudgetId: string;
  subBudgetIds: string[];
  resourceCount: number;
  budgetCount: number;
  itemCount: number;
  apuCount: number;
};

const progressSteps: ImportProgressPanelStep[] = [
  { label: "Subiendo" },
  { label: "Extrayendo" },
  { label: "Vinculando" },
  { label: "Revisando" },
];

export function PdfImporterPageContent({ companies, initialDraft }: PdfImporterPageContentProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [fileRoles, setFileRoles] = useState<Record<string, PdfImportDocumentRole>>({});
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [projectName, setProjectName] = useState("");
  const [currency, setCurrency] = useState("PEN");
  const [priceTolerance, setPriceTolerance] = useState("0.01");
  const [draftState, setDraftState] = useState<RequestState>("idle");
  const [importState, setImportState] = useState<RequestState>("idle");
  const [draft, setDraft] = useState<PdfAiImportDraft | null>(initialDraft ?? null);
  const [importResult, setImportResult] = useState<PdfImportResult | null>(null);
  const [error, setError] = useState("");

  const criticalValidationCount = useMemo(
    () => draft?.validations.filter((validation) => validation.severity === "error").length ?? 0,
    [draft],
  );
  const canCreateDraft = files.length > 0 && companyId.length > 0 && draftState !== "loading";
  const canImport = draft != null && companyId.length > 0 && criticalValidationCount === 0 && importState !== "loading";

  function onFilesSelected(nextFiles: FileList | null) {
    const selectedFiles = Array.from(nextFiles ?? []);
    setFiles(selectedFiles);
    setDraft(null);
    setImportResult(null);
    setFileRoles(Object.fromEntries(selectedFiles.map((file) => [file.name, inferInitialRole(file.name)])));
  }

  async function createDraft() {
    if (!canCreateDraft) {
      setError(files.length === 0 ? "Selecciona al menos un PDF." : "Selecciona una empresa destino.");
      setDraftState("error");
      return;
    }

    setDraftState("loading");
    setImportState("idle");
    setError("");
    setImportResult(null);

    const formData = createFormData();

    try {
      const response = await fetch("/api/imports/pdf/draft", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json().catch(() => null)) as (PdfAiImportDraft & { error?: string }) | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo generar el draft PDF.");
      }

      setDraft(body);
      setDraftState("success");
    } catch (nextError) {
      setDraftState("error");
      setError(nextError instanceof Error ? nextError.message : "No se pudo generar el draft PDF.");
    }
  }

  async function importDraft() {
    if (!draft || !companyId) {
      setError("Genera un draft y selecciona una empresa antes de importar.");
      setImportState("error");
      return;
    }

    setImportState("loading");
    setError("");

    try {
      const response = await fetch("/api/imports/pdf/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, draft }),
      });
      const body = (await response.json().catch(() => null)) as (PdfImportResult & { error?: string }) | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo importar el draft PDF.");
      }

      setImportResult(body);
      setImportState("success");
    } catch (nextError) {
      setImportState("error");
      setError(nextError instanceof Error ? nextError.message : "No se pudo importar el draft PDF.");
    }
  }

  function createFormData() {
    const formData = new FormData();
    formData.set("companyId", companyId);
    formData.set("projectName", projectName);
    formData.set("currency", currency);
    formData.set("priceTolerance", priceTolerance);
    formData.set("fileRoles", JSON.stringify(fileRoles));
    files.forEach((file) => formData.append("files", file));
    return formData;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
              <FileText className="h-4 w-4 text-sky-600" />
              PDFs del proyecto
            </div>
            <p className="text-sm text-[var(--app-text-muted)]">
              Sube presupuesto, APUs y subpartidas. Los PDFs escaneados quedaran marcados para OCR/vision cuando el proveedor este configurado.
            </p>
          </div>
          <Badge className={draftState === "success" ? "theme-status-success" : "theme-status-info"}>
            {files.length} PDF{files.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(180px,240px)_120px_140px]">
          <Input accept=".pdf,application/pdf" multiple type="file" onChange={(event) => onFilesSelected(event.target.files)} />
          <select
            className="h-10 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text-strong)] outline-none transition focus:border-sky-500"
            disabled={companies.length === 0}
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
          >
            {companies.length === 0 ? (
              <option value="">Sin empresas</option>
            ) : (
              companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))
            )}
          </select>
          <Input aria-label="Moneda" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
          <Input aria-label="Tolerancia" value={priceTolerance} onChange={(event) => setPriceTolerance(event.target.value)} />
        </div>

        <div className="mt-3">
          <Input
            aria-label="Nombre del proyecto"
            placeholder="Nombre del proyecto detectado o manual"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
          />
        </div>

        {files.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--app-border-soft)]">
            <div className="grid grid-cols-[minmax(0,1fr)_180px] bg-[var(--app-surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--app-text-muted)]">
              <span>Archivo</span>
              <span>Tipo</span>
            </div>
            {files.map((file) => (
              <div className="grid grid-cols-[minmax(0,1fr)_180px] items-center gap-3 border-t border-[var(--app-border-soft)] px-3 py-2" key={file.name}>
                <span className="truncate text-sm text-[var(--app-text-strong)]">{file.name}</span>
                <select
                  className="h-9 rounded-lg border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-2 text-sm"
                  value={fileRoles[file.name] ?? "AUTO"}
                  onChange={(event) => setFileRoles((current) => ({ ...current, [file.name]: event.target.value as PdfImportDocumentRole }))}
                >
                  <option value="AUTO">Detectar</option>
                  <option value="BUDGET">Presupuesto</option>
                  <option value="APU">APU</option>
                  <option value="SUBPARTIDAS">Subpartidas</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button className="gap-2" disabled={!canCreateDraft} onClick={createDraft}>
            {draftState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Generar draft
          </Button>
          <Button className="gap-2" disabled={!canImport} onClick={importDraft} variant="outline">
            {importState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Importar proyecto
          </Button>
        </div>

        {draftState === "loading" ? (
          <ImportProgressPanel
            activeStepIndex={2}
            detail="Extrayendo texto, clasificando documentos y vinculando partidas con APUs."
            progress={68}
            status="running"
            steps={progressSteps}
            title="Generando draft PDF"
          />
        ) : null}

        {error ? <InlineMessage message={error} /> : null}
        {companies.length === 0 ? <InlineMessage message="Crea una empresa antes de importar proyectos desde PDF." /> : null}
      </section>

      {draft ? <DraftPreview draft={draft} criticalValidationCount={criticalValidationCount} onDraftChange={setDraft} /> : null}

      {importResult ? (
        <section className="theme-status-success rounded-2xl border p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Importacion PDF completada
          </div>
          <p className="mt-2 text-sm">
            {importResult.projectName}: {importResult.itemCount} partidas, {importResult.apuCount} APUs y {importResult.resourceCount} recursos.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { window.location.href = `/projects/${importResult.projectId}`; }}>
              Proyecto
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => { window.location.href = `/budgets/${importResult.generalBudgetId}`; }}>
              Presupuesto
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DraftPreview({
  draft,
  criticalValidationCount,
  onDraftChange,
}: {
  draft: PdfAiImportDraft;
  criticalValidationCount: number;
  onDraftChange: (draft: PdfAiImportDraft) => void;
}) {
  const itemCount = draft.budgets.reduce((sum, budget) => sum + budget.items.length, 0);
  const apuCount = draft.apus.length;
  const subpartidaCount = draft.subpartidas.length;
  const resourceCount = draft.resources.length;

  return (
    <section className="rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--app-text-strong)]">{draft.project.name}</h2>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            {itemCount} partidas detectadas, {apuCount} APUs, {subpartidaCount} subpartidas, {resourceCount} recursos.
          </p>
        </div>
        <Badge className={criticalValidationCount > 0 ? "theme-status-danger" : "theme-status-success"}>
          {criticalValidationCount} errores criticos
        </Badge>
      </div>

      <ImportWarningSummary warnings={[...draft.warnings, ...draft.validations.map((validation) => validation.message)]} />

      <div className="mt-5 overflow-hidden rounded-xl border border-[var(--app-border-soft)]">
        <div className="grid grid-cols-[90px_minmax(0,1fr)_70px_90px_90px_90px] bg-[var(--app-surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--app-text-muted)]">
          <span>Codigo</span>
          <span>Partida</span>
          <span>Und</span>
          <span>Metrado</span>
          <span>P.U.</span>
          <span>Parcial</span>
        </div>
        {draft.budgets.flatMap((budget) => budget.items).slice(0, 12).map((item) => (
          <div
            className="grid grid-cols-[90px_minmax(0,1fr)_70px_90px_90px_90px] items-center gap-2 border-t border-[var(--app-border-soft)] px-3 py-2 text-sm"
            key={item.id}
          >
            <span className="font-mono text-xs text-[var(--app-text-muted)]">{item.code}</span>
            <Input
              aria-label={`Descripcion ${item.code}`}
              className="h-8"
              value={item.description}
              onChange={(event) => onDraftChange(updateBudgetItemField(draft, item.id, "description", event.target.value))}
            />
            <Input
              aria-label={`Unidad ${item.code}`}
              className="h-8"
              value={item.unit}
              onChange={(event) => onDraftChange(updateBudgetItemField(draft, item.id, "unit", event.target.value))}
            />
            <Input
              aria-label={`Cantidad ${item.code}`}
              className="h-8"
              value={item.quantity}
              onChange={(event) => onDraftChange(updateBudgetItemField(draft, item.id, "quantity", event.target.value))}
            />
            <Input
              aria-label={`Precio unitario ${item.code}`}
              className="h-8"
              value={item.unitPrice}
              onChange={(event) => onDraftChange(updateBudgetItemField(draft, item.id, "unitPrice", event.target.value))}
            />
            <span>{item.partial}</span>
          </div>
        ))}
      </div>

      {draft.subpartidas.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-[var(--app-border-soft)]">
          <div className="grid grid-cols-[90px_minmax(0,1fr)_70px_90px_90px] bg-[var(--app-surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--app-text-muted)]">
            <span>Codigo</span>
            <span>Subpartida</span>
            <span>Und</span>
            <span>Rend.</span>
            <span>P.U.</span>
          </div>
          {draft.subpartidas.slice(0, 8).map((subpartida) => (
            <div
              className="grid grid-cols-[90px_minmax(0,1fr)_70px_90px_90px] border-t border-[var(--app-border-soft)] px-3 py-2 text-sm"
              key={subpartida.id}
            >
              <span className="font-mono text-xs text-[var(--app-text-muted)]">{subpartida.code}</span>
              <span className="truncate text-[var(--app-text-strong)]">{subpartida.description}</span>
              <span>{subpartida.unit}</span>
              <span>{subpartida.performance ?? "-"}</span>
              <span>{subpartida.unitPrice}</span>
            </div>
          ))}
        </div>
      ) : null}

      <ReviewPanel draft={draft} onDraftChange={onDraftChange} />
    </section>
  );
}

type ReviewIssue = {
  id: string;
  title: string;
  detail: string;
  evidence?: PdfImportSourceEvidence;
  link?: PdfImportLink;
};

function ReviewPanel({ draft, onDraftChange }: { draft: PdfAiImportDraft; onDraftChange: (draft: PdfAiImportDraft) => void }) {
  const groups = buildReviewGroups(draft);
  const totalIssues = groups.reduce((sum, group) => sum + group.items.length, 0);
  const [selectedApuByLinkId, setSelectedApuByLinkId] = useState<Record<string, string>>({});
  const [selectedBudgetItemByLinkId, setSelectedBudgetItemByLinkId] = useState<Record<string, string>>({});
  const [selectedSubpartidaByLinkId, setSelectedSubpartidaByLinkId] = useState<Record<string, string>>({});
  const budgetItems = draft.budgets.flatMap((budget) => budget.items);

  if (totalIssues === 0) {
    return null;
  }

  return (
    <div className="mt-5 border-t border-[var(--app-border-soft)] pt-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--app-text-strong)]">Revision requerida</h3>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            Revisa conflictos, recursos nuevos y evidencias de baja confianza antes de importar.
          </p>
        </div>
        <Badge className="theme-status-warning">{totalIssues} observaciones</Badge>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {groups.filter((group) => group.items.length > 0).map((group) => (
          <section className="overflow-hidden rounded-xl border border-[var(--app-border-soft)]" key={group.title}>
            <div className="flex items-center justify-between bg-[var(--app-surface-elevated)] px-3 py-2">
              <h4 className="text-xs font-semibold uppercase text-[var(--app-text-muted)]">{group.title}</h4>
              <Badge>{group.items.length}</Badge>
            </div>
            <div className="divide-y divide-[var(--app-border-soft)]">
              {group.items.slice(0, 6).map((issue) => (
                <div className="px-3 py-2" key={issue.id}>
                  <div className="text-sm font-medium text-[var(--app-text-strong)]">{issue.title}</div>
                  <div className="mt-1 text-xs text-[var(--app-text-muted)]">{issue.detail}</div>
                  {issue.evidence ? (
                    <div className="mt-1 font-mono text-xs text-[var(--app-text-muted)]">
                      {issue.evidence.sourceFileName} p. {issue.evidence.sourcePage}
                    </div>
                  ) : null}
                  {issue.link?.kind === "BUDGET_ITEM_APU" && issue.link.status === "MISSING_APU" ? (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <select
                        aria-label={`Seleccionar APU para ${issue.title}`}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-2 text-sm"
                        value={selectedApuByLinkId[issue.link.id] ?? ""}
                        onChange={(event) => setSelectedApuByLinkId((current) => ({ ...current, [issue.link!.id]: event.target.value }))}
                      >
                        <option value="">Seleccionar APU</option>
                        {draft.apus.map((apu) => (
                          <option key={apu.id} value={apu.id}>
                            {apu.budgetItemCode ?? apu.id} - {apu.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDraftChange(resolveMissingApuLink(draft, issue.link!, selectedApuByLinkId[issue.link!.id] ?? ""))}
                      >
                        Vincular APU
                      </Button>
                    </div>
                  ) : null}
                  {issue.link?.kind === "BUDGET_ITEM_APU" && issue.link.status === "MISSING_BUDGET_ITEM" ? (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <select
                        aria-label={`Seleccionar partida para ${issue.title}`}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-2 text-sm"
                        value={selectedBudgetItemByLinkId[issue.link.id] ?? ""}
                        onChange={(event) => setSelectedBudgetItemByLinkId((current) => ({ ...current, [issue.link!.id]: event.target.value }))}
                      >
                        <option value="">Seleccionar partida</option>
                        {budgetItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.code} - {item.description}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onDraftChange(resolveOrphanApuLink(draft, issue.link!, selectedBudgetItemByLinkId[issue.link!.id] ?? ""))
                        }
                      >
                        Vincular partida
                      </Button>
                    </div>
                  ) : null}
                  {issue.link?.kind === "APU_SUBPARTIDA" && (issue.link.status === "AMBIGUOUS" || issue.link.status === "NEEDS_REVIEW") ? (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <select
                        aria-label={`Seleccionar subpartida para ${issue.title}`}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-2 text-sm"
                        value={selectedSubpartidaByLinkId[issue.link.id] ?? ""}
                        onChange={(event) => setSelectedSubpartidaByLinkId((current) => ({ ...current, [issue.link!.id]: event.target.value }))}
                      >
                        <option value="">Seleccionar subpartida</option>
                        {draft.subpartidas.map((subpartida) => (
                          <option key={subpartida.id} value={subpartida.id}>
                            {subpartida.code} - {subpartida.description}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onDraftChange(resolveSubpartidaLink(draft, issue.link!, selectedSubpartidaByLinkId[issue.link!.id] ?? ""))
                        }
                      >
                        Vincular subpartida
                      </Button>
                    </div>
                  ) : null}
                  {issue.link?.status === "PRICE_MISMATCH" && issue.link.toId ? (
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="outline"
                      onClick={() => onDraftChange(approvePriceDifference(draft, issue.link!))}
                    >
                      Aprobar diferencia
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function buildReviewGroups(draft: PdfAiImportDraft) {
  const budgetItems = draft.budgets.flatMap((budget) => budget.items);
  const apuRows = draft.apus.flatMap((apu) => apu.rows);
  const budgetItemsById = new Map(budgetItems.map((item) => [item.id, item]));
  const apusById = new Map(draft.apus.map((apu) => [apu.id, apu]));
  const apuRowsById = new Map(apuRows.map((row) => [row.id, row]));

  const missingApus = draft.links
    .filter((link) => link.kind === "BUDGET_ITEM_APU" && link.status === "MISSING_APU")
    .map((link): ReviewIssue | null => {
      const item = budgetItemsById.get(link.fromId);
      return item
        ? { id: link.id, title: item.description, detail: link.reason, evidence: item.evidence, link }
        : null;
    })
    .filter(isReviewIssue);

  const missingBudgetItems = draft.links
    .filter((link) => link.kind === "BUDGET_ITEM_APU" && link.status === "MISSING_BUDGET_ITEM")
    .map((link): ReviewIssue | null => {
      const apu = apusById.get(link.fromId);
      return apu
        ? { id: link.id, title: apu.name, detail: link.reason, evidence: apu.evidence, link }
        : null;
    })
    .filter(isReviewIssue);

  const priceDifferences = draft.links
    .filter((link) => link.kind === "BUDGET_ITEM_APU" && link.status === "PRICE_MISMATCH")
    .map((link): ReviewIssue | null => {
      const item = budgetItemsById.get(link.fromId);
      return item
        ? { id: link.id, title: item.description, detail: link.reason, evidence: item.evidence, link }
        : null;
    })
    .filter(isReviewIssue);

  const ambiguousSubpartidas = draft.links
    .filter((link) => link.kind === "APU_SUBPARTIDA" && (link.status === "AMBIGUOUS" || link.status === "NEEDS_REVIEW"))
    .map((link): ReviewIssue | null => {
      const row = apuRowsById.get(link.fromId);
      return row
        ? { id: link.id, title: row.description, detail: link.reason, evidence: row.evidence, link }
        : null;
    })
    .filter(isReviewIssue);

  const newResources = draft.resources.map((resource): ReviewIssue => ({
    id: resource.id,
    title: resource.description,
    detail: `${resource.category} - ${resource.unit} - ${resource.unitPrice} ${resource.currency}`,
    evidence: resource.evidence,
  }));

  const lowConfidenceEvidence = collectLowConfidenceEvidence(draft).map((evidence, index): ReviewIssue => ({
    id: `${evidence.sourceFileName}-${evidence.sourcePage}-${index}`,
    title: `${evidence.sourceFileName} p. ${evidence.sourcePage}`,
    detail: `Confianza ${(evidence.confidence * 100).toFixed(0)}%.`,
    evidence,
  }));

  return [
    { title: "Partidas sin APU", items: missingApus },
    { title: "APUs sin partida", items: missingBudgetItems },
    { title: "Diferencias de precio", items: priceDifferences },
    { title: "Subpartidas ambiguas", items: ambiguousSubpartidas },
    { title: "Recursos nuevos", items: newResources },
    { title: "Paginas OCR de baja confianza", items: lowConfidenceEvidence },
  ];
}

type EditableBudgetItemField = "description" | "unit" | "quantity" | "unitPrice";

function updateBudgetItemField(draft: PdfAiImportDraft, itemId: string, field: EditableBudgetItemField, value: string): PdfAiImportDraft {
  const nextDraft: PdfAiImportDraft = {
    ...draft,
    budgets: draft.budgets.map((budget) => ({
      ...budget,
      items: budget.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    })),
  };

  return calculatePdfImportDraftTotals(nextDraft);
}

function approvePriceDifference(draft: PdfAiImportDraft, link: PdfImportLink): PdfAiImportDraft {
  return {
    ...draft,
    links: draft.links.map((current) =>
      current.id === link.id
        ? { ...current, status: "MATCHED", confidence: Math.max(current.confidence, 0.8), reason: `${current.reason} Aprobado por revision humana.` }
        : current,
    ),
    validations: draft.validations.filter((validation) => !(validation.code === "PRICE_MISMATCH" && validation.entityId === link.fromId)),
    reviewApprovals: addReviewApproval(
      draft,
      `approval-${link.id}`,
      "PRICE_MISMATCH",
      link.fromId,
      "Diferencia de precio aprobada por revision humana.",
    ),
    warnings: [...draft.warnings, `Diferencia de precio aprobada para ${link.fromId}.`],
  };
}

function resolveMissingApuLink(draft: PdfAiImportDraft, link: PdfImportLink, apuId: string): PdfAiImportDraft {
  if (apuId.length === 0) {
    return draft;
  }

  return {
    ...draft,
    links: draft.links.map((current) =>
      current.id === link.id
        ? { ...current, toId: apuId, status: "MATCHED", confidence: Math.max(current.confidence, 0.8), reason: `${current.reason} Vinculado por revision humana.` }
        : current,
    ),
    warnings: [...draft.warnings, `APU vinculado para ${link.fromId}.`],
  };
}

function resolveOrphanApuLink(draft: PdfAiImportDraft, link: PdfImportLink, budgetItemId: string): PdfAiImportDraft {
  if (budgetItemId.length === 0) {
    return draft;
  }

  return {
    ...draft,
    links: draft.links.map((current) =>
      current.id === link.id
        ? {
            ...current,
            fromId: budgetItemId,
            toId: link.fromId,
            status: "MATCHED",
            confidence: Math.max(current.confidence, 0.8),
            reason: `${current.reason} Vinculado por revision humana.`,
          }
        : current,
    ),
    warnings: [...draft.warnings, `Partida vinculada para ${link.fromId}.`],
  };
}

function resolveSubpartidaLink(draft: PdfAiImportDraft, link: PdfImportLink, subpartidaId: string): PdfAiImportDraft {
  if (subpartidaId.length === 0) {
    return draft;
  }

  return {
    ...draft,
    links: draft.links.map((current) =>
      current.id === link.id
        ? { ...current, toId: subpartidaId, status: "MATCHED", confidence: Math.max(current.confidence, 0.8), reason: `${current.reason} Vinculado por revision humana.` }
        : current,
    ),
    warnings: [...draft.warnings, `Subpartida vinculada para ${link.fromId}.`],
  };
}

function addReviewApproval(draft: PdfAiImportDraft, id: string, validationCode: string, entityId: string, reason: string) {
  const existingApprovals = draft.reviewApprovals ?? [];
  if (existingApprovals.some((approval) => approval.id === id)) {
    return existingApprovals;
  }

  return [...existingApprovals, { id, validationCode, entityId, reason }];
}

function collectLowConfidenceEvidence(draft: PdfAiImportDraft) {
  const evidenceItems = [
    ...draft.budgets.flatMap((budget) => budget.items.map((item) => item.evidence)),
    ...draft.apus.flatMap((apu) => [apu.evidence, ...apu.rows.map((row) => row.evidence)]),
    ...draft.subpartidas.flatMap((subpartida) => [subpartida.evidence, ...subpartida.rows.map((row) => row.evidence)]),
    ...draft.resources.map((resource) => resource.evidence),
  ];
  const seen = new Set<string>();

  return evidenceItems.filter((evidence) => {
    const key = `${evidence.sourceFileName}:${evidence.sourcePage}`;
    if (evidence.confidence >= 0.65 || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isReviewIssue(issue: ReviewIssue | null): issue is ReviewIssue {
  return issue != null;
}

function InlineMessage({ message }: { message: string }) {
  return (
    <div className="theme-status-warning mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function inferInitialRole(fileName: string): PdfImportDocumentRole {
  const normalized = fileName.toLowerCase();
  if (normalized.includes("apu") || normalized.includes("analisis")) {
    return "APU";
  }
  if (normalized.includes("sub")) {
    return "SUBPARTIDAS";
  }
  if (normalized.includes("presupuesto")) {
    return "BUDGET";
  }
  return "AUTO";
}
