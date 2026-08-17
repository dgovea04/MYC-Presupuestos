import { getAuthSession, requireAdminSession } from "@/lib/auth/session";
import { getResourcePriceUpdateRequest } from "@/lib/resource-pricing/requests";
import { subscribeResourcePriceEvents } from "@/lib/resource-pricing/events";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const admin = await requireAdminSession("resource_prices.manage");
  const ownedRequest = await getResourcePriceUpdateRequest(id, session.user.id, Boolean(admin));
  if (!ownedRequest) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      send({ type: "connected", requestId: id });
      unsubscribe = subscribeResourcePriceEvents(id, send);
      const heartbeat = setInterval(() => send({ type: "ping", requestId: id }), 15000);
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* stream already closed */ }
      }, { once: true });
    },
    cancel() {
      unsubscribe();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
