/**
 * One WebSocket to the clearing. Reconnects a few times with backoff. The
 * server recognises a reconnection within the same night, so it is neither a
 * new visit nor a new allowance; the client still does not retry forever.
 */
import type { ClientMessage, ServerMessage } from '../shared/protocol.ts';

export interface Connection {
  send(message: ClientMessage): boolean;
  close(): void;
}

export interface ConnectionHandlers {
  onMessage(message: ServerMessage): void;
  onOpen(): void;
  onClose(final: boolean): void;
}

const RETRY_DELAYS = [2000, 8000, 30000];
const PING_EVERY = 25000;

export function connect(handlers: ConnectionHandlers): Connection {
  let socket: WebSocket | null = null;
  let attempt = 0;
  let closedByUs = false;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const url = new URL('/api/ws', window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

  function open(): void {
    socket = new WebSocket(url);
    socket.addEventListener('open', () => {
      attempt = 0;
      handlers.onOpen();
      pingTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send('ping');
      }, PING_EVERY);
    });
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string' || event.data === 'pong') return;
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      handlers.onMessage(message);
    });
    socket.addEventListener('close', () => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      socket = null;
      if (closedByUs) return;
      const delay = RETRY_DELAYS[attempt];
      if (delay === undefined || document.visibilityState === 'hidden') {
        handlers.onClose(true);
        return;
      }
      attempt += 1;
      handlers.onClose(false);
      setTimeout(open, delay);
    });
    socket.addEventListener('error', () => {
      // The close event follows and carries the retry decision.
    });
  }

  open();

  return {
    send(message: ClientMessage): boolean {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(message));
      return true;
    },
    close(): void {
      closedByUs = true;
      socket?.close();
    },
  };
}
