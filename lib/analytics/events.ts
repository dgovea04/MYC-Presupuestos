export type AnalyticsEventName =
  | "demo_project_created"
  | "demo_project_creation_failed"
  | "demo_project_already_exists";

export type AnalyticsEventPayload = {
  userId: string;
  companyId: string;
  projectId?: string | null;
  generalBudgetId?: string | null;
  warnings?: string[];
};

export async function trackServerEvent(
  name: AnalyticsEventName,
  payload: AnalyticsEventPayload,
): Promise<void> {
  void name;
  void payload;
}
