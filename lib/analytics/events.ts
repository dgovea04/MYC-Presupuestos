export type AnalyticsEventName =
  | "demo_project_created"
  | "demo_project_creation_failed"
  | "demo_project_already_exists"
  | "demo_project_opened"
  | "demo_budget_opened"
  | "demo_apu_opened"
  | "demo_formula_opened"
  | "demo_export_completed"
  | "first_non_demo_project_created";

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
