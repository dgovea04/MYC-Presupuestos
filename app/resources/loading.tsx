import { AppShell } from "@/components/layout/app-shell";
import { CatalogPageSkeleton } from "@/components/loading/catalog-page-skeleton";

export default async function ResourcesLoading() {
  return (
    <AppShell>
      <CatalogPageSkeleton kind="resources" />
    </AppShell>
  );
}
