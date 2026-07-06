import type { WorkScheduleLineRecord } from "@/types/work-schedule";
import { tryParseWorkSchedulePredecessors, type WorkSchedulePredecessorRelation } from "@/lib/work-schedule/predecessors";

export type WorkScheduleCriticalPathItem = {
  budgetItemId: string;
  itemCode: string;
  durationDays: number;
  earlyStartDay: number;
  earlyFinishDay: number;
  lateStartDay: number;
  lateFinishDay: number;
  totalSlackDays: number;
  isCritical: boolean;
};

export type WorkScheduleCriticalPathResult = {
  status: "calculated" | "cycle";
  projectDurationDays: number;
  itemsByBudgetItemId: Map<string, WorkScheduleCriticalPathItem>;
  issues: string[];
};

type CriticalPathNode = {
  budgetItemId: string;
  itemCode: string;
  durationDays: number;
};

type CriticalPathEdge = {
  predecessorId: string;
  successorId: string;
  offsetDays: number;
};

export function calculateWorkScheduleCriticalPath(lines: WorkScheduleLineRecord[]): WorkScheduleCriticalPathResult {
  const nodes = lines
    .filter((line) => line.durationDays != null && line.durationDays > 0)
    .map<CriticalPathNode>((line) => ({
      budgetItemId: line.budgetItemId,
      itemCode: line.itemCode,
      durationDays: line.durationDays ?? 1,
    }));
  const nodesByItemCode = new Map(nodes.map((node) => [node.itemCode, node]));
  const nodesById = new Map(nodes.map((node) => [node.budgetItemId, node]));
  const issues: string[] = [];
  const edges: CriticalPathEdge[] = [];

  for (const line of lines) {
    const successor = nodesById.get(line.budgetItemId);
    if (!successor) {
      continue;
    }

    const parsedPredecessors = tryParseWorkSchedulePredecessors(line.predecessor);
    if (!parsedPredecessors) {
      continue;
    }

    for (const reference of parsedPredecessors) {
      const predecessor = nodesByItemCode.get(reference.code);
      if (!predecessor) {
        issues.push(`La predecesora ${reference.code} no existe en este cronograma`);
        continue;
      }

      edges.push({
        predecessorId: predecessor.budgetItemId,
        successorId: successor.budgetItemId,
        offsetDays: relationToStartOffsetDays(reference.relation, reference.lagDays, predecessor.durationDays, successor.durationDays),
      });
    }
  }

  const topologicalOrder = buildTopologicalOrder(nodes, edges);
  if (!topologicalOrder) {
    return {
      status: "cycle",
      projectDurationDays: 0,
      itemsByBudgetItemId: new Map(),
      issues: ["El cronograma contiene un ciclo de predecesoras"],
    };
  }

  const earlyStartById = new Map(nodes.map((node) => [node.budgetItemId, 0]));
  for (const nodeId of topologicalOrder) {
    const earlyStart = earlyStartById.get(nodeId) ?? 0;
    for (const edge of edges) {
      if (edge.predecessorId !== nodeId) {
        continue;
      }

      const successorStart = Math.max(earlyStartById.get(edge.successorId) ?? 0, earlyStart + edge.offsetDays);
      earlyStartById.set(edge.successorId, successorStart);
    }
  }

  const projectFinishDay = topologicalOrder.reduce((latestFinish, nodeId) => {
    const node = nodesById.get(nodeId);
    if (!node) {
      return latestFinish;
    }

    return Math.max(latestFinish, (earlyStartById.get(nodeId) ?? 0) + node.durationDays - 1);
  }, 0);
  const latestStartById = new Map(
    nodes.map((node) => [node.budgetItemId, projectFinishDay - node.durationDays + 1]),
  );

  for (const nodeId of [...topologicalOrder].reverse()) {
    for (const edge of edges) {
      if (edge.predecessorId !== nodeId) {
        continue;
      }

      const predecessorLatestStart = Math.min(
        latestStartById.get(edge.predecessorId) ?? Number.POSITIVE_INFINITY,
        (latestStartById.get(edge.successorId) ?? 0) - edge.offsetDays,
      );
      latestStartById.set(edge.predecessorId, predecessorLatestStart);
    }
  }

  const itemsByBudgetItemId = new Map<string, WorkScheduleCriticalPathItem>();
  for (const node of nodes) {
    const earlyStartDay = earlyStartById.get(node.budgetItemId) ?? 0;
    const lateStartDay = latestStartById.get(node.budgetItemId) ?? earlyStartDay;
    const totalSlackDays = Math.max(0, lateStartDay - earlyStartDay);

    itemsByBudgetItemId.set(node.budgetItemId, {
      budgetItemId: node.budgetItemId,
      itemCode: node.itemCode,
      durationDays: node.durationDays,
      earlyStartDay,
      earlyFinishDay: earlyStartDay + node.durationDays - 1,
      lateStartDay,
      lateFinishDay: lateStartDay + node.durationDays - 1,
      totalSlackDays,
      isCritical: totalSlackDays === 0,
    });
  }

  return {
    status: "calculated",
    projectDurationDays: projectFinishDay + 1,
    itemsByBudgetItemId,
    issues,
  };
}

function relationToStartOffsetDays(
  relation: WorkSchedulePredecessorRelation,
  lagDays: number,
  predecessorDurationDays: number,
  successorDurationDays: number,
) {
  if (relation === "SS") {
    return lagDays;
  }

  if (relation === "FF") {
    return predecessorDurationDays - successorDurationDays + lagDays;
  }

  if (relation === "SF") {
    return -successorDurationDays + 1 + lagDays;
  }

  return predecessorDurationDays + lagDays;
}

function buildTopologicalOrder(nodes: CriticalPathNode[], edges: CriticalPathEdge[]) {
  const inDegreeById = new Map(nodes.map((node) => [node.budgetItemId, 0]));
  const outgoingEdgesById = new Map<string, CriticalPathEdge[]>();

  for (const edge of edges) {
    inDegreeById.set(edge.successorId, (inDegreeById.get(edge.successorId) ?? 0) + 1);
    const outgoingEdges = outgoingEdgesById.get(edge.predecessorId) ?? [];
    outgoingEdges.push(edge);
    outgoingEdgesById.set(edge.predecessorId, outgoingEdges);
  }

  const queue = nodes
    .filter((node) => (inDegreeById.get(node.budgetItemId) ?? 0) === 0)
    .map((node) => node.budgetItemId);
  const order: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) {
      continue;
    }

    order.push(nodeId);

    for (const edge of outgoingEdgesById.get(nodeId) ?? []) {
      const nextInDegree = (inDegreeById.get(edge.successorId) ?? 0) - 1;
      inDegreeById.set(edge.successorId, nextInDegree);
      if (nextInDegree === 0) {
        queue.push(edge.successorId);
      }
    }
  }

  return order.length === nodes.length ? order : null;
}
