import { NextRequest } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { orderEvents, OrderEventPayload } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const session = getSessionFromCookies(cookieHeader);

  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userActiveBrandId = session.activeBrandId as string | undefined;
  const isSuperAdmin = session.role === 'SUPER_ADMIN';

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // 1. Send initial connected event
      const initialPayload = JSON.stringify({
        connected: true,
        time: new Date().toISOString(),
        brandId: userActiveBrandId || 'ALL',
      });
      controller.enqueue(encoder.encode(`event: connected\ndata: ${initialPayload}\n\n`));

      // 2. Order change listener
      const onOrderChange = (data: OrderEventPayload) => {
        try {
          // Filter by brand unless SUPER_ADMIN
          if (!isSuperAdmin && userActiveBrandId && data.brandId !== userActiveBrandId) {
            return;
          }

          const eventName = data.action === 'CREATED' ? 'order_created' : 'order_updated';
          const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Stream might be closed
        }
      };

      orderEvents.on('order_event', onOrderChange);

      // 3. Heartbeat keepalive every 15s to keep proxies & browsers from closing the socket
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      // 4. Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        orderEvents.off('order_event', onOrderChange);
        clearInterval(pingInterval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for NGINX
    },
  });
}
