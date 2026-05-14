import { prisma } from "@/lib/db/prisma";
import type { ActivityEventType } from "@prisma/client";

type ActivityEventInput = {
  userId: string;
  type: ActivityEventType;
  title: string;
  detail: string;
  href: string;
};

export async function recordActivityEvent(input: ActivityEventInput) {
  if (typeof (prisma as typeof prisma & { activityEvent?: unknown }).activityEvent === "undefined") {
    return;
  }

  await prisma.activityEvent.create({
    data: input,
  });
}
