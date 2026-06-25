import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <>
      {/* Stats skeleton */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="overflow-hidden border-slate-200 bg-white">
            <CardContent className="space-y-4 py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded-md bg-slate-200" />
                  <div className="h-8 w-16 animate-pulse rounded-md bg-slate-200" />
                  <div className="h-4 w-32 animate-pulse rounded-md bg-slate-100" />
                </div>
                <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-100" />
              </div>
              <div className="h-8 w-full animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Main sections skeleton */}
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="h-full border-slate-200">
          <CardContent className="flex h-full flex-col gap-5 p-6">
            <div className="space-y-1">
              <div className="h-5 w-48 animate-pulse rounded-md bg-slate-200" />
              <div className="h-4 w-64 animate-pulse rounded-md bg-slate-100" />
            </div>
            <div className="flex flex-1 flex-col justify-between gap-5">
              <div className="space-y-2">
                <div className="h-8 w-72 animate-pulse rounded-md bg-slate-200" />
                <div className="h-4 w-48 animate-pulse rounded-md bg-slate-100" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full border-slate-200">
          <CardContent className="flex h-full flex-col gap-4 p-6">
            <div className="space-y-1">
              <div className="h-5 w-36 animate-pulse rounded-md bg-slate-200" />
              <div className="h-4 w-56 animate-pulse rounded-md bg-slate-100" />
            </div>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="h-10 w-10 animate-pulse rounded-2xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded-md bg-slate-200" />
                  <div className="h-3 w-56 animate-pulse rounded-md bg-slate-100" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Pending items skeleton */}
      <section className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="min-h-full">
          <CardContent className="space-y-4 p-6">
            <div className="space-y-1">
              <div className="h-5 w-48 animate-pulse rounded-md bg-slate-200" />
              <div className="h-4 w-72 animate-pulse rounded-md bg-slate-100" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-16 animate-pulse rounded-full bg-slate-100" />
                      <div className="flex gap-2">
                        <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
                        <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
                      </div>
                    </div>
                    <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-full border-slate-200">
          <CardContent className="space-y-3 p-6">
            <div className="space-y-1">
              <div className="h-5 w-36 animate-pulse rounded-md bg-slate-200" />
              <div className="h-4 w-56 animate-pulse rounded-md bg-slate-100" />
            </div>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded-md bg-slate-200" />
                  <div className="h-3 w-48 animate-pulse rounded-md bg-slate-100" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
