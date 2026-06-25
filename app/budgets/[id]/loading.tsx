import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeaderCard } from "@/components/ui/page-header-card";
import { FileSpreadsheet } from "lucide-react";

export default function BudgetDetailLoading() {
  return (
    <div className="space-y-5">
      <Card className="theme-surface-card rounded-2xl">
        <CardHeader className="theme-surface-card-gradient gap-4 rounded-2xl">
          <PageHeaderCard
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title={<div className="h-7 w-64 animate-pulse rounded-md bg-slate-200" />}
            description={<div className="h-4 w-96 animate-pulse rounded-md bg-slate-100" />}
          />
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="theme-surface-card rounded-2xl">
          <CardHeader>
            <div className="space-y-2">
              <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200" />
              <div className="h-4 w-72 animate-pulse rounded-md bg-slate-100" />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200" />
                    <div className="h-4 w-32 animate-pulse rounded-md bg-slate-100" />
                  </div>
                  <div className="h-6 w-28 animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="h-full border-slate-200 bg-white">
          <CardContent className="flex h-full flex-col gap-4 p-6">
            <div className="space-y-1">
              <div className="h-5 w-48 animate-pulse rounded-md bg-slate-200" />
              <div className="h-4 w-64 animate-pulse rounded-md bg-slate-100" />
            </div>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="h-10 w-10 animate-pulse rounded-2xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 animate-pulse rounded-md bg-slate-200" />
                  <div className="h-3 w-48 animate-pulse rounded-md bg-slate-100" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
