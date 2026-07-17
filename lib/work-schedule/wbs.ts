export type WorkScheduleWbsNode = {
  id: string;
  parentId: string | null;
  sortOrder: number;
};

function buildWbsCodeByNodeIdRecursive(
  nodes: WorkScheduleWbsNode[],
  parentId: string | null,
  prefix: string,
): Map<string, string> {
  const result = new Map<string, string>();
  const children = nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    const code = prefix ? `${prefix}.${index + 1}` : String(index + 1);
    result.set(child.id, code);
    const childCodes = buildWbsCodeByNodeIdRecursive(nodes, child.id, code);
    for (const [id, childCode] of childCodes.entries()) {
      result.set(id, childCode);
    }
  }

  return result;
}

/**
 * Build a map of WBS codes by node id.
 * Root nodes get codes like "1", "2"; children get "1.1", "1.2", etc.
 * Does not mutate the input nodes.
 */
export function buildWbsCodeByNodeId(nodes: WorkScheduleWbsNode[]): Map<string, string> {
  return buildWbsCodeByNodeIdRecursive(nodes, null, "");
}
