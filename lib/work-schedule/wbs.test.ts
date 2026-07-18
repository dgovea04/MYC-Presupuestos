import { describe, expect, it } from "vitest";
import { buildWbsCodeByNodeId, type WorkScheduleWbsNode } from "./wbs";

describe("buildWbsCodeByNodeId", () => {
  it("assigns root codes to top-level nodes", () => {
    const nodes = [
      { id: "a", parentId: null, sortOrder: 0 },
      { id: "b", parentId: null, sortOrder: 1 },
    ];
    const result = buildWbsCodeByNodeId(nodes);
    expect(result.get("a")).toBe("1");
    expect(result.get("b")).toBe("2");
  });

  it("assigns nested codes to children", () => {
    const nodes = [
      { id: "a", parentId: null, sortOrder: 0 },
      { id: "b", parentId: "a", sortOrder: 0 },
      { id: "c", parentId: "a", sortOrder: 1 },
    ];
    const result = buildWbsCodeByNodeId(nodes);
    expect(result.get("a")).toBe("1");
    expect(result.get("b")).toBe("1.1");
    expect(result.get("c")).toBe("1.2");
  });

  it("assigns grandchild codes", () => {
    const nodes = [
      { id: "a", parentId: null, sortOrder: 0 },
      { id: "b", parentId: "a", sortOrder: 0 },
      { id: "c", parentId: "b", sortOrder: 0 },
    ];
    const result = buildWbsCodeByNodeId(nodes);
    expect(result.get("a")).toBe("1");
    expect(result.get("b")).toBe("1.1");
    expect(result.get("c")).toBe("1.1.1");
  });

  it("sorts by sortOrder", () => {
    const nodes = [
      { id: "a", parentId: null, sortOrder: 2 },
      { id: "b", parentId: null, sortOrder: 1 },
    ];
    const result = buildWbsCodeByNodeId(nodes);
    expect(result.get("a")).toBe("2");
    expect(result.get("b")).toBe("1");
  });

  it("does not mutate input nodes", () => {
    const nodes = [{ id: "a", parentId: null, sortOrder: 0 }];
    const original = [...nodes];
    buildWbsCodeByNodeId(nodes);
    expect(nodes).toEqual(original);
  });
});

describe("buildWbsCodeByNodeId - integration", () => {
  it("genera codigos WBS multinivel consistentes con sortOrder realista y preserva jerarquia profunda", () => {
    // Jerarquia realista de presupuesto de obra peruano con sortOrder gaps
    // intencionales para verificar que los codigos NO reflejan los gaps sino el
    // orden secuencial tras ordenar por sortOrder:
    //   1. Obras Provisionales (sortOrder 1)
    //     1.1 Oficinas (sortOrder 1)
    //     1.2 Cerco de obra (sortOrder 2)
    //   2. Estructuras (sortOrder 5 — gap intencional en sortOrder)
    //     2.1 Movimiento de tierras (sortOrder 1)
    //       2.1.1 Excavacion de zanjas (sortOrder 10 — gap intencional)
    //     2.2 Concreto armado (sortOrder 2)
    //   3. Arquitectura (sortOrder 10 — gap intencional)
    const nodes: WorkScheduleWbsNode[] = [
      { id: "n_obras_provisionales", parentId: null, sortOrder: 1 },
      { id: "n_estructuras", parentId: null, sortOrder: 5 },
      { id: "n_arquitectura", parentId: null, sortOrder: 10 },
      { id: "n_oficinas", parentId: "n_obras_provisionales", sortOrder: 1 },
      { id: "n_cerco_obra", parentId: "n_obras_provisionales", sortOrder: 2 },
      { id: "n_mov_tierras", parentId: "n_estructuras", sortOrder: 1 },
      { id: "n_concreto_armado", parentId: "n_estructuras", sortOrder: 2 },
      { id: "n_excavacion_zanjas", parentId: "n_mov_tierras", sortOrder: 10 },
    ];
    const snapshotBefore = JSON.parse(JSON.stringify(nodes));

    const firstResult = buildWbsCodeByNodeId(nodes);

    // 1. Idempotencia: misma entrada produce misma salida.
    const secondResult = buildWbsCodeByNodeId(nodes);
    expect(Array.from(firstResult.entries())).toEqual(Array.from(secondResult.entries()));

    // 2. Envelope: cubre los 8 nodos.
    expect(firstResult.size).toBe(nodes.length);

    // 3. Roots: codigos "1", "2", "3" (sortOrder gaps IGNORADAS;
    //    los codigos son secuenciales tras ordenar por sortOrder).
    expect(firstResult.get("n_obras_provisionales")).toBe("1");
    expect(firstResult.get("n_estructuras")).toBe("2");
    expect(firstResult.get("n_arquitectura")).toBe("3");

    // 4. Children nivel 2: "X.Y" donde X = codigo del parent.
    expect(firstResult.get("n_oficinas")).toBe("1.1");
    expect(firstResult.get("n_cerco_obra")).toBe("1.2");
    expect(firstResult.get("n_mov_tierras")).toBe("2.1");
    expect(firstResult.get("n_concreto_armado")).toBe("2.2");

    // 5. Grandchild nivel 3: deep nesting "X.Y.Z" preserva la cadena.
    expect(firstResult.get("n_excavacion_zanjas")).toBe("2.1.1");

    // 6. No mutacion del input (regression catcher contra side-effects).
    expect(nodes).toEqual(snapshotBefore);

    // 7. Cross-invariant: todos los codigos cumplen regex WBS canonico (digits.digits.digits...).
    const wbsRegex = /^\d+(\.\d+)*$/;
    for (const code of firstResult.values()) {
      expect(code).toMatch(wbsRegex);
    }

    // 8. Cross-invariant: profundidad del codigo = nivel jerarquico del nodo.
    for (const node of nodes) {
      const code = firstResult.get(node.id);
      if (!code) {
        throw new Error(`missing code for ${node.id}`);
      }
      const codeDepth = code.split(".").length;
      const hierarchyDepth = computeHierarchyDepth(node, nodes);
      expect(codeDepth).toBe(hierarchyDepth);
    }

    // 9. Cross-invariant: orden de siblings por sortOrder se preserva en el codigo.
    //    sortOrder gaps no influyen: n_excavacion_zanjas tiene sortOrder 10 pero
    //    es el unico hijo de n_mov_tierras, por lo que su codigo es 2.1.1 (no 2.1.10).
    expect(firstResult.get("n_excavacion_zanjas")).toBe("2.1.1");
  });
});

// Helper: cuenta niveles jerarquicos de un nodo hasta el root.
function computeHierarchyDepth(node: WorkScheduleWbsNode, allNodes: WorkScheduleWbsNode[]): number {
  let depth = 1;
  let current: WorkScheduleWbsNode | undefined = node;
  while (current && current.parentId !== null) {
    const parent = allNodes.find((n) => n.id === current!.parentId);
    if (!parent) {
      break;
    }
    depth++;
    current = parent;
  }
  return depth;
}
