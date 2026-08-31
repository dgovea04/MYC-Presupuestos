"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, Circle, HelpCircle, RotateCcw, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DemoProjectTourConfig = {
  projectId: string;
  generalBudgetId: string | null;
  structuresBudgetId: string | null;
};

type DemoTourStepId = "general-budget" | "structures" | "apu" | "formula" | "export";

type DemoTourStep = {
  id: DemoTourStepId;
  title: string;
  description: string;
  help: string;
  target: string;
  route: string;
  routeLabel: string;
  completionRoutes?: string[];
};

type StoredTourState = {
  completed: DemoTourStepId[];
};

type DemoTourActionDetail = {
  action?: string;
  target?: string;
};

const TOUR_ACTION_EVENT = "mc-demo-tour-action";
const TOUR_OPEN_EVENT = "mc-demo-tour-open";

export function DemoProjectGuide({
  config,
  autoOpen = false,
}: {
  config: DemoProjectTourConfig;
  autoOpen?: boolean;
}) {
  return <DemoProjectTour config={config} showGuideCard autoOpen={autoOpen} />;
}

export function DemoProjectTour({
  config,
  showGuideCard = false,
  autoOpen = false,
}: {
  config: DemoProjectTourConfig;
  showGuideCard?: boolean;
  autoOpen?: boolean;
}) {
  const pathname = usePathname();
  const steps = useMemo(() => buildDemoTourSteps(config), [config]);
  const storageKey = `mc-demo-project-tour:${config.projectId}`;
  const [completed, setCompleted] = useState<DemoTourStepId[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const activeStep = steps.find((step) => !completed.includes(step.id)) ?? null;
  const completedCount = completed.length;
  const isComplete = completedCount === steps.length;
  const activeStepOnCurrentRoute = activeStep?.route === pathname;

  const updateCompleted = useCallback((nextIds: DemoTourStepId[]) => {
    setCompleted((current) => {
      const next = Array.from(new Set([...current, ...nextIds]));
      persistState(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const completeStep = useCallback((stepId: DemoTourStepId) => {
    if (completed.includes(stepId)) return;
    updateCompleted([stepId]);
    setIsOpen(true);
  }, [completed, updateCompleted]);

  useEffect(() => {
    const hydrationTimeout = window.setTimeout(() => {
      try {
        const storedValue = window.localStorage.getItem(storageKey);
        if (storedValue) {
          const parsed = JSON.parse(storedValue) as Partial<StoredTourState>;
          const validCompleted = Array.isArray(parsed.completed)
            ? parsed.completed.filter((id): id is DemoTourStepId => steps.some((step) => step.id === id))
            : [];
          setCompleted(validCompleted);
          setIsOpen(autoOpen || validCompleted.length < steps.length);
        } else {
          setIsOpen(true);
        }
      } catch {
        setIsOpen(true);
      }

      setIsHydrated(true);
    }, 0);

    return () => window.clearTimeout(hydrationTimeout);
  }, [autoOpen, steps, storageKey]);

  useEffect(() => {
    if (!isHydrated) return;

    const routeCompleted = steps
      .filter((step) => step.completionRoutes?.includes(pathname) && !completed.includes(step.id))
      .map((step) => step.id);

    if (routeCompleted.length === 0) return;

    const routeCompletionTimeout = window.setTimeout(() => {
      updateCompleted(routeCompleted);
      setIsOpen(true);
    }, 0);

    return () => window.clearTimeout(routeCompletionTimeout);
    // The route itself is the user's completed action for navigation-based steps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, isHydrated, pathname, steps]);

  useEffect(() => {
    function handleTourAction(event: Event) {
      const detail = (event as CustomEvent<DemoTourActionDetail>).detail;
      if (detail?.action !== "export" || detail.target !== "export-project") return;
      completeStep("export");
    }

    function handleTourOpen() {
      setIsOpen(true);
    }

    window.addEventListener(TOUR_ACTION_EVENT, handleTourAction);
    window.addEventListener(TOUR_OPEN_EVENT, handleTourOpen);

    return () => {
      window.removeEventListener(TOUR_ACTION_EVENT, handleTourAction);
      window.removeEventListener(TOUR_OPEN_EVENT, handleTourOpen);
    };
  }, [completeStep]);

  useEffect(() => {
    function handleTargetClick(event: MouseEvent) {
      if (!activeStep || activeStep.route !== pathname) return;

      const clickedElement = event.target;
      if (!(clickedElement instanceof Element)) return;

      const target = clickedElement.closest<HTMLElement>("[data-demo-tour-target]");
      if (target?.dataset.demoTourTarget === activeStep.target && activeStep.id !== "export") {
        completeStep(activeStep.id);
      }
    }

    document.addEventListener("click", handleTargetClick, true);
    return () => document.removeEventListener("click", handleTargetClick, true);
  }, [activeStep, completeStep, pathname]);

  useEffect(() => {
    if (!isOpen || !activeStep || !activeStepOnCurrentRoute) {
      return;
    }

    const targetSelector = `[data-demo-tour-target="${activeStep.target}"]`;
    let highlightedTarget: HTMLElement | null = null;
    let clickLabel: HTMLSpanElement | null = null;
    let retryTimeout: number | null = null;

    function removeTargetDecorations() {
      highlightedTarget?.classList.remove("demo-tour-highlight-violet");
      clickLabel?.remove();
      highlightedTarget = null;
      clickLabel = null;
    }

    function updateClickLabelPosition() {
      if (!highlightedTarget || !clickLabel) return;

      const rect = highlightedTarget.getBoundingClientRect();
      const viewportPadding = 16;
      const labelWidth = clickLabel.offsetWidth || 104;
      const labelHeight = clickLabel.offsetHeight || 32;
      const centeredLeft = rect.left + rect.width / 2;
      const minLeft = viewportPadding + labelWidth / 2;
      const maxLeft = Math.max(minLeft, window.innerWidth - viewportPadding - labelWidth / 2);
      const preferredTop = rect.top - labelHeight - 12;
      const fallbackTop = rect.bottom + 12;
      const top =
        preferredTop >= viewportPadding
          ? preferredTop
          : Math.min(fallbackTop, Math.max(viewportPadding, window.innerHeight - labelHeight - viewportPadding));

      clickLabel.style.left = `${Math.min(Math.max(centeredLeft, minLeft), maxLeft)}px`;
      clickLabel.style.top = `${top}px`;
    }

    function syncTarget() {
      const nextTarget = document.querySelector<HTMLElement>(targetSelector);

      if (!nextTarget) {
        retryTimeout = window.setTimeout(syncTarget, 120);
        return;
      }

      if (highlightedTarget === nextTarget && clickLabel) {
        updateClickLabelPosition();
        return;
      }

      removeTargetDecorations();
      highlightedTarget = nextTarget;
      highlightedTarget.classList.add("demo-tour-highlight-violet");
      clickLabel = document.createElement("span");
      clickLabel.className = "demo-tour-click-label-modern";
      clickLabel.textContent = "Click aquí";
      clickLabel.style.background = "var(--color-violet-700, #6d28d9)";
      clickLabel.style.border = "none";
      clickLabel.style.color = "#ffffff";
      clickLabel.setAttribute("aria-hidden", "true");
      document.body.appendChild(clickLabel);
      updateClickLabelPosition();
    }

    syncTarget();
    window.addEventListener("resize", updateClickLabelPosition);
    window.addEventListener("scroll", updateClickLabelPosition, true);

    return () => {
      if (retryTimeout !== null) {
        window.clearTimeout(retryTimeout);
      }
      window.removeEventListener("resize", updateClickLabelPosition);
      window.removeEventListener("scroll", updateClickLabelPosition, true);
      removeTargetDecorations();
    };
  }, [activeStep, activeStepOnCurrentRoute, isOpen]);

  function resetTour() {
    setCompleted([]);
    persistState(storageKey, []);
    setIsOpen(true);
  }

  if (!isHydrated) {
    return showGuideCard ? <DemoProjectGuideSkeleton /> : null;
  }

  return (
    <>
      {showGuideCard ? (
        <Card className="overflow-hidden rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-sm">
          <CardHeader className="relative space-y-4 border-b border-[var(--app-border-soft)] bg-[var(--color-violet-100)]/60 pb-5">
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-700/25 bg-violet-700/10 text-violet-700 dark:border-violet-300/25 dark:bg-violet-300/10 dark:text-violet-300">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">Ruta guiada</p>
                  <CardTitle className="mt-1 text-base text-[var(--app-text-strong)]">5 minutos para conocer MC Presupuestos</CardTitle>
                </div>
                <Badge className="border-[var(--app-border-soft)] bg-[var(--app-surface)] text-violet-700 hover:bg-[var(--app-surface-muted)] dark:text-violet-300">Demo</Badge>
              </div>
              <span className="rounded-full border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-bold text-[var(--app-text)]">
                {completedCount}/{steps.length} completados
              </span>
            </div>
            <p className="relative max-w-2xl text-sm leading-6 text-[var(--app-text-muted)]">
              Sigue una ruta práctica por presupuesto, APU, fórmula y exportación. El sistema te señalará el siguiente clic.
            </p>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--app-border-soft)]" aria-label={`${completedCount} de ${steps.length} pasos completados`}>
              <div
                className="h-full rounded-full bg-violet-700 transition-[width] duration-500 dark:bg-violet-400"
                style={{ width: `${steps.length ? (completedCount / steps.length) * 100 : 0}%` }}
              />
            </div>
          </CardHeader>
          <CardContent className="ui-card-content space-y-4 bg-[color-mix(in_oklab,var(--color-violet-100)_60%,transparent)] p-5">
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {steps.map((step, index) => {
                const isStepCompleted = completed.includes(step.id);
                return (
                  <li
                    key={step.id}
                    className={cn(
                      "relative rounded-xl border px-3 py-3 text-sm transition duration-200 hover:-translate-y-0.5",
                      isStepCompleted
                        ? "border-[var(--color-violet-300)] bg-[var(--color-violet-300)] text-violet-900 dark:text-violet-950"
                        : activeStep?.id === step.id
                          ? "border-violet-700/60 bg-[var(--color-violet-100)] text-[var(--app-text-strong)] shadow-sm dark:border-violet-400/60"
                          : "border-[var(--app-border-soft)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-violet-700/40 hover:bg-[var(--app-surface-muted)] dark:hover:border-violet-400/40",
                    )}
                    data-testid={`demo-tour-step-${step.id}`}
                  >
                    <div className="flex items-start gap-2">
                      {isStepCompleted ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-text-muted)]" aria-hidden="true" />
                      )}
                      <span>
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-current/70">Paso {index + 1}</span>
                        <span className="mt-1 block font-medium">{step.title}</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
            {!isOpen ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" className="gap-2 bg-violet-700 text-white hover:bg-violet-800 focus-visible:ring-violet-500/70" onClick={() => setIsOpen(true)}>
                  <HelpCircle className="h-4 w-4" />
                  {isComplete ? "Repasar tutorial" : "Abrir tutorial interactivo"}
                </Button>
                <p className="text-xs text-[var(--app-text-muted)]">Si la guía no se abre automáticamente, puedes iniciarla desde aquí.</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!showGuideCard && !isOpen ? (
        <Button
          type="button"
          variant="outline"
          className="fixed bottom-4 right-4 z-[100] gap-2 rounded-full border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-lg focus-visible:ring-violet-500/70"
          onClick={() => setIsOpen(true)}
        >
          <HelpCircle className="h-4 w-4 text-violet-700 dark:text-violet-300" />
          Guía interactiva
        </Button>
      ) : null}

      {isOpen ? (
        <aside
          aria-live="polite"
          aria-label="Tutorial interactivo del proyecto demo"
          className="theme-surface-card fixed bottom-4 right-4 z-[125] w-[min( calc(100vw-2rem),24rem)] rounded-2xl border border-[var(--app-border-soft)] p-4 shadow-2xl shadow-slate-950/20 dark:shadow-black/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Guía interactiva</p>
              <p className="mt-1 font-semibold text-[var(--app-text-strong)]">
                {isComplete ? "¡Tutorial completado!" : `Paso ${completedCount + 1} de ${steps.length}`}
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar guía interactiva"
              className="rounded-lg p-1.5 text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text-strong)]"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isComplete ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm leading-6 text-[var(--app-text-muted)]">
                Ya recorriste el flujo principal: presupuesto, estructura, APU, fórmula polinómica y exportación.
              </p>
              <Button type="button" variant="outline" className="w-full gap-2 border-[var(--app-border-soft)] bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]" onClick={resetTour}>
                <RotateCcw className="h-4 w-4" />
                Reiniciar tutorial
              </Button>
            </div>
          ) : activeStep ? (
            <div className="mt-4 space-y-3">
              <div>
                <p className="font-medium text-[var(--app-text-strong)]">{activeStep.title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--app-text-muted)]">{activeStep.description}</p>
              </div>
              <div className="rounded-xl border border-violet-700/25 bg-[var(--color-violet-100)] px-3 py-2.5 text-xs leading-5 text-[var(--app-text)] dark:border-violet-300/25">
                <span className="font-semibold">Qué debes hacer:</span> {activeStep.help}
              </div>
              {activeStepOnCurrentRoute ? (
                <p className="flex items-center gap-2 text-xs font-medium text-violet-700 dark:text-violet-300">
                  <CheckCircle2 className="h-4 w-4" />
                  El botón correcto está resaltado en la pantalla.
                </p>
              ) : (
                <Link
                  href={activeStep.route}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-700 bg-violet-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-800 active:translate-y-px"
                >
                  Ir al paso <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}

function buildDemoTourSteps(config: DemoProjectTourConfig): DemoTourStep[] {
  const generalBudgetRoute = config.generalBudgetId ? `/budgets/${config.generalBudgetId}` : `/projects/${config.projectId}`;
  const structuresRoute = config.structuresBudgetId ? `/budgets/${config.structuresBudgetId}` : generalBudgetRoute;
  const formulaRoute = config.generalBudgetId
    ? `/budgets/${config.generalBudgetId}/polynomial-formula`
    : generalBudgetRoute;

  return [
    {
      id: "general-budget",
      title: "Abre el presupuesto general",
      description: "Entra al consolidado que reúne los subpresupuestos del proyecto demo.",
      help: "Haz clic en “Abrir editor” o “Abrir presupuesto general”.",
      target: "open-general-budget",
      route: `/projects/${config.projectId}`,
      routeLabel: "proyecto demo",
      completionRoutes: [generalBudgetRoute],
    },
    {
      id: "structures",
      title: "Explora Estructuras",
      description: "Abre el subpresupuesto de estructuras para ver cómo se organiza una obra real.",
      help: "Busca la tarjeta “Estructuras” y pulsa “Abrir Sub Presupuesto”.",
      target: "open-structures",
      route: generalBudgetRoute,
      routeLabel: "presupuesto general",
      completionRoutes: [structuresRoute],
    },
    {
      id: "apu",
      title: "Abre una partida y su APU",
      description: "Revisa una partida y entra a su análisis de precios unitarios.",
      help: "En la tabla, pulsa el botón “APU” de cualquier partida visible.",
      target: "open-apu",
      route: structuresRoute,
      routeLabel: "subpresupuesto de estructuras",
      completionRoutes: [structuresRoute],
    },
    {
      id: "formula",
      title: "Revisa la fórmula polinómica",
      description: "Conoce cómo se organizan los monomios e índices para el reajuste de precios.",
      help: "Abre “Fórmula polinómica” desde las otras secciones del presupuesto general.",
      target: "open-formula",
      route: formulaRoute,
      routeLabel: "fórmula polinómica",
      completionRoutes: [formulaRoute],
    },
    {
      id: "export",
      title: "Exporta el proyecto",
      description: "Genera un archivo para compartir o continuar trabajando fuera de MC Presupuestos.",
      help: "Vuelve al proyecto, pulsa “Exportar” y descarga el archivo .mcp.",
      target: "export-project",
      route: `/projects/${config.projectId}`,
      routeLabel: "proyecto demo",
    },
  ];
}

function persistState(storageKey: string, completed: DemoTourStepId[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({ completed } satisfies StoredTourState));
  } catch {
    // Progress remains available for the current session when storage is unavailable.
  }
}

function DemoProjectGuideSkeleton() {
  return <div className="min-h-40 rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)]" aria-hidden="true" />;}
