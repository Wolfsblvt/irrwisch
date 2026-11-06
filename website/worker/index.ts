/**
 * Worker entry: static assets serve the page; `/api/*` reaches the clearing.
 * The rate-limit binding counts connection attempts per network address in
 * Cloudflare's memory only; nothing about the address is stored anywhere.
 */
import { Clearing } from './clearing.ts';

export { Clearing };

interface Env {
  CLEARING: DurableObjectNamespace<Clearing>;
  ASSETS: Fetcher;
  RATE_IP?: RateLimit;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, at: new Date().toISOString() }, { headers: { 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/api/world') {
      if (request.method !== 'GET') return new Response('Method not allowed.', { status: 405 });
      return env.CLEARING.getByName('main').fetch(request);
    }
    if (url.pathname === '/api/ws') {
      if (request.headers.get('upgrade') !== 'websocket') {
        return new Response('Expected a WebSocket upgrade.', { status: 426 });
      }
      if (env.RATE_IP) {
        const address = request.headers.get('cf-connecting-ip') ?? 'unknown';
        const { success } = await env.RATE_IP.limit({ key: address });
        if (!success) return new Response('Too many arrivals from here. Try again in a minute.', { status: 429 });
      }
      return env.CLEARING.getByName('main').fetch(request);
    }
    if (url.pathname.startsWith('/api/')) {
      return new Response('Not found.', { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
