import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { resolveBudgetOwnership } from "@/lib/collaboration/authorization";
import { subscribeBudgetEvents } from "@/lib/collaboration/events";
import { SSE_PING_INTERVAL_MS } from "@/lib/collaboration/types";
import { getWorkspaceFeatureAccessStatus } from "@/lib/workspace/entitlements";

const encoder = new TextEncoder();
const STREAM_PREAMBLE = `: ${" ".repeat(2048)}\n\n`;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: budgetId } = await params;

  // Validate access before opening stream
  try {
    await resolveBudgetOwnership(budgetId, session.user.id);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Acceso denegado" },
      { status: getWorkspaceFeatureAccessStatus(error) },
    );
  }

  let cleanupStream: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      writePreamble(controller);
      let cleanedUp = false;

      // Periodic ping to keep connection alive
      const pingInterval = setInterval(() => {
        try {
          writeEvent(controller, "ping", { timestamp: new Date().toISOString() });
        } catch {
          cleanup();
        }
      }, SSE_PING_INTERVAL_MS);

      // Subscribe to budget events
      const unsubscribe = subscribeBudgetEvents(budgetId, (event) => {
        try {
          writeEvent(controller, event.type, event);
        } catch {
          // Connection likely closed
          cleanup();
        }
      });

      function cleanup(closeController = false) {
        if (cleanedUp) return;
        cleanedUp = true;
        clearInterval(pingInterval);
        unsubscribe();
        request.signal.removeEventListener("abort", abortHandler);
        if (closeController) {
          try {
            controller.close();
          } catch {
            // stream may already be closed by the runtime
          }
        }
      }

      // Cleanup on abort
      const abortHandler = () => cleanup(true);
      cleanupStream = () => cleanup();

      request.signal.addEventListener("abort", abortHandler, { once: true });
    },
    cancel() {
      cleanupStream?.();
      cleanupStream = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function writePreamble(controller: ReadableStreamDefaultController<Uint8Array>) {
  controller.enqueue(encoder.encode(STREAM_PREAMBLE));
}

function writeEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}
