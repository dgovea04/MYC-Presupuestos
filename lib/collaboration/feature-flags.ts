const DISABLED_VALUES = new Set(["0", "false", "off", "disabled"]);

export async function isCollaborationEnabled(companyId: string): Promise<boolean> {
  if (DISABLED_VALUES.has((process.env.COLLABORATION_ENABLED ?? "true").toLowerCase())) return false;
  void companyId;
  return true;
}
