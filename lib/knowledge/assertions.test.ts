import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertAssertionTransition } from "./assertions";

const { assertion, conflict, findingDecision, canonicalItem, itemProvenance, recordKnowledgeEvent } = vi.hoisted(() => ({ assertion: { upsert: vi.fn().mockResolvedValue({ id: "a1", status: "OBSERVED" }), findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({ id: "a1", status: "CONFIRMED" }) }, conflict: { upsert: vi.fn().mockResolvedValue({ id: "c1", status: "OPEN" }), findUnique: vi.fn(), update: vi.fn().mockResolvedValue({ id: "c1", status: "RESOLVED" }) }, findingDecision: { findUnique: vi.fn() }, canonicalItem: { findMany: vi.fn(), create: vi.fn().mockResolvedValue({ id: "item-1" }) }, itemProvenance: { upsert: vi.fn() }, recordKnowledgeEvent: vi.fn().mockResolvedValue({ event: { id: "event-1" }, created: true }) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { knowledgeAssertion: assertion, knowledgeAssertionConflict: conflict, findingDecision, canonicalItem, knowledgeCanonicalItemProvenance: itemProvenance } }));
vi.mock("@/lib/workspace/access", () => ({ assertWorkspaceMembership: vi.fn().mockResolvedValue({ companyId: "c1", role: "EDITOR" }) }));
vi.mock("./events", () => ({ recordKnowledgeEvent }));
import { createKnowledgeAssertion, resolveKnowledgeAssertionConflict, transitionKnowledgeAssertion } from "./assertions";

describe("knowledge assertion lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertion.findUnique.mockReset();
    assertion.findMany.mockReset().mockResolvedValue([]);
    assertion.update.mockReset().mockResolvedValue({ id: "a1", status: "CONFIRMED" });
    assertion.upsert.mockReset().mockResolvedValue({ id: "a1", status: "OBSERVED" });
    conflict.findUnique.mockReset();
    conflict.update.mockReset().mockResolvedValue({ id: "c1", status: "RESOLVED" });
    findingDecision.findUnique.mockReset();
    canonicalItem.findMany.mockReset();
    canonicalItem.create.mockReset().mockResolvedValue({ id: "item-1" });
    itemProvenance.upsert.mockReset();
    recordKnowledgeEvent.mockReset().mockResolvedValue({ event: { id: "event-1" }, created: true });
  });
  it("allows the curated forward lifecycle", () => {
    expect(() => assertAssertionTransition("OBSERVED", "CONFIRMED")).not.toThrow();
    expect(() => assertAssertionTransition("CONFIRMED", "VERIFIED")).not.toThrow();
    expect(() => assertAssertionTransition("VERIFIED", "CANONICAL")).not.toThrow();
  });

  it("rejects skipping review states", () => {
    expect(() => assertAssertionTransition("OBSERVED", "VERIFIED")).toThrow("Invalid assertion transition");
    expect(() => assertAssertionTransition("CONFIRMED", "CANONICAL")).toThrow("Invalid assertion transition");
  });

  it("allows rejection and deprecation without enabling promotion", () => {
    expect(() => assertAssertionTransition("OBSERVED", "REJECTED")).not.toThrow();
    expect(() => assertAssertionTransition("CONFIRMED", "DEPRECATED")).not.toThrow();
    expect(() => assertAssertionTransition("REJECTED", "CANONICAL")).toThrow("Invalid assertion transition");
  });

  it("persists an observed assertion with deterministic provenance", async () => {
    await createKnowledgeAssertion({ idempotencyKey: "assert:d1", subjectType: "ReviewFinding", subjectId: "f1", predicate: "yield_observed", value: { value: "0.8" }, scope: "PROJECT", companyId: "c1", projectId: "p1", confidence: "HIGH", sourceId: "s1", evidenceId: "e1", createdById: "u1" });
    expect(assertion.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { idempotencyKey: "assert:d1" }, create: expect.objectContaining({ status: "OBSERVED", evidenceId: "e1" }) }));
  });

  it("rejects an invalid persisted transition", async () => {
    assertion.findUnique.mockResolvedValueOnce({ id: "a1", status: "OBSERVED", scope: "PROJECT", companyId: "c1", projectId: "p1" });
    await expect(transitionKnowledgeAssertion({ assertionId: "a1", nextStatus: "CANONICAL", actorUserId: "u1", companyId: "c1", projectId: "p1" })).rejects.toThrow("Invalid assertion transition");
    expect(assertion.update).not.toHaveBeenCalled();
  });

  it("requires a reason and provenance for sensitive transitions and audits every accepted transition", async () => {
    assertion.findUnique.mockResolvedValueOnce({ id: "a1", status: "OBSERVED", scope: "PROJECT", companyId: "c1", projectId: "p1", sourceId: "s1", evidenceId: "e1" });
    await expect(transitionKnowledgeAssertion({ assertionId: "a1", nextStatus: "REJECTED", actorUserId: "u1", companyId: "c1", projectId: "p1" })).rejects.toThrow("reason");
    assertion.findUnique.mockResolvedValueOnce({ id: "a1", status: "OBSERVED", scope: "PROJECT", companyId: "c1", projectId: "p1", sourceId: null, evidenceId: null });
    await expect(transitionKnowledgeAssertion({ assertionId: "a1", nextStatus: "CONFIRMED", actorUserId: "u1", companyId: "c1", projectId: "p1" })).rejects.toThrow("provenance");
    assertion.findUnique.mockResolvedValueOnce({ id: "a1", status: "OBSERVED", scope: "PROJECT", companyId: "c1", projectId: "p1", sourceId: "s1", evidenceId: "e1" });
    await transitionKnowledgeAssertion({ assertionId: "a1", nextStatus: "CONFIRMED", actorUserId: "u1", companyId: "c1", projectId: "p1", correlationId: "corr-1" });
    expect(recordKnowledgeEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "KNOWLEDGE_ASSERTION_TRANSITION", entityId: "a1", sourceId: "s1", evidenceId: "e1", metadata: expect.objectContaining({ correlationId: "corr-1", previousStatus: "OBSERVED", nextStatus: "CONFIRMED" }) }));
  });

  it("requires explicit superadmin authorization before promoting an assertion to GLOBAL", async () => {
    assertion.findUnique.mockResolvedValueOnce({ id: "a1", status: "VERIFIED", scope: "PROJECT", companyId: "c1", projectId: "p1", sourceId: "s1", evidenceId: "e1" });
    findingDecision.findUnique.mockResolvedValueOnce({ id: "d1", companyId: "c1", projectId: "p1", resolution: "CONFIRMED_ISSUE" });
    await expect(transitionKnowledgeAssertion({ assertionId: "a1", nextStatus: "CANONICAL", actorUserId: "u1", companyId: "c1", projectId: "p1", correlationId: "corr-global", reviewDecisionId: "d1" })).rejects.toThrow("GLOBAL");
    assertion.findUnique.mockResolvedValueOnce({ id: "a1", status: "VERIFIED", scope: "PROJECT", companyId: "c1", projectId: "p1", sourceId: "s1", evidenceId: "e1" });
    findingDecision.findUnique.mockResolvedValueOnce({ id: "d1", companyId: "c1", projectId: "p1", resolution: "CONFIRMED_ISSUE" });
    await transitionKnowledgeAssertion({ assertionId: "a1", nextStatus: "CANONICAL", actorUserId: "u1", companyId: "c1", projectId: "p1", correlationId: "corr-global", allowGlobalPromotion: true, reviewDecisionId: "d1" });
    expect(assertion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ scope: "GLOBAL", companyId: null, projectId: null }) }));
  });

  it("requires corroboration from the configured number of distinct projects before VERIFIED", async () => {
    assertion.findUnique.mockResolvedValueOnce({ id: "a1", status: "CONFIRMED", scope: "PROJECT", companyId: "c1", projectId: "p3", sourceId: "s1", evidenceId: "e1", subjectType: "IMPORT_ITEM", predicate: "import_item" });
    assertion.findMany.mockResolvedValueOnce([{ projectId: "p1" }, { projectId: "p2" }]);
    await transitionKnowledgeAssertion({ assertionId: "a1", nextStatus: "VERIFIED", actorUserId: "u1", companyId: "c1", projectId: "p3", correlationId: "corr-verified" });
    expect(assertion.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: "c1", status: { in: ["CONFIRMED", "VERIFIED"] } }) }));
  });

  it("supports explicit COMPANY promotion without requiring GLOBAL MFA authorization", async () => {
    assertion.findUnique.mockResolvedValueOnce({ id: "a1", status: "VERIFIED", scope: "PROJECT", companyId: "c1", projectId: "p1", sourceId: "s1", evidenceId: "e1" });
    findingDecision.findUnique.mockResolvedValueOnce({ id: "d1", companyId: "c1", projectId: "p1", resolution: "CONFIRMED_ISSUE" });
    await transitionKnowledgeAssertion({ assertionId: "a1", nextStatus: "CANONICAL", actorUserId: "u1", companyId: "c1", projectId: "p1", correlationId: "corr-company", promotionScope: "COMPANY", reviewDecisionId: "d1" });
    expect(assertion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ scope: "COMPANY", companyId: "c1", projectId: null }) }));
  });

  it("requires a confirmed review decision before COMPANY promotion", async () => {
    assertion.findUnique.mockResolvedValueOnce({ id: "a1", status: "VERIFIED", scope: "PROJECT", companyId: "c1", projectId: "p1", sourceId: "s1", evidenceId: "e1" });
    await expect(transitionKnowledgeAssertion({ assertionId: "a1", nextStatus: "CANONICAL", actorUserId: "u1", companyId: "c1", projectId: "p1", correlationId: "corr-company", promotionScope: "COMPANY" })).rejects.toThrow("confirmed review decision");
    expect(assertion.update).not.toHaveBeenCalled();
  });

  it("rejects a review decision from another tenant or with an invalid resolution", async () => {
    assertion.findUnique.mockResolvedValue({ id: "a1", status: "VERIFIED", scope: "PROJECT", companyId: "c1", projectId: "p1", sourceId: "s1", evidenceId: "e1" });
    findingDecision.findUnique.mockResolvedValueOnce({ id: "d-foreign", companyId: "c2", projectId: "p2", resolution: "CONFIRMED_ISSUE" });
    await expect(transitionKnowledgeAssertion({ assertionId: "a1", nextStatus: "CANONICAL", actorUserId: "u1", companyId: "c1", projectId: "p1", correlationId: "corr-foreign", promotionScope: "COMPANY", reviewDecisionId: "d-foreign" })).rejects.toThrow("confirmed review decision");
    findingDecision.findUnique.mockResolvedValueOnce({ id: "d-invalid", companyId: "c1", projectId: "p1", resolution: "FALSE_POSITIVE" });
    await expect(transitionKnowledgeAssertion({ assertionId: "a1", nextStatus: "CANONICAL", actorUserId: "u1", companyId: "c1", projectId: "p1", correlationId: "corr-invalid", promotionScope: "COMPANY", reviewDecisionId: "d-invalid" })).rejects.toThrow("confirmed review decision");
  });

  it("links an IMPORT_ITEM promotion to the canonical catalog and its provenance", async () => {
    assertion.findUnique.mockResolvedValueOnce({ id: "a1", status: "VERIFIED", scope: "PROJECT", companyId: "c1", projectId: "p1", sourceId: "s1", evidenceId: "e1", subjectType: "IMPORT_ITEM", predicate: "import_item", value: { name: "Cemento", unit: "kg" } });
    findingDecision.findUnique.mockResolvedValueOnce({ id: "d1", companyId: "c1", projectId: "p1", resolution: "CONFIRMED_ISSUE" });
    canonicalItem.findMany.mockResolvedValueOnce([]);

    await transitionKnowledgeAssertion({ assertionId: "a1", nextStatus: "CANONICAL", actorUserId: "u1", companyId: "c1", projectId: "p1", correlationId: "corr-catalog", promotionScope: "COMPANY", reviewDecisionId: "d1" });

    expect(canonicalItem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ normalizedName: "cemento", scope: "COMPANY", companyId: "c1" }) });
    expect(itemProvenance.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ canonicalItemId: "item-1", sourceId: "s1", evidenceId: "e1" }) }));
    expect(assertion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ value: expect.objectContaining({ canonicalEntity: { catalogEntityType: "CanonicalItem", catalogEntityId: "item-1" } }) }) }));
  });

  it("creates and resolves a scoped conflict with an audit event", async () => {
    await expect(resolveKnowledgeAssertionConflict({ conflictId: "c1", actorUserId: "u1", companyId: "c1", resolution: "RESOLVED", reason: "Revisado por ingeniería", correlationId: "corr-conflict" })).rejects.toThrow("not found");
    conflict.findUnique.mockResolvedValueOnce({ id: "c1", status: "OPEN", reason: "Contradicción", assertion: { companyId: "c1", projectId: "p1" }, conflictingAssertion: { companyId: "c1", projectId: "p1" } });
    await resolveKnowledgeAssertionConflict({ conflictId: "c1", actorUserId: "u1", companyId: "c1", projectId: "p1", resolution: "RESOLVED", reason: "Revisado por ingeniería", correlationId: "corr-conflict" });
    expect(conflict.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1" }, data: expect.objectContaining({ status: "RESOLVED", resolvedById: "u1" }) }));
    expect(recordKnowledgeEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "KNOWLEDGE_ASSERTION_CONFLICT_RESOLVED", entityId: "c1", metadata: expect.objectContaining({ correlationId: "corr-conflict" }) }));
  });
});
