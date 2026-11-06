/**
 * Client-side view of the clearing: the shared world plus the transient
 * things only a watcher sees, such as a walker on the path or a wave.
 */
import type { Delta, Omen } from '../shared/protocol.ts';
import { type Point, type Snapshot, World } from '../shared/world.ts';

export interface Walker {
  id: number;
  path: Point[];
  room: number;
  startedAt: number;
  /** ms per path step. */
  pace: number;
}

export interface Hop {
  creature: number;
  from: Point;
  to: Point;
  startedAt: number;
}

export interface Wave {
  at: Point;
  startedAt: number;
}

export interface Pulse {
  kind: 'room' | 'thing' | 'light' | 'chalk';
  at: Point;
  z: number;
  startedAt: number;
}

export type ViewEvent =
  | { kind: 'visits'; visits: number }
  | { kind: 'presence'; count: number }
  | { kind: 'arrival'; mine: boolean }
  | { kind: 'room'; mine: boolean }
  | { kind: 'thing'; mine: boolean }
  | { kind: 'chalk'; mine: boolean }
  | { kind: 'hop'; mine: boolean }
  | { kind: 'wave'; mine: boolean }
  | { kind: 'omen'; omen: Omen | null }
  | { kind: 'ground' };

export const WALK_PACE_MS = 320;
export const HOP_MS = 260;
export const WAVE_MS = 1400;
export const PULSE_MS = 700;

export class View {
  world: World;
  visits = 0;
  presence = 1;
  omen: Omen | null = null;
  /** Server clock offset (server now - client now) for age-based rendering. */
  skew = 0;
  readonly walkers: Walker[] = [];
  readonly hops: Hop[] = [];
  readonly waves: Wave[] = [];
  readonly pulses: Pulse[] = [];
  /** Counts of things this watcher just did, so deltas can be told apart from others'. */
  readonly expecting = { room: 0, thing: 0, chalk: 0, hop: 0, wave: 0 };
  /** True between the hello and the first walker delta, which is this watcher's own arrival. */
  expectingArrival = false;
  private walkerSeq = 0;
  private readonly listeners = new Set<(event: ViewEvent) => void>();

  constructor(snapshot: Snapshot) {
    this.world = new World(snapshot);
    this.visits = snapshot.visits;
    this.skew = snapshot.now - Date.now();
  }

  /** Server time as best the client can tell. */
  now(): number {
    return Date.now() + this.skew;
  }

  subscribe(listener: (event: ViewEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  replace(snapshot: Snapshot): void {
    this.world = new World(snapshot);
    this.visits = snapshot.visits;
    this.skew = snapshot.now - Date.now();
    this.emit({ kind: 'ground' });
  }

  apply(ops: Delta[], now = performance.now()): void {
    for (const op of ops) this.applyOne(op, now);
  }

  private applyOne(op: Delta, now: number): void {
    switch (op.k) {
      case 'visits':
        this.visits = op.visits;
        this.emit({ kind: 'visits', visits: op.visits });
        return;
      case 'presence':
        this.presence = op.count;
        this.emit({ kind: 'presence', count: op.count });
        return;
      case 'walker': {
        this.walkerSeq += 1;
        const mine = this.expectingArrival;
        this.expectingArrival = false;
        this.walkers.push({ id: this.walkerSeq, path: op.path, room: op.room, startedAt: now, pace: WALK_PACE_MS });
        this.emit({ kind: 'arrival', mine });
        return;
      }
      case 'wear':
        for (const tile of op.tiles) this.world.wear.set(`${tile.x},${tile.y}`, tile.wear);
        this.emit({ kind: 'ground' });
        return;
      case 'light': {
        const room = this.world.rooms.get(op.room);
        if (!room) return;
        room.litAt = op.litAt;
        room.lights = op.lights;
        // The window lights once the walker reaches the door; the pulse is
        // queued by the scene when the walker finishes instead of here.
        return;
      }
      case 'room': {
        if (this.world.rooms.has(op.room.id)) return;
        this.world.addRoom(op.room);
        this.pulses.push({ kind: 'room', at: { x: op.room.x, y: op.room.y }, z: op.room.z, startedAt: now });
        const mine = this.expecting.room > 0;
        if (mine) this.expecting.room -= 1;
        this.emit({ kind: 'room', mine });
        return;
      }
      case 'thing': {
        if (this.world.things.has(op.thing.id)) return;
        this.world.addThing(op.thing);
        this.pulses.push({ kind: 'thing', at: { x: op.thing.x, y: op.thing.y }, z: 0, startedAt: now });
        const mine = this.expecting.thing > 0;
        if (mine) this.expecting.thing -= 1;
        this.emit({ kind: 'thing', mine });
        return;
      }
      case 'chalk': {
        const room = this.world.rooms.get(op.room);
        if (!room) return;
        for (const [cell, colour] of op.strokes) room.sign[cell] = colour;
        this.pulses.push({ kind: 'chalk', at: { x: room.x, y: room.y }, z: room.z, startedAt: now });
        const mine = this.expecting.chalk > 0;
        if (mine) this.expecting.chalk -= 1;
        this.emit({ kind: 'chalk', mine });
        return;
      }
      case 'hop': {
        const creature = this.world.creatures.get(op.creature);
        if (!creature) {
          this.world.creatures.set(op.creature, { id: op.creature, x: op.to.x, y: op.to.y, facing: op.facing, movedAt: this.now() });
          this.pulses.push({ kind: 'thing', at: op.to, z: 0, startedAt: now });
          return;
        }
        this.hops.push({ creature: creature.id, from: { x: creature.x, y: creature.y }, to: op.to, startedAt: now });
        creature.x = op.to.x;
        creature.y = op.to.y;
        creature.facing = op.facing;
        creature.movedAt = this.now();
        const mine = this.expecting.hop > 0;
        if (mine) this.expecting.hop -= 1;
        this.emit({ kind: 'hop', mine });
        return;
      }
      case 'wave': {
        this.waves.push({ at: op.at, startedAt: now });
        const mine = this.expecting.wave > 0;
        if (mine) this.expecting.wave -= 1;
        this.emit({ kind: 'wave', mine });
        return;
      }
      case 'omen':
        this.omen = op.omen;
        this.emit({ kind: 'omen', omen: op.omen });
        return;
      default:
        return;
    }
  }

  /** Drop finished transients; called once per frame. */
  sweep(now: number): void {
    for (let index = this.walkers.length - 1; index >= 0; index -= 1) {
      const walker = this.walkers[index];
      const duration = walker.path.length * walker.pace + 900;
      if (now - walker.startedAt > duration) {
        this.walkers.splice(index, 1);
        const room = this.world.rooms.get(walker.room);
        if (room) this.pulses.push({ kind: 'light', at: { x: room.x, y: room.y }, z: room.z, startedAt: now });
      }
    }
    prune(this.hops, now, HOP_MS);
    prune(this.waves, now, WAVE_MS);
    prune(this.pulses, now, PULSE_MS);
  }

  private emit(event: ViewEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

function prune(list: Array<{ startedAt: number }>, now: number, lifetime: number): void {
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (now - list[index].startedAt > lifetime) list.splice(index, 1);
  }
}
