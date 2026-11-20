/**
 * Who counts as "the same person". Every person is counted once, ever, and
 * gets one allowance per night. Two things recognise them:
 *
 * - a random token in a first-party cookie, which survives new network
 *   addresses and the switch between IPv4 and IPv6 for weeks and months;
 * - the network address the connection comes from, as a fallback when the
 *   cookie is gone (cleared storage, a private window, a second browser).
 *
 * The server keeps salted hashes of both, never the token or the address.
 */

/** How long one allowance and one walk in last. */
export const NIGHT_MS = 12 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long an address still points at the person last seen behind it. */
export const ADDRESS_MEMORY_MS = 30 * DAY_MS;
/** How long a token is remembered after its last visit; matches the cookie lifetime. */
export const TOKEN_MEMORY_MS = 400 * DAY_MS;

export const TOKEN_COOKIE = 'wisp';
export const TOKEN_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;

/**
 * Reduces an address to the part that identifies a household or device:
 * the whole IPv4 address, or the /64 prefix of an IPv6 address (the rest
 * rotates by design).
 */
export function addressBucket(address: string): string {
  const text = address.trim().toLowerCase();
  if (!text.includes(':')) return text;
  const [head = '', tail = ''] = text.split('::');
  const left = head === '' ? [] : head.split(':');
  const right = tail === '' ? [] : tail.split(':');
  const groups = text.includes('::') ? [...left, ...new Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left;
  return `${groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/u, '')).join(':')}::/64`;
}

/** Reads the visitor token from a Cookie header; anything malformed is no token. */
export function visitorToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, value] = part.trim().split('=');
    if (name === TOKEN_COOKIE && value && /^[0-9a-f]{32}$/u.test(value)) return value;
  }
  return null;
}

/** The Set-Cookie value that stores or renews the token. */
export function tokenCookie(token: string): string {
  return `${TOKEN_COOKIE}=${token}; Max-Age=${TOKEN_COOKIE_MAX_AGE_S}; Path=/; Secure; HttpOnly; SameSite=Lax`;
}
