"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  QualityMetricsHeader,
  QualityMetricsGrid,
  AcceptanceBar,
  QualityMetricsEmpty,
  ProviderQualityTable,
} from "@/components/ai/khipu-quality-metrics-ui";
import type { FeedbackSummary, FeedbackTrendPoint } from "@/components/ai/khipu-quality-metrics-ui";
import { FeedbackTrendChart } from "@/components/ai/feedback-trend-chart";

type ApiResponse = {
  summary: FeedbackSummary;
  trends: FeedbackTrendPoint[];
};

export function KhipuQualityMetricsPanel() {
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [trends, setTrends] = useState<FeedbackTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchSummary() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/ai/feedback/user-summary");
        if (!response.ok) {
          throw new Error("No se pudieron cargar las metricas de calidad.");
        }
        const payload: ApiResponse = await response.json();
        if (!cancelled) {
          setSummary(payload.summary);
          setTrends(payload.trends);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Error al cargar metricas.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchSummary();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2 text-sm">Cargando metricas de calidad...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      </section>
    );
  }

  if (!summary) return null;

  return (
    <section className="space-y-4">
      <QualityMetricsHeader total={summary.total} />
      <QualityMetricsGrid summary={summary} />

      {summary.total > 0 ? (
        <AcceptanceBar summary={summary} />
      ) : (
        <QualityMetricsEmpty />
      )}

      <FeedbackTrendChart trends={trends} />

      {summary.providerQuality.length > 0 ? (
        <ProviderQualityTable providers={summary.providerQuality} />
      ) : null}
    </section>
  );
}
