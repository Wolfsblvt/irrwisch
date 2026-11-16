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
  /** Operator moderation secret, set by Wolf Ops with `wrangler secret put ADMIN_TOKEN`. Unset means no admin routes. */
  ADMIN_TOKEN?: string;
}

/** Compare two strings without leaking where they differ. */
function sameSecret(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
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
    if (url.pathname.startsWith('/api/admin/')) {
      const expected = env.ADMIN_TOKEN;
      const given = (request.headers.get('authorization') ?? '').replace(/^Bearer /u, '');
      if (!expected || expected.length < 24 || !sameSecret(given, expected)) return new Response('Not found.', { status: 404 });
      return env.CLEARING.getByName('main').fetch(request);
    }
    if (url.pathname.startsWith('/api/')) {
      return new Response('Not found.', { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
