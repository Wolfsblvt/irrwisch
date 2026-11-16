/**
 * The clearing: one shared world model and the rules that keep it additive.
 *
 * Everything here runs on both sides. The Durable Object uses it to validate
 * and apply actions; the client uses it to show valid spots and to render the
 * same clearing shape the server reasons about.
 */
import { hashInts, unit } from './rng.ts';

export const WORLD_VERSION = 1;

/** Ground grid edge length. Cells are addressed 0..GRID-1 on both axes. */
export const GRID = 96;
/** The settlement starts around the middle of the grid. */
export const CENTER = { x: 48, y: 48 } as const;
/** The woods step back at most this many times; each step widens the clearing by one cell. */
export const MAX_GROWTH = 30;
/** Share of clearing ground that may be taken before the woods step back. */
export const GROWTH_AT = 0.3;
/** Rooms may stack this high (z is 0-based). */
export const MAX_HEIGHT = 4;
/** Chalk slates are square bitmaps of this edge length. */
export const SIGN_SIZE = 8;
export const SIGN_CELLS = SIGN_SIZE * SIGN_SIZE;
/** Things may be placed this far (Chebyshev) from the nearest room. */
export const THING_REACH = 3;

export const ROOM_HUES = ['ochre', 'moss', 'dusk', 'plum'] as const;
export type RoomHue = (typeof ROOM_HUES)[number];
export const ROOF_SHAPES = ['pitched', 'hip', 'flat'] as const;
export type RoofShape = (typeof ROOF_SHAPES)[number];

export const THING_KINDS = ['lantern', 'sapling', 'mushroom', 'stone', 'pumpkin', 'bones', 'scarecrow'] as const;
export type ThingKind = (typeof THING_KINDS)[number];
/** Relative draw weights for the three-card hand a visitor is offered. */
export const THING_WEIGHTS: Record<ThingKind, number> = {
  lantern: 5,
  sapling: 5,
  mushroom: 4,
  stone: 4,
  pumpkin: 2,
  bones: 1,
  scarecrow: 1,
};

/** Chalk colours. 0 is bare slate and can never be chosen. */
export const CHALK_BARE = 0;
export const CHALK_WHITE = 1;
export const CHALK_EMBER = 2;
export type ChalkColour = typeof CHALK_WHITE | typeof CHALK_EMBER;

/** What one connection may still do. */
export interface Budgets {
  build: number;
  place: number;
  chalk: number;
  nudge: number;
}
export const FRESH_BUDGETS: Budgets = { build: 1, place: 1, chalk: 12, nudge: 3 };

export interface Room {
  id: number;
  x: number;
  y: number;
  z: number;
  hue: RoomHue;
  roof: RoofShape;
  /** Unix ms of the last visitor who entered this room; 0 if never lit. */
  litAt: number;
  /** How many visitors have entered this room. */
  lights: number;
  /** SIGN_CELLS entries of 0, 1 or 2. */
  sign: number[];
}

export interface Thing {
  id: number;
  kind: ThingKind;
  x: number;
  y: number;
  placedAt: number;
}

export interface Creature {
  id: number;
  x: number;
  y: number;
  /** 0 = toward +x, 1 = toward +y, 2 = toward -x, 3 = toward -y. */
  facing: number;
  movedAt: number;
}

export interface Tile {
  x: number;
  y: number;
  wear: number;
}

export interface Snapshot {
  version: number;
  createdAt: number;
  now: number;
  visits: number;
  /** How many steps the woods have receded. */
  growth: number;
  rooms: Room[];
  things: Thing[];
  creatures: Creature[];
  /** Only tiles with wear > 0. */
  tiles: Tile[];
}

export interface Point {
  x: number;
  y: number;
}

/** A mutable in-memory index over a snapshot, used by rules on both sides. */
export class World {
  readonly rooms = new Map<number, Room>();
  readonly things = new Map<number, Thing>();
  readonly creatures = new Map<number, Creature>();
  readonly wear = new Map<string, number>();
  /** How many steps the woods have receded; widens the clearing. */
  growth = 0;
  /** Rooms stacked per ground cell, ordered by z. */
  private readonly stacks = new Map<string, Room[]>();
  private readonly thingsByCell = new Map<string, Thing>();

  constructor(snapshot?: Snapshot) {
    if (!snapshot) return;
    this.growth = snapshot.growth ?? 0;
    for (const room of snapshot.rooms) this.addRoom(room);
    for (const thing of snapshot.things) this.addThing(thing);
    for (const creature of snapshot.creatures) this.creatures.set(creature.id, creature);
    for (const tile of snapshot.tiles) this.wear.set(key(tile.x, tile.y), tile.wear);
  }

  addRoom(room: Room): void {
    this.rooms.set(room.id, room);
    const stack = this.stacks.get(key(room.x, room.y)) ?? [];
    stack.push(room);
    stack.sort((a, b) => a.z - b.z);
    this.stacks.set(key(room.x, room.y), stack);
  }

  addThing(thing: Thing): void {
    this.things.set(thing.id, thing);
    this.thingsByCell.set(key(thing.x, thing.y), thing);
  }

  stackAt(x: number, y: number): Room[] {
    return this.stacks.get(key(x, y)) ?? [];
  }

  removeThing(id: number): Thing | undefined {
    const thing = this.things.get(id);
    if (!thing) return undefined;
    this.things.delete(id);
    this.thingsByCell.delete(key(thing.x, thing.y));
    return thing;
  }

  thingAt(x: number, y: number): Thing | undefined {
    return this.thingsByCell.get(key(x, y));
  }

  creatureAt(x: number, y: number): Creature | undefined {
    for (const creature of this.creatures.values()) {
      if (creature.x === x && creature.y === y) return creature;
    }
    return undefined;
  }

  wearAt(x: number, y: number): number {
    return this.wear.get(key(x, y)) ?? 0;
  }

  addWear(x: number, y: number, amount = 1): number {
    const next = this.wearAt(x, y) + amount;
    this.wear.set(key(x, y), next);
    return next;
  }

  /** Ground cells that hold at least one room. */
  groundRoomCells(): Point[] {
    const cells: Point[] = [];
    for (const stack of this.stacks.values()) {
      const base = stack[0];
      if (base) cells.push({ x: base.x, y: base.y });
    }
    return cells;
  }
}

export function key(x: number, y: number): string {
  return `${x},${y}`;
}

export function inGrid(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < GRID && y < GRID;
}

/**
 * The clearing is an irregular blob around the centre. Everything outside is
 * forest. Both sides derive it from the same deterministic noise so they
 * agree without transferring a mask.
 */
export function isClearing(x: number, y: number, growth = 0): boolean {
  if (!inGrid(x, y)) return false;
  const dx = x - CENTER.x;
  const dy = y - CENTER.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const radius = clearingRadius(angle) + Math.min(MAX_GROWTH, Math.max(0, growth));
  return distance <= radius;
}

/** Every ground cell of the clearing at a given growth. */
export function clearingCells(growth = 0): Point[] {
  const cells: Point[] = [];
  const reach = 13 + Math.min(MAX_GROWTH, Math.max(0, growth));
  for (let x = CENTER.x - reach; x <= CENTER.x + reach; x += 1) {
    for (let y = CENTER.y - reach; y <= CENTER.y + reach; y += 1) {
      if (isClearing(x, y, growth)) cells.push({ x, y });
    }
  }
  return cells;
}

/** Share of clearing ground that holds a room stack or a thing. */
export function groundOccupancy(world: World): number {
  const total = clearingCells(world.growth).length;
  return total === 0 ? 1 : (world.groundRoomCells().length + world.things.size) / total;
}

/** The woods step back once the ground gets crowded, until they cannot any more. */
export function shouldGrow(world: World): boolean {
  return world.growth < MAX_GROWTH && groundOccupancy(world) > GROWTH_AT;
}

/** Base radius of the clearing in a given direction, roughly 9 to 12 cells before any growth. */
export function clearingRadius(angle: number): number {
  const turn = ((angle + Math.PI) / (Math.PI * 2)) * 12;
  const a = Math.floor(turn);
  const b = (a + 1) % 12;
  const t = turn - a;
  const smooth = t * t * (3 - 2 * t);
  const ra = 9 + unit(hashInts(a, 7, 31)) * 3;
  const rb = 9 + unit(hashInts(b, 7, 31)) * 3;
  return ra + (rb - ra) * smooth;
}

/** The well sits in the middle and is never built on. */
export const WELL: Point = { x: CENTER.x, y: CENTER.y };

export function isReserved(x: number, y: number): boolean {
  return x === WELL.x && y === WELL.y;
}

/** Where visitors walk in from: the clearing cell nearest the viewer's edge. */
export function entryPoint(growth = 0): Point {
  let best: Point = { x: CENTER.x, y: CENTER.y };
  let bestScore = -Infinity;
  for (let x = 0; x < GRID; x += 1) {
    for (let y = 0; y < GRID; y += 1) {
      if (!isClearing(x, y, growth)) continue;
      // Screen-down is +x+y in the isometric projection; prefer a slightly
      // left-of-centre entry so the path crosses the clearing diagonally.
      const score = x + y - Math.abs(x - y - 4) * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

/** Deterministic roof shape and hue for a room coordinate. */
export function roofFor(x: number, y: number, z: number): RoofShape {
  return ROOF_SHAPES[hashInts(x, y, z + 101) % ROOF_SHAPES.length];
}

export function neighbours(x: number, y: number): Point[] {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
}

export type BuildVerdict =
  | { ok: true; z: number }
  | { ok: false; reason: 'outside' | 'reserved' | 'occupied' | 'too-high' | 'detached' };

/** A room may stack on an existing stack or sit on the ground beside one. */
export function canBuild(world: World, x: number, y: number): BuildVerdict {
  if (!isClearing(x, y, world.growth)) return { ok: false, reason: 'outside' };
  if (isReserved(x, y)) return { ok: false, reason: 'reserved' };
  const stack = world.stackAt(x, y);
  if (stack.length > 0) {
    if (stack.length > MAX_HEIGHT) return { ok: false, reason: 'too-high' };
    return { ok: true, z: stack.length };
  }
  if (world.thingAt(x, y) || world.creatureAt(x, y)) return { ok: false, reason: 'occupied' };
  const touches = neighbours(x, y).some((cell) => world.stackAt(cell.x, cell.y).length > 0);
  if (!touches) return { ok: false, reason: 'detached' };
  return { ok: true, z: 0 };
}

export type PlaceVerdict =
  | { ok: true }
  | { ok: false; reason: 'outside' | 'reserved' | 'occupied' | 'far' | 'kind' };

/** A thing sits on free ground within reach of the settlement. */
export function canPlace(world: World, kind: string, x: number, y: number): PlaceVerdict {
  if (!THING_KINDS.includes(kind as ThingKind)) return { ok: false, reason: 'kind' };
  if (!isClearing(x, y, world.growth)) return { ok: false, reason: 'outside' };
  if (isReserved(x, y)) return { ok: false, reason: 'reserved' };
  if (world.stackAt(x, y).length > 0 || world.thingAt(x, y) || world.creatureAt(x, y)) {
    return { ok: false, reason: 'occupied' };
  }
  const near = world.groundRoomCells().some(
    (cell) => Math.max(Math.abs(cell.x - x), Math.abs(cell.y - y)) <= THING_REACH,
  );
  if (!near) return { ok: false, reason: 'far' };
  return { ok: true };
}

export type ChalkStroke = [cell: number, colour: ChalkColour];
export type ChalkVerdict =
  | { ok: true; strokes: ChalkStroke[] }
  | { ok: false; reason: 'room' | 'empty' | 'budget' | 'cell' | 'colour' | 'taken' };

/** Chalk may only add colour to bare cells, up to the connection's budget. */
export function canChalk(world: World, roomId: number, strokes: unknown, budget: number): ChalkVerdict {
  const room = world.rooms.get(roomId);
  if (!room) return { ok: false, reason: 'room' };
  if (!Array.isArray(strokes) || strokes.length === 0) return { ok: false, reason: 'empty' };
  if (strokes.length > budget) return { ok: false, reason: 'budget' };
  const seen = new Set<number>();
  const accepted: ChalkStroke[] = [];
  for (const stroke of strokes) {
    if (!Array.isArray(stroke) || stroke.length !== 2) return { ok: false, reason: 'cell' };
    const [cell, colour] = stroke;
    if (!Number.isInteger(cell) || cell < 0 || cell >= SIGN_CELLS || seen.has(cell)) {
      return { ok: false, reason: 'cell' };
    }
    if (colour !== CHALK_WHITE && colour !== CHALK_EMBER) return { ok: false, reason: 'colour' };
    if (room.sign[cell] !== CHALK_BARE) return { ok: false, reason: 'taken' };
    seen.add(cell);
    accepted.push([cell, colour]);
  }
  return { ok: true, strokes: accepted };
}

/** Cells a creature may step onto: clearing ground with nothing standing on it. */
export function isWalkable(world: World, x: number, y: number): boolean {
  return isClearing(x, y, world.growth)
    && !isReserved(x, y)
    && world.stackAt(x, y).length === 0
    && !world.creatureAt(x, y);
}

/** Where a nudged creature hops: a free neighbour, preferring away from the pusher. */
export function nudgeTarget(world: World, creature: Creature, from: Point, random: () => number): Point | null {
  const options = neighbours(creature.x, creature.y)
    .filter((cell) => isWalkable(world, cell.x, cell.y) && !world.thingAt(cell.x, cell.y));
  if (options.length === 0) return null;
  const away = options.filter((cell) => {
    const before = Math.hypot(creature.x - from.x, creature.y - from.y);
    const after = Math.hypot(cell.x - from.x, cell.y - from.y);
    return after > before;
  });
  const pool = away.length > 0 ? away : options;
  return pool[Math.floor(random() * pool.length)];
}

/** Breadth-first path over walkable ground; things do not block walkers. */
export function findPath(world: World, from: Point, to: Point): Point[] {
  const start = key(from.x, from.y);
  const goal = key(to.x, to.y);
  const previous = new Map<string, string | null>([[start, null]]);
  const queue: Point[] = [from];
  while (queue.length > 0) {
    const current = queue.shift() as Point;
    const currentKey = key(current.x, current.y);
    if (currentKey === goal) break;
    for (const next of neighbours(current.x, current.y)) {
      const nextKey = key(next.x, next.y);
      if (previous.has(nextKey)) continue;
      const passable = nextKey === goal || (isClearing(next.x, next.y, world.growth) && world.stackAt(next.x, next.y).length === 0);
      if (!passable) continue;
      previous.set(nextKey, currentKey);
      queue.push(next);
    }
  }
  if (!previous.has(goal)) return [];
  const path: Point[] = [];
  let cursor: string | null = goal;
  while (cursor) {
    const [x, y] = cursor.split(',').map(Number);
    path.push({ x, y });
    cursor = previous.get(cursor) ?? null;
  }
  return path.reverse();
}

/** The ground cell a walker stops on to enter a room: a free neighbour of its stack. */
export function doorstep(world: World, room: Room): Point | null {
  // Prefer the viewer-facing sides (+x and +y) so the figure is visible at the door.
  const candidates = [
    { x: room.x, y: room.y + 1 },
    { x: room.x + 1, y: room.y },
    { x: room.x, y: room.y - 1 },
    { x: room.x - 1, y: room.y },
  ];
  for (const cell of candidates) {
    if (isClearing(cell.x, cell.y, world.growth) && world.stackAt(cell.x, cell.y).length === 0) return cell;
  }
  return null;
}

/** Brightness 0..1 of a window given when it was last lit; embers never die. */
export function windowGlow(room: Room, now: number): number {
  if (room.lights === 0 || room.litAt === 0) return 0;
  const age = Math.max(0, now - room.litAt);
  const hour = 60 * 60 * 1000;
  if (age < hour) return 1;
  const week = 7 * 24 * hour;
  const faded = 1 - Math.min(1, (age - hour) / week);
  return 0.18 + faded * 0.72;
}

/** Growth stage 0..3 of a sapling by age; other things do not grow. */
export function growthStage(thing: Thing, now: number): number {
  if (thing.kind !== 'sapling') return 0;
  const days = Math.max(0, now - thing.placedAt) / (24 * 60 * 60 * 1000);
  if (days >= 7) return 3;
  if (days >= 3) return 2;
  if (days >= 1) return 1;
  return 0;
}

/** Deal a hand of three distinct kinds from the weighted pool. */
export function dealHand(random: () => number): ThingKind[] {
  const pool = [...THING_KINDS];
  const hand: ThingKind[] = [];
  while (hand.length < 3 && pool.length > 0) {
    const total = pool.reduce((sum, kind) => sum + THING_WEIGHTS[kind], 0);
    let roll = random() * total;
    let chosen = pool[pool.length - 1];
    for (const kind of pool) {
      roll -= THING_WEIGHTS[kind];
      if (roll <= 0) {
        chosen = kind;
        break;
      }
    }
    hand.push(chosen);
    pool.splice(pool.indexOf(chosen), 1);
  }
  return hand;
}

/** Candidate cells for "let the clearing choose": all currently valid build spots. */
export function buildSpots(world: World): Array<Point & { z: number }> {
  const spots: Array<Point & { z: number }> = [];
  const seen = new Set<string>();
  for (const cell of world.groundRoomCells()) {
    for (const candidate of [cell, ...neighbours(cell.x, cell.y)]) {
      const candidateKey = key(candidate.x, candidate.y);
      if (seen.has(candidateKey)) continue;
      seen.add(candidateKey);
      const verdict = canBuild(world, candidate.x, candidate.y);
      if (verdict.ok) spots.push({ ...candidate, z: verdict.z });
    }
  }
  return spots;
}

/** Candidate cells for placing a thing when the visitor lets the clearing choose. */
export function placeSpots(world: World, kind: ThingKind): Point[] {
  const spots: Point[] = [];
  const seen = new Set<string>();
  for (const cell of world.groundRoomCells()) {
    for (let dx = -THING_REACH; dx <= THING_REACH; dx += 1) {
      for (let dy = -THING_REACH; dy <= THING_REACH; dy += 1) {
        const candidate = { x: cell.x + dx, y: cell.y + dy };
        const candidateKey = key(candidate.x, candidate.y);
        if (seen.has(candidateKey)) continue;
        seen.add(candidateKey);
        if (canPlace(world, kind, candidate.x, candidate.y).ok) spots.push(candidate);
      }
    }
  }
  return spots;
}

/** The seed the clearing starts from before anyone has visited. */
export function seedSnapshot(now: number): Snapshot {
  const cx = CENTER.x;
  const cy = CENTER.y;
  const room = (id: number, x: number, y: number, z: number, hue: RoomHue, lit: boolean): Room => ({
    id, x, y, z, hue, roof: roofFor(x, y, z), litAt: lit ? now : 0, lights: lit ? 1 : 0, sign: blankSign(),
  });
  const rooms: Room[] = [
    room(1, cx, cy - 2, 0, 'ochre', true),
    room(2, cx + 1, cy - 2, 0, 'moss', false),
    room(3, cx, cy - 2, 1, 'dusk', false),
    room(4, cx - 2, cy, 0, 'plum', false),
  ];
  const things: Thing[] = [
    { id: 1, kind: 'lantern', x: cx + 1, y: cy + 1, placedAt: now },
    { id: 2, kind: 'stone', x: cx - 3, y: cy - 1, placedAt: now },
    { id: 3, kind: 'sapling', x: cx + 3, y: cy, placedAt: now - 2 * 24 * 60 * 60 * 1000 },
  ];
  const creatures: Creature[] = [
    { id: 1, x: cx + 2, y: cy + 3, facing: 2, movedAt: now },
    { id: 2, x: cx - 4, y: cy + 1, facing: 0, movedAt: now },
  ];
  return { version: WORLD_VERSION, createdAt: now, now, visits: 0, growth: 0, rooms, things, creatures, tiles: [] };
}

export function blankSign(): number[] {
  return new Array<number>(SIGN_CELLS).fill(CHALK_BARE);
}
