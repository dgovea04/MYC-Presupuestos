import { AppShell } from "@/components/layout/app-shell";
import { PageSkeletonFrame } from "@/components/loading/page-skeleton-frame";
import { SkeletonCard, SkeletonTable, SkeletonText } from "@/components/ui/loading";

export default async function ProjectDetailLoading() {
  return (
    <AppShell>
      <PageSkeletonFrame aria-label="Cargando proyecto" actions={2} descriptionWidth="w-96" titleWidth="w-64">
        <section className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} className="min-h-[112px]">
              <SkeletonText lines={2} widths={["w-20", "w-28"]} />
            </SkeletonCard>
          ))}
        </section>
        <SkeletonTable
          aria-label="Cargando presupuestos del proyecto"
          columns={[
            { id: "name", width: "w-full" },
            { id: "amount", width: "w-28", align: "right" },
            { id: "status", width: "w-24" },
            { id: "actions", width: "w-16", align: "right" },
          ]}
          rowCount={5}
        />
      </PageSkeletonFrame>
    </AppShell>
  );
}
