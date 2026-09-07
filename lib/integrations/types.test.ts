import { describe, expect, it } from "vitest";
import { assertValidIntegrationTransition, isValidIntegrationTransition } from "./types";
describe("integration state machine", () => {
  it("allows the controlled forward lifecycle", () => { expect(isValidIntegrationTransition("DRAFT", "STAGED")).toBe(true); expect(isValidIntegrationTransition("PREVIEW_READY", "CONFIRMED")).toBe(true); expect(isValidIntegrationTransition("CONFIRMED", "APPLIED")).toBe(true); expect(isValidIntegrationTransition("APPLIED", "ROLLED_BACK")).toBe(true); });
  it("rejects terminal and backward transitions", () => { expect(isValidIntegrationTransition("APPLIED", "CONFIRMED")).toBe(false); expect(() => assertValidIntegrationTransition("ROLLED_BACK", "APPLIED")).toThrow(/inválida/); });
});
