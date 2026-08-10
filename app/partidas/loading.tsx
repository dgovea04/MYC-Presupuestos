import { AppShell } from "@/components/layout/app-shell";
import { CatalogPageSkeleton } from "@/components/loading/catalog-page-skeleton";

export default async function PartidasLoading() {
  return (
    <AppShell>
      <CatalogPageSkeleton kind="partidas" />
    </AppShell>
  );
}
