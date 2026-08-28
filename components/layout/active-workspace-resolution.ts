export function selectActiveWorkspaceId(input: {
  requestWorkspaceId: string | null;
  userWorkspaceId?: string | null;
  fallbackWorkspaceId?: string | null;
}): string | null {
  return input.requestWorkspaceId ?? input.userWorkspaceId ?? input.fallbackWorkspaceId ?? null;
}
