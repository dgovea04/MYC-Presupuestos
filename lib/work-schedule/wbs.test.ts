import { describe, expect, it } from "vitest";
import { buildWbsCodeByNodeId } from "./wbs";

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
