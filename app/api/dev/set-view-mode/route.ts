import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import {
  USER_SETTINGS_CACHE_TAG,
  getUserSettings,
  updateUserSettings,
} from "@/lib/data/settings";
import { DEFAULT_APP_THEME } from "@/types/settings";

/**
 * DEV-ONLY: POST /api/dev/set-view-mode
 *
 * Updates a user's `defaultViewMode` directly in the DB. Exists so the
 * Playwright suite (`tests/e2e/excel-mode.spec.ts`) can flip the seeded
 * demo user to Excel mode in `test.beforeAll` without driving the
 * custom-tab + Radix Select + save-button UI dance in `/settings`.
 *
 * SECURITY: This endpoint is gated to non-production environments. In
 * production (`NODE_ENV=production`) the route returns 404 regardless of
 * payload, so it cannot be used to mutate user preferences without auth.
 * Do NOT remove or weaken this gate.
 *
 * Body: `{ email: string, viewMode: "modern" | "excel" }`
 * Response: `{ userId, email, defaultViewMode }`
 */

// Must never be statically generated or cached: it reads `request.json()`,
// queries the DB, and is the kind of route a future automated test runner
// or scanner should never hit during `next build`.
export const dynamic = "force-dynamic";
const setViewModeRequestSchema = z.object({
  email: z.string().email(),
  viewMode: z.enum(["modern", "excel"]),
});

const PRODUCTION_GATE_MESSAGE = "Not found";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: PRODUCTION_GATE_MESSAGE }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = setViewModeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: `User not found: ${parsed.data.email}` },
      { status: 404 },
    );
  }

  const current = await getUserSettings(user.id);
  // `getUserSettings` normalizes every field but the inferred return type
  // still leaves `appTheme` as `"light" | "dark" | undefined` because the
  // underlying Zod schema declares it optional with a default. Explicit
  // fallback to `DEFAULT_APP_THEME` keeps `updateUserSettings` happy without
  // widening the type contract of `lib/data/settings`.
  const updated = await updateUserSettings(user.id, {
    ...current,
    appTheme: current.appTheme ?? DEFAULT_APP_THEME,
    defaultViewMode: parsed.data.viewMode,
  });

  // Invalidate caches so the SSR'd <AppViewModeProvider> picks up the new
  // default on the next page render. updateUserSettings already clears the
  // process-level cache; revalidateTag flushes the persistent tagged cache
  // that wraps `getUserSettings` via `unstable_cache`. No revalidatePath is
  // needed because the dev route is invoked from the test runner, which
  // triggers a fresh SSR on the next page navigation.
  revalidateTag(USER_SETTINGS_CACHE_TAG, "max");
  revalidateTag(`${USER_SETTINGS_CACHE_TAG}:${user.id}`, "max");

  return NextResponse.json({
    userId: user.id,
    email: parsed.data.email,
    defaultViewMode: updated.defaultViewMode,
  });
}
