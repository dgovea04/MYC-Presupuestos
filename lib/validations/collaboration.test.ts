import { describe, it, expect } from "vitest";
import {
  commentCreateSchema,
  commentUpdateSchema,
  presenceUpsertSchema,
  editSessionStartSchema,
  versionCreateSchema,
  commentsQuerySchema,
  changeEventQuerySchema,
  versionQuerySchema,
} from "./collaboration";

describe("collaboration validations", () => {
  describe("commentCreateSchema", () => {
    it("accepts a valid comment", () => {
      const result = commentCreateSchema.safeParse({
        entityType: "BUDGET_ITEM",
        entityId: "item123",
        body: "Revisar rendimiento de excavacion",
        mentions: ["user1", "user2"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts a comment with parentCommentId", () => {
      const result = commentCreateSchema.safeParse({
        entityType: "APU",
        entityId: "apu456",
        parentCommentId: "parent789",
        body: "Respondiendo al comentario anterior",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty body", () => {
      const result = commentCreateSchema.safeParse({
        entityType: "BUDGET",
        entityId: "budget1",
        body: "   ",
      });
      expect(result.success).toBe(false);
    });

    it("defaults mentions to empty array", () => {
      const result = commentCreateSchema.safeParse({
        entityType: "BUDGET",
        entityId: "budget1",
        body: "Comentario simple",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mentions).toEqual([]);
      }
    });
  });

  describe("commentUpdateSchema", () => {
    it("accepts resolved = true", () => {
      const result = commentUpdateSchema.safeParse({ resolved: true });
      expect(result.success).toBe(true);
    });

    it("accepts resolved = false", () => {
      const result = commentUpdateSchema.safeParse({ resolved: false });
      expect(result.success).toBe(true);
    });

    it("accepts empty object (partial update)", () => {
      const result = commentUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("presenceUpsertSchema", () => {
    it("accepts valid presence", () => {
      const result = presenceUpsertSchema.safeParse({
        route: "/budgets/budget1",
        module: "budget",
        status: "ACTIVE",
      });
      expect(result.success).toBe(true);
    });

    it("defaults status to ACTIVE", () => {
      const result = presenceUpsertSchema.safeParse({
        route: "/budgets/budget1",
        module: "metrados",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("ACTIVE");
      }
    });
  });

  describe("editSessionStartSchema", () => {
    it("accepts valid edit session", () => {
      const result = editSessionStartSchema.safeParse({
        entityType: "BUDGET_ITEM",
        entityId: "item123",
        field: "quantity",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("versionCreateSchema", () => {
    it("accepts version with label and reason", () => {
      const result = versionCreateSchema.safeParse({
        label: "Revision final",
        reason: "Importacion S10 completada",
      });
      expect(result.success).toBe(true);
    });

    it("accepts version without label or reason", () => {
      const result = versionCreateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("commentsQuerySchema", () => {
    it("accepts pagination params", () => {
      const result = commentsQuerySchema.safeParse({
        entityType: "BUDGET_ITEM",
        entityId: "item123",
        limit: 20,
      });
      expect(result.success).toBe(true);
    });

    it("defaults limit to 50", () => {
      const result = commentsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });
  });

  describe("changeEventQuerySchema", () => {
    it("accepts source filter", () => {
      const result = changeEventQuerySchema.safeParse({
        source: "KHIPU",
        limit: 10,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("versionQuerySchema", () => {
    it("accepts cursor pagination", () => {
      const result = versionQuerySchema.safeParse({
        cursor: "version5",
        limit: 10,
      });
      expect(result.success).toBe(true);
    });

    it("defaults limit to 20", () => {
      const result = versionQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });
  });
});
