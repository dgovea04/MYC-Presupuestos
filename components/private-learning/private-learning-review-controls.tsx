"use client";
import { useEffect, useState } from "react";
import { PrivateLearningSettings } from "./private-learning-settings";

type Example = { id: string; signalType: string; sourceType: string; status: string; expiresAt: string };
export function PrivateLearningReviewControls({ companyId, canManage }: { companyId: string; canManage: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [examples, setExamples] = useState<Example[]>([]);
  useEffect(() => { let active = true; void Promise.all([fetch(`/api/companies/${encodeURIComponent(companyId)}/private-learning/settings`), fetch(`/api/companies/${encodeURIComponent(companyId)}/private-learning/examples?limit=20`)]).then(async ([settingsResponse, examplesResponse]) => { const settings = await settingsResponse.json() as { policy?: { enabled?: boolean } }; const examplePayload = await examplesResponse.json() as { examples?: Example[] }; if (active) { setEnabled(settings.policy?.enabled === true); setExamples(examplePayload.examples ?? []); } }).catch(() => undefined); return () => { active = false; }; }, [companyId]);
  async function toggle(nextEnabled: boolean) { const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}/private-learning/settings`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: nextEnabled }) }); if (response.ok) setEnabled(nextEnabled); }
  async function revoke(exampleId: string) { const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}/private-learning/examples/${encodeURIComponent(exampleId)}/revoke`, { method: "POST" }); if (response.ok) setExamples((current) => current.map((example) => example.id === exampleId ? { ...example, status: "REVOKED" } : example)); }
  return <PrivateLearningSettings enabled={enabled} examples={examples} canManage={canManage} onToggle={(nextEnabled) => { void toggle(nextEnabled); }} onRevoke={(exampleId) => { void revoke(exampleId); }} />;
}
