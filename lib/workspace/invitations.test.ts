import { describe, expect, it } from "vitest";
import { parseBulkInviteEmails } from "@/lib/workspace/invitations";
import { bulkInviteWorkspaceSchema } from "@/lib/validations/workspace";

describe("parseBulkInviteEmails", () => {
  it("splits on commas, semicolons and newlines", () => {
    const result = parseBulkInviteEmails("ana@x.com, luis@x.com;\nmaria@x.com");
    expect(result.emails).toEqual(["ana@x.com", "luis@x.com", "maria@x.com"]);
    expect(result.invalid).toEqual([]);
  });

  it("lowercases, trims and deduplicates emails", () => {
    const result = parseBulkInviteEmails(" Ana@X.com , ana@x.com , luis@x.com");
    expect(result.emails).toEqual(["ana@x.com", "luis@x.com"]);
  });

  it("separates invalid tokens from valid emails", () => {
    const result = parseBulkInviteEmails("ana@x.com, not-an-email, luis@x.com, foo bar");
    expect(result.emails).toEqual(["ana@x.com", "luis@x.com"]);
    expect(result.invalid).toEqual(["not-an-email", "foo bar"]);
  });

  it("ignores blank tokens", () => {
    const result = parseBulkInviteEmails(",, ana@x.com ,,\n\nluis@x.com");
    expect(result.emails).toEqual(["ana@x.com", "luis@x.com"]);
  });
});

describe("bulkInviteWorkspaceSchema", () => {
  it("accepts a non-empty text block", () => {
    expect(bulkInviteWorkspaceSchema.parse({ emailsText: "ana@x.com, luis@x.com" }).emailsText).toBe("ana@x.com, luis@x.com");
  });

  it("rejects empty input", () => {
    expect(() => bulkInviteWorkspaceSchema.parse({ emailsText: "   " })).toThrow();
  });

  it("rejects oversized batches", () => {
    expect(() => bulkInviteWorkspaceSchema.parse({ emailsText: "a@x.com".repeat(2000) })).toThrow();
  });
});
