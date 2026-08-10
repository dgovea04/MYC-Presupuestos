import { AppShell } from "@/components/layout/app-shell";
import { CatalogPageSkeleton } from "@/components/loading/catalog-page-skeleton";

export default async function TemplatesLoading() {
  return (
    <AppShell>
      <CatalogPageSkeleton kind="templates" />
    </AppShell>
  );
}
