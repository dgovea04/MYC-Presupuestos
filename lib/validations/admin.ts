import { z } from "zod";

const numericInputSchema = z.union([
  z.number(),
  z
    .string()
    .trim()
    .min(1)
    .refine((value) => Number.isFinite(Number(value)), {
      message: "Expected a valid number",
    })
    .transform((value) => Number(value)),
]);

export const adminUserAccessSchema = z.object({
  role: z.enum(["ADMIN", "USER"]),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  membershipPlanSlug: z.string().trim().min(1),
  aiTokenExtraMonthly: numericInputSchema.pipe(z.number().int().min(0).max(10_000_000)),
});

export type AdminUserAccessInput = z.infer<typeof adminUserAccessSchema>;
