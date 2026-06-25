import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KhipuQualityMetricsSkeleton() {
  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader className="px-5 py-4">
        <CardTitle className="text-base font-medium">
          <span className="inline-block h-5 w-40 animate-pulse rounded-md bg-slate-200" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
        <div className="h-4 w-full animate-pulse rounded-full bg-slate-200" />
        <div className="h-52 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
      </CardContent>
    </Card>
  );
}
