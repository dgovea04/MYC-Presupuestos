import { z } from "zod";
import { BETA_DURATION_DAYS } from "@/lib/beta/types";

const normalizedStringArraySchema = z
  .array(z.string().trim().min(1).max(120))
  .default([])
  .transform((values) => [...new Set(values.map((value) => value.toLowerCase()))]);

export const betaEligibilityRulesSchema = z
  .object({
    requireVerifiedEmail: z.boolean().default(true),
    newUsersOnly: z.boolean().default(false),
    allowedUtmSources: normalizedStringArraySchema,
    allowedUtmCampaigns: normalizedStringArraySchema,
    allowedEmailDomains: normalizedStringArraySchema,
    requiresCode: z.boolean().default(false),
    excludePaidSubscribers: z.boolean().default(true),
    excludePreviousBetaUsers: z.boolean().default(true),
  })
  .strict()
  .default({
    requireVerifiedEmail: true,
    newUsersOnly: false,
    allowedUtmSources: [],
    allowedUtmCampaigns: [],
    allowedEmailDomains: [],
    requiresCode: false,
    excludePaidSubscribers: true,
    excludePreviousBetaUsers: true,
  });

export const betaCampaignInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    code: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .transform((value) => value.toLowerCase())
      .nullable()
      .optional(),
    durationDays: z.union([z.literal(BETA_DURATION_DAYS[0]), z.literal(BETA_DURATION_DAYS[1])]),
    assignmentMode: z.enum(["AUTOMATIC", "ADMIN", "CODE", "MIXED"]),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().nullable().optional(),
    maxAssignments: z.number().int().positive().max(1_000_000).nullable().optional(),
    aiTokenLimit: z.number().int().positive().max(100_000_000).nullable().optional(),
    eligibilityRules: betaEligibilityRulesSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.endsAt && value.endsAt <= value.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "La fecha de fin debe ser posterior al inicio.",
      });
    }

    if (value.assignmentMode === "CODE" && !value.code) {
      context.addIssue({
        code: "custom",
        path: ["code"],
        message: "Las campañas por código requieren un código.",
      });
    }

    if (value.eligibilityRules.requiresCode && !value.code) {
      context.addIssue({
        code: "custom",
        path: ["code"],
        message: "Las reglas que requieren código necesitan un código de campaña.",
      });
    }
  });

export const betaGrantActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("REVOKE"),
    reason: z.string().trim().min(10).max(500),
  }),
  z.object({
    action: z.literal("EXTEND"),
    newExpiresAt: z.coerce.date(),
    reason: z.string().trim().min(10).max(500),
  }),
]);

export type BetaCampaignInput = z.infer<typeof betaCampaignInputSchema>;
export type BetaGrantActionInput = z.infer<typeof betaGrantActionSchema>;
