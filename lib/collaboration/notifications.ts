export type CollaborationNotificationEvent = { key: string; type: "MENTION" | "REPLY" | "RESOLUTION" | "CONFLICT" | "RESTORATION"; recipientUserId: string; budgetId: string };
const emitted = new Set<string>();
export async function emitCollaborationNotification(event: CollaborationNotificationEvent): Promise<void> {
  if (emitted.has(event.key)) return;
  emitted.add(event.key);
}
export function clearCollaborationNotifications(): void { emitted.clear(); }
