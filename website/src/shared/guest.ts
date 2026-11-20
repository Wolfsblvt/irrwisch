/**
 * Who counts as "the same visitor tonight". The page stores nothing on the
 * device, so the only thing that can tell a reload from a stranger is the
 * network address the connection comes from. The server keeps a salted hash
 * of this bucket for one night, never the address itself.
 */

/** How long one allowance and one counted visit last per address. */
export const NIGHT_MS = 12 * 60 * 60 * 1000;

/**
 * Reduces an address to the part that identifies a household or device:
 * the whole IPv4 address, or the /64 prefix of an IPv6 address (the rest
 * rotates by design and would hand out a fresh allowance on every rotation).
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
