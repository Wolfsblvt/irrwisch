/**
 * Messages between the clearing's Durable Object and visitors.
 * Everything is small JSON over one WebSocket.
 */
import type { Budgets, ChalkStroke, Creature, Point, Room, Snapshot, Thing, ThingKind } from './world.ts';

/** Client → server. */
export type ClientMessage =
  | { t: 'build'; x?: number; y?: number }
  | { t: 'place'; kind: ThingKind; x?: number; y?: number }
  | { t: 'chalk'; room: number; strokes: ChalkStroke[] }
  | { t: 'nudge'; creature: number; from?: Point }
  | { t: 'wave' };

/** One change to the shared world, broadcast to everyone present. */
export type Delta =
  | { k: 'visits'; visits: number }
  | { k: 'presence'; count: number }
  | { k: 'walker'; path: Point[]; room: number }
  | { k: 'wear'; tiles: Array<Point & { wear: number }> }
  | { k: 'light'; room: number; litAt: number; lights: number }
  | { k: 'room'; room: Room }
  | { k: 'thing'; thing: Thing }
  | { k: 'chalk'; room: number; strokes: ChalkStroke[] }
  | { k: 'hop'; creature: number; to: Point; facing: number }
  | { k: 'wave'; at: Point }
  | { k: 'grow'; growth: number }
  | { k: 'wipe'; room: number }
  | { k: 'gone'; thing: number }
  | { k: 'omen'; omen: Omen | null };

/** A rare oddity everyone sees at the same time. */
export interface Omen {
  kind: 'eyes' | 'visitor' | 'hum';
  room?: number;
  until: number;
}

/** Server → client. */
export type ServerMessage =
  | { t: 'hello'; world: Snapshot; budgets: Budgets; hand: ThingKind[]; presence: number; omen: Omen | null; you: number; returning: boolean; known: boolean }
  | { t: 'delta'; ops: Delta[] }
  | { t: 'ack'; of: ClientMessage['t']; budgets: Budgets; note?: string }
  | { t: 'nope'; of: ClientMessage['t']; reason: string; budgets: Budgets };

export const ACTION_TYPES: ReadonlyArray<ClientMessage['t']> = ['build', 'place', 'chalk', 'nudge', 'wave'];

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { t?: unknown }).t;
  return typeof type === 'string' && ACTION_TYPES.includes(type as ClientMessage['t']);
}
