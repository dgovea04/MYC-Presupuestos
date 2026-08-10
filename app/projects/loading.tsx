import { AppShell } from "@/components/layout/app-shell";
import { CatalogPageSkeleton } from "@/components/loading/catalog-page-skeleton";

export default async function ProjectsLoading() {
  return (
    <AppShell>
      <CatalogPageSkeleton kind="projects" />
    </AppShell>
  );
}
