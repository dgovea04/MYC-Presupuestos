import { describe, expect, it } from "vitest";
import { selectActiveWorkspaceId } from "@/components/layout/active-workspace-resolution";

describe("selectActiveWorkspaceId", () => {
  it("prioritizes the workspace resolved from the current request cookie", () => {
    expect(
      selectActiveWorkspaceId({
        requestWorkspaceId: "workspace-current",
        userWorkspaceId: "workspace-stale",
        fallbackWorkspaceId: "workspace-fallback",
      }),
    ).toBe("workspace-current");
  });
});
