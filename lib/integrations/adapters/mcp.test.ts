import { describe, expect, it } from "vitest";
import { mcpAdapter } from "./mcp";
import { buildFullProjectPackageBuffer } from "@/lib/mcp/fixtures/full-project-package";

describe("MCP integration adapter", () => {
  it("stages rows from the real MCP package parser", async () => {
    const buffer = await buildFullProjectPackageBuffer();
    const result = await mcpAdapter.stage({ buffer, sourceName: "fixture.mcp" });
    expect(result.payloadHash).toHaveLength(64);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0]?.provenance.source).toBe("fixture.mcp");
  });
});
