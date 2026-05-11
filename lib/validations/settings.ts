import { z } from "zod";

export const userSettingsSchema = z.object({
  currencyDecimals: z.coerce.number().int().min(0).max(4),
});

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
