import { Card, CardContent } from "@/components/ui/card";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { OperationalPanel } from "@/components/ui/operational-surfaces";

export function GeneralBudgetPlaceholderSection({
  title,
  description,
  highlights,
}: {
  title: string;
  description: string;
  highlights: Array<{ title: string; detail: string }>;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <OperationalPanel title={title} description={description} metrics={<span>{highlights.length} lineas de roadmap</span>} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {highlights.map((highlight) => (
            <EmptyStatePanel
              key={highlight.title}
              className="space-y-2 p-4"
            >
              <p className="font-medium text-slate-900">{highlight.title}</p>
              <p className="text-sm text-slate-600">{highlight.detail}</p>
            </EmptyStatePanel>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
