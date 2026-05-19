import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

export type UserProfileColumnSupport = {
  avatarUrl: boolean;
  phone: boolean;
  jobTitle: boolean;
  bio: boolean;
};

const userProfileColumnRowSchema = z.object({
  column_name: z.string(),
});

let userProfileColumnSupportPromise: Promise<UserProfileColumnSupport> | null = null;

async function loadUserProfileColumnSupport(): Promise<UserProfileColumnSupport> {
  try {
    const rows = await prisma.$queryRaw<Array<unknown>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
      AND table_name = 'User'
      AND column_name IN ('avatarUrl', 'phone', 'jobTitle', 'bio')
    `;

    const availableColumns = new Set(
      rows
        .map((row) => userProfileColumnRowSchema.safeParse(row))
        .filter((result): result is { success: true; data: z.infer<typeof userProfileColumnRowSchema> } => result.success)
        .map((result) => result.data.column_name),
    );

    return {
      avatarUrl: availableColumns.has("avatarUrl"),
      phone: availableColumns.has("phone"),
      jobTitle: availableColumns.has("jobTitle"),
      bio: availableColumns.has("bio"),
    };
  } catch {
    return {
      avatarUrl: false,
      phone: false,
      jobTitle: false,
      bio: false,
    };
  }
}

export function resetUserProfileColumnSupportCacheForTests() {
  userProfileColumnSupportPromise = null;
}

export async function getUserProfileColumnSupport(): Promise<UserProfileColumnSupport> {
  if (!userProfileColumnSupportPromise) {
    userProfileColumnSupportPromise = loadUserProfileColumnSupport();
  }

  return userProfileColumnSupportPromise;
}
