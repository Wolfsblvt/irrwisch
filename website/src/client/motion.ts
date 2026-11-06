/**
 * Timing for a stop-motion feel. Characters move on an 8 fps step clock;
 * the camera and light ease smoothly. Reduced motion collapses travel.
 */

const STEP_MS = 125;

export interface Clock {
  /** Wall-clock ms for this frame. */
  now: number;
  /** Frame index on the stepped clock. */
  step: number;
  /** Seconds since the first frame, smooth. */
  seconds: number;
}

export function createClock(): { tick(now: number): Clock } {
  let start = 0;
  return {
    tick(now: number): Clock {
      if (!start) start = now;
      return { now, step: Math.floor(now / STEP_MS), seconds: (now - start) / 1000 };
    },
  };
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function onReducedMotionChange(handler: (reduced: boolean) => void): void {
  if (typeof window === 'undefined') return;
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', (event) => handler(event.matches));
}

export function easeOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) * (1 - clamped);
}

export function easeInOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 2 * clamped * clamped : 1 - ((-2 * clamped + 2) ** 2) / 2;
}

/** A value that drifts toward a target by a fraction each frame, frame-rate independent. */
export function approach(current: number, target: number, rate: number, deltaSeconds: number): number {
  const factor = 1 - Math.exp(-rate * deltaSeconds);
  return current + (target - current) * factor;
}
