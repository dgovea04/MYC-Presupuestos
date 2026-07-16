import { describe, expect, it } from "vitest";
import type {
  WorkScheduleLineRecord,
  WorkScheduleMonthlyDistributionRecord,
} from "@/types/work-schedule";
import type { EditableLine } from "@/components/budget/work-schedule/types";
import {
  createEditableLine,
  serializeEditableLine,
  updateEditableLineDates,
  parseCustomPhaseKeywords,
} from "@/components/budget/work-schedule/utils/edit-helpers";

// ─── helpers ──────────────────────────────────────────────────────────────

function buildEditableLine(partial: Partial<EditableLine> = {}): EditableLine {
  return {
    budgetItemId: "item-x",
    description: "Excavacion manual",
    quantity: 100,
    performance: 10,
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    durationDays: 5,
    predecessor: "",
    crew: "4",
    monthlyDistributions: [
      { year: 2026, month: 3, percentage: 100 },
    ] satisfies WorkScheduleMonthlyDistributionRecord[],
    isMilestone: false,
    baselineStartDate: null,
    baselineEndDate: null,
    actualStartDate: null,
    actualEndDate: null,
    percentComplete: null,
    ...partial,
  };
}

function buildWorkScheduleLine(
  partial: Partial<WorkScheduleLineRecord> = {},
): WorkScheduleLineRecord {
  return {
    budgetItemId: "item-x",
    itemCode: "01.01",
    description: "Excavacion manual",
    unit: "m3",
    quantity: 100,
    unitPrice: 25,
    partial: 2500,
    performance: 10,
    crew: 4,
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    durationDays: 5,
    predecessor: "",
    monthlyDistributions: [],
    activeResourceIds: [],
    resourceIds: [],
    resources: [],
    isMilestone: false,
    isPending: false,
    baselineStartDate: null,
    baselineEndDate: null,
    actualStartDate: null,
    actualEndDate: null,
    percentComplete: null,
    criticalPath: null,
    ...partial,
  };
}

// ─── tests ────────────────────────────────────────────────────────────────

describe("updateEditableLineDates durationDays-0 trap contract", () => {
  it("uses patch.endDate when patch.endDate is the empty string (precedence: ?? only falls through on undefined)", () => {
    // Pin the documented trap. This is the behavior that `handleActivateInlineRow`
    // defends against with its `if (line.startDate && line.endDate)` guard. If a
    // future refactor weakens this contract (e.g. auto-fills endDate from
    // startDate OR returns the prior draft untouched), the caller-side guard's
    // "preserve-untouched" claim becomes wrong — so this test serves as the
    // contract canary.
    //
    // Note on precedence: `updateEditableLineDates` uses `patch.endDate ?? line.endDate`.
    // The empty string `""` is defined, so the patch wins over the draft. Only an
    // `undefined` patch value falls through to the draft. We pin this explicitly
    // so a future refactor that swaps `??` for `||` (and accidentally treats "" as
    // undefined) is caught.
    const current = buildEditableLine({
      startDate: "2026-03-10",
      endDate: "2026-03-15",
      durationDays: 6,
    });
    const next = updateEditableLineDates(current, { startDate: "2026-03-10", endDate: "" });

    expect(next.startDate).toBe("2026-03-10");
    expect(next.endDate).toBe("");
    expect(next.durationDays).toBe(0);
  });

  it("uses patch.startDate when patch.startDate is the empty string (precedence: ?? only falls through on undefined)", () => {
    const current = buildEditableLine({
      startDate: "2026-03-10",
      endDate: "2026-03-15",
      durationDays: 6,
    });
    const next = updateEditableLineDates(current, { startDate: "", endDate: "2026-03-15" });

    expect(next.startDate).toBe("");
    expect(next.endDate).toBe("2026-03-15");
    expect(next.durationDays).toBe(0);
  });

  it("falls through to line.startDate + line.endDate + line.durationDays when patch carries only undefined keys (precedence boundary)", () => {
    // The `??` boundary: `undefined ?? <draft>` keeps the draft value. This is
    // the config-audit pin so a `?? → ||` refactor doesn't change the semantics
    // of "missing patch field" (which would silently bypass the trap below).
    //
    // We assert date + metadata fields individually rather than via
    // `toEqual(current)` because the implementation's happy-path branch
    // unconditionally rebuilds `monthlyDistributions` from the (unchanged)
    // range. For a single-month input that rebuild is byte-identical to the
    // factory output, so a `toEqual` would pass for the WRONG reason: the
    // recompute happened to match. Pinning fields explicitly makes the
    // precedence semantics the load-bearing assertion.
    const current = buildEditableLine({
      startDate: "2026-03-10",
      endDate: "2026-03-15",
      durationDays: 6,
      description: "Concreto premezclado",
      quantity: 42,
      predecessor: "01.01FS+5d",
      crew: "6",
    });
    const next = updateEditableLineDates(current, {
      startDate: undefined,
      endDate: undefined,
    });

    expect(next.startDate).toBe("2026-03-10");
    expect(next.endDate).toBe("2026-03-15");
    expect(next.durationDays).toBe(6);
    expect(next.description).toBe("Concreto premezclado");
    expect(next.quantity).toBe(42);
    expect(next.predecessor).toBe("01.01FS+5d");
    expect(next.crew).toBe("6");
  });

  it("zeroes durationDays when both patch dates are empty regardless of draft history", () => {
    const current = buildEditableLine({
      startDate: "2026-03-10",
      endDate: "2026-03-15",
      durationDays: 6,
    });
    const next = updateEditableLineDates(current, { startDate: "", endDate: "" });

    expect(next.startDate).toBe("");
    expect(next.endDate).toBe("");
    expect(next.durationDays).toBe(0);
  });

  it("zeroes durationDays when the patch endDate precedes the startDate", () => {
    const next = updateEditableLineDates(buildEditableLine(), {
      startDate: "2026-03-15",
      endDate: "2026-03-10",
    });

    expect(next.durationDays).toBe(0);
  });

  it("zeroes durationDays when the patch carries an unparseable date string", () => {
    const next = updateEditableLineDates(buildEditableLine(), {
      startDate: "not-a-date",
      endDate: "definitely-not-a-date",
    });

    expect(next.startDate).toBe("not-a-date");
    expect(next.endDate).toBe("definitely-not-a-date");
    expect(next.durationDays).toBe(0);
  });

  it("recomputes durationDays and rebuilds monthlyDistributions from the new range", () => {
    // Baseline: a fully-covered range recomputes durationDays as
    // `diffInDays(start, end) + 1` per the project's canonical helper contract,
    // AND rebuilds monthlyDistributions from the new range so a stale March
    // distribution is never returned for an April task. Future refactors that
    // skip the recompute while keeping the trap branch intact are caught by
    // the toMatchObject shape pin.
    const next = updateEditableLineDates(buildEditableLine(), {
      startDate: "2026-04-01",
      endDate: "2026-04-10",
    });

    expect(next.startDate).toBe("2026-04-01");
    expect(next.endDate).toBe("2026-04-10");
    expect(next.durationDays).toBe(10);
    expect(next.monthlyDistributions[0]).toMatchObject({
      year: 2026,
      month: 4,
      percentage: 100,
    });
  });

  it("preserves non-date fields across both branches (description, quantity, predecessor, crew, milestone, baseline)", () => {
    // The trap branch and the happy-path branch must both spread `...line`
    // so that cascade-invoked recomputes never wipe unrelated metadata. Pin
    // this so a refactor that does `{ startDate, endDate, durationDays }`
    // (without the spread) is caught.
    const base = buildEditableLine({
      description: "Concreto premezclado",
      quantity: 42,
      performance: 7,
      predecessor: "01.01FS+5d",
      crew: "6",
      isMilestone: true,
      baselineStartDate: "2026-02-25",
      baselineEndDate: "2026-03-05",
      actualStartDate: "2026-03-01",
      actualEndDate: "2026-03-04",
      percentComplete: 60,
    });

    const trap = updateEditableLineDates(base, { startDate: "2026-03-10", endDate: "" });
    expect(trap.description).toBe("Concreto premezclado");
    expect(trap.quantity).toBe(42);
    expect(trap.performance).toBe(7);
    expect(trap.predecessor).toBe("01.01FS+5d");
    expect(trap.crew).toBe("6");
    expect(trap.isMilestone).toBe(true);
    expect(trap.baselineStartDate).toBe("2026-02-25");
    expect(trap.baselineEndDate).toBe("2026-03-05");
    expect(trap.actualStartDate).toBe("2026-03-01");
    expect(trap.actualEndDate).toBe("2026-03-04");
    expect(trap.percentComplete).toBe(60);

    const happy = updateEditableLineDates(base, { startDate: "2026-03-10", endDate: "2026-03-15" });
    expect(happy.description).toBe("Concreto premezclado");
    expect(happy.quantity).toBe(42);
    expect(happy.performance).toBe(7);
    expect(happy.predecessor).toBe("01.01FS+5d");
    expect(happy.crew).toBe("6");
    expect(happy.isMilestone).toBe(true);
    expect(happy.baselineStartDate).toBe("2026-02-25");
    expect(happy.baselineEndDate).toBe("2026-03-05");
    expect(happy.actualStartDate).toBe("2026-03-01");
    expect(happy.actualEndDate).toBe("2026-03-04");
    expect(happy.percentComplete).toBe(60);
  });
});

describe("createEditableLine round-trip for partial-date source records", () => {
  it("returns durationDays=0 when the source record has startDate but no endDate", () => {
    // Pin the same trap from the integration side: when the page receives a
    // record from `presentationLines` with only `startDate` set (i.e. the
    // partial-date cascade scenario), the resulting draft must report
    // durationDays=0. This is the value that `cascadedInlineDrafts` /
    // `handleActivateInlineRow`'s guard decides not to overwrite.
    //
    // The trap must also leave `monthlyDistributions` empty when the source
    // record had no precomputed distribution. A refactor that auto-populates
    // distributions when one date is present would silently change the UI
    // (a percent-filled row would render for a partially-defined line).
    const line = buildWorkScheduleLine({
      startDate: "2026-03-10",
      endDate: "",
      durationDays: 6,
    });
    const draft = createEditableLine(line);

    expect(draft.startDate).toBe("2026-03-10");
    expect(draft.endDate).toBe("");
    expect(draft.durationDays).toBe(0);
    expect(draft.monthlyDistributions).toEqual([]);
  });

  it("defaults durationDays to 0 when the source record has neither date", () => {
    const line = buildWorkScheduleLine({
      startDate: "",
      endDate: "",
      durationDays: undefined,
    });
    const draft = createEditableLine(line);

    expect(draft.startDate).toBe("");
    expect(draft.endDate).toBe("");
    expect(draft.durationDays).toBe(0);
  });

  it("defaults crew to '1' when the source record has no crew field", () => {
    // Defensive: if a record is created without a crew, the draft falls back
    // to the UI-friendly default of "1". Future refactors that change the
    // defaulting policy will be caught here.
    const line = buildWorkScheduleLine({ crew: undefined });
    const draft = createEditableLine(line);

    expect(draft.crew).toBe("1");
  });

  it("recomputes durationDays from a fully-covered range", () => {
    const line = buildWorkScheduleLine({
      startDate: "2026-03-10",
      endDate: "2026-03-15",
      durationDays: 6,
    });
    const draft = createEditableLine(line);

    expect(draft.startDate).toBe("2026-03-10");
    expect(draft.endDate).toBe("2026-03-15");
    expect(draft.durationDays).toBe(6);
  });

  it("serializes a trap-state draft with durationDays: 0 on the wire (no stale recovery on PATCH)", () => {
    // The activation-handler guard defends against the helper's trap, but a
    // future split between compute and serialize could re-emit stale values
    // on the wire (the PATCH body). This two-assertion round-trip pins the
    // serialized shape so a refactor that recovers `durationDays` from a
    // stale snapshot during serialization is caught.
    const line = buildWorkScheduleLine({
      startDate: "2026-03-10",
      endDate: "",
      durationDays: 6,
      predecessor: "",
      crew: 4,
    });
    const draft = createEditableLine(line);
    const serialized = serializeEditableLine(draft);

    expect(serialized.startDate).toBe("2026-03-10");
    expect(serialized.endDate).toBe("");
    expect(serialized.durationDays).toBe(0);
    expect(serialized.monthlyDistributions).toEqual([]);
  });
});

describe("parseCustomPhaseKeywords", () => {
  it("returns null when input is undefined", () => {
    expect(parseCustomPhaseKeywords(undefined)).toBeNull();
  });

  it("returns null when input is empty", () => {
    expect(parseCustomPhaseKeywords({})).toBeNull();
  });

  it("splits comma-separated keywords and normalizes them", () => {
    const input = {
      structure: "Concreto, Acero, HORMIGON",
      finishes: "Pintura Látex, Cerámico",
    };

    expect(parseCustomPhaseKeywords(input)).toEqual({
      structure: ["concreto", "acero", "hormigon"],
      finishes: ["pintura latex", "ceramico"],
    });
  });

  it("removes empty tokens and deduplicates keywords", () => {
    const input = {
      earthwork: "excavacion, , corte, excavacion",
    };

    expect(parseCustomPhaseKeywords(input)).toEqual({
      earthwork: ["excavacion", "corte"],
    });
  });

  it("ignores phases with only empty or whitespace values", () => {
    const input = {
      structure: "  ",
      finishes: "pintura",
    };

    expect(parseCustomPhaseKeywords(input)).toEqual({
      finishes: ["pintura"],
    });
  });
});
