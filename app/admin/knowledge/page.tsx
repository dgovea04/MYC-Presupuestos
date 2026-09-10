import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import { isKnowledgeFeatureEnabled } from "@/lib/knowledge/feature-flags";

export default async function KnowledgeAdminPage() {
  const session = await requireAdminSession("audit.read");
  if (!session) redirect("/dashboard");
  if (!isKnowledgeFeatureEnabled("adminReviewQueue")) redirect("/admin");
  redirect("/admin?adminTab=knowledge");
}
