import { AppShell } from "@/components/layout/app-shell";
import { ProjectDetailPageSkeleton } from "@/components/loading/project-detail-page-skeleton";

export default async function ProjectDetailLoading() {
  return (
    <AppShell>
      <ProjectDetailPageSkeleton />
    </AppShell>
  );
}
