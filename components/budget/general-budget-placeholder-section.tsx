import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {highlights.map((highlight) => (
          <div key={highlight.title} className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="font-medium text-slate-900">{highlight.title}</p>
            <p className="mt-2 text-sm text-slate-600">{highlight.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
