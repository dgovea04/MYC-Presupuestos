import { describe, expect, it, beforeEach } from "vitest";
import { clearIntegrationAdapters, getIntegrationAdapter, listIntegrationAdapters, registerIntegrationAdapter } from "./registry";
import type { IntegrationAdapter } from "./types";
describe("integration registry", () => {
  beforeEach(() => clearIntegrationAdapters());
  it("registers adapters and rejects duplicate ids", () => { const adapter: IntegrationAdapter<string, string> = { id: "test", contractVersion: "1", capabilities: { import: true, export: false, rollback: false, formats: ["test"] }, stage: async (input) => input, validate: async () => ({ rows: [], conflicts: [], counts: { total: 0, valid: 0, conflicts: 0 }, payloadHash: "" }), preview: async () => ({ rows: [], conflicts: [], counts: { total: 0, valid: 0, conflicts: 0 }, payloadHash: "" }), apply: async () => ({ appliedCount: 0 }), rollback: async () => ({ rolledBackCount: 0 }) }; registerIntegrationAdapter(adapter); expect(listIntegrationAdapters()).toEqual(["test"]); expect(getIntegrationAdapter("test")).toBe(adapter); expect(() => registerIntegrationAdapter(adapter)).toThrow(/registrado/); });
});
