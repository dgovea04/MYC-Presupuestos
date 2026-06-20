import { getAuthSession } from "@/lib/auth/session";
import { getUserAiFeedbackSummary, getUserFeedbackTrends } from "@/lib/ai/suggestion-feedback";
import {
  QualityMetricsHeader,
  QualityMetricsGrid,
  AcceptanceBar,
  QualityMetricsEmpty,
  ProviderQualityTable,
} from "@/components/ai/khipu-quality-metrics-ui";
import type { FeedbackSummary, FeedbackTrendPoint } from "@/components/ai/khipu-quality-metrics-ui";
import { FeedbackTrendChart } from "@/components/ai/feedback-trend-chart";

export async function KhipuQualityMetrics() {
  const session = await getAuthSession();
  if (!session?.user?.id) return null;

  const [summary, trends] = await Promise.all([
    getUserAiFeedbackSummary({ userId: session.user.id }),
    getUserFeedbackTrends({ userId: session.user.id }),
  ]);

  const typedSummary: FeedbackSummary = summary;
  const typedTrends: FeedbackTrendPoint[] = trends;

  return (
    <section className="space-y-4">
      <QualityMetricsHeader total={typedSummary.total} />
      <QualityMetricsGrid summary={typedSummary} />

      {typedSummary.total > 0 ? (
        <AcceptanceBar summary={typedSummary} />
      ) : (
        <QualityMetricsEmpty />
      )}

      <FeedbackTrendChart trends={typedTrends} />

      {typedSummary.providerQuality.length > 0 ? (
        <ProviderQualityTable providers={typedSummary.providerQuality} />
      ) : null}
    </section>
  );
}
