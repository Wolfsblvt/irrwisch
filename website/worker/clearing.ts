/**
 * The clearing's single Durable Object: validates every action against the
 * shared rules, persists the world in SQLite, fans out deltas to everyone
 * present over hibernating WebSockets, and runs the world's own slow clock.
 */
import { DurableObject } from 'cloudflare:workers';
import { createRandom, hashInts } from '../src/shared/rng.ts';
import {
  type Budgets,
  type Creature,
  FRESH_BUDGETS,
  type Point,
  type Room,
  ROOM_HUES,
  SIGN_CELLS,
  type Snapshot,
  type Thing,
  type ThingKind,
  WORLD_VERSION,
  World,
  blankSign,
  buildSpots,
  canBuild,
  canChalk,
  canPlace,
  dealHand,
  doorstep,
  entryPoint,
  findPath,
  isWalkable,
  neighbours,
  nudgeTarget,
  placeSpots,
  roofFor,
  seedSnapshot,
} from '../src/shared/world.ts';
import { type ClientMessage, type Delta, type Omen, type ServerMessage, isClientMessage } from '../src/shared/protocol.ts';

interface Session {
  id: number;
  budgets: Budgets;
  hand: ThingKind[];
  lastActionAt: number;
  lastWaveAt: number;
}

const TICK_ACTIVE_MS = 10 * 60 * 1000;
const TICK_IDLE_MS = 6 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MIN_ACTION_GAP_MS = 120;
const WAVE_GAP_MS = 2500;
const MAX_CREATURES = 7;

export class Clearing extends DurableObject {
  private readonly sql: SqlStorage;
  private readonly sessions = new Map<WebSocket, Session>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.ensureSchema();
    for (const socket of ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as Session | null;
      if (attachment) this.sessions.set(socket, attachment);
    }
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  // ----- HTTP entry -------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/world') {
      return Response.json(this.snapshot(), {
        headers: { 'cache-control': 'public, max-age=5' },
      });
    }
    if (url.pathname === '/api/ws') {
      if (request.headers.get('upgrade') !== 'websocket') {
        return new Response('Expected a WebSocket upgrade.', { status: 426 });
      }
      return this.openSession();
    }
    return new Response('Not found.', { status: 404 });
  }

  private openSession(): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const now = Date.now();
    const id = this.nextId('session');
    const random = createRandom(hashInts(id, now & 0xffff, 9));
    const session: Session = {
      id,
      budgets: { ...FRESH_BUDGETS },
      hand: dealHand(random),
      lastActionAt: 0,
      lastWaveAt: 0,
    };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(session);
    this.sessions.set(server, session);

    const arrival = this.arrive(now, random);
    const hello: ServerMessage = {
      t: 'hello',
      world: this.snapshot(),
      budgets: session.budgets,
      hand: session.hand,
      presence: this.ctx.getWebSockets().length,
      omen: this.currentOmen(now),
      you: id,
    };
    server.send(JSON.stringify(hello));
    this.broadcast([...arrival, { k: 'presence', count: this.ctx.getWebSockets().length }]);
    this.touch(now);
    void this.scheduleTick(now);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ----- WebSocket handlers ----------------------------------------------

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const session = this.sessions.get(socket);
    if (!session) {
      socket.close(1008, 'Unknown session.');
      return;
    }
    if (typeof raw !== 'string' || raw.length > 4096) {
      this.reply(socket, { t: 'nope', of: 'wave', reason: 'shape', budgets: session.budgets });
      return;
    }
    let message: unknown;
    try {
      message = JSON.parse(raw);
    } catch {
      this.reply(socket, { t: 'nope', of: 'wave', reason: 'shape', budgets: session.budgets });
      return;
    }
    if (!isClientMessage(message)) {
      this.reply(socket, { t: 'nope', of: 'wave', reason: 'shape', budgets: session.budgets });
      return;
    }
    const now = Date.now();
    if (now - session.lastActionAt < MIN_ACTION_GAP_MS) {
      this.reply(socket, { t: 'nope', of: message.t, reason: 'hurry', budgets: session.budgets });
      return;
    }
    session.lastActionAt = now;
    const result = this.handle(message, session, now);
    socket.serializeAttachment(session);
    if (result.ok) {
      this.reply(socket, { t: 'ack', of: message.t, budgets: session.budgets, note: result.note });
      if (result.deltas.length > 0) this.broadcast(result.deltas);
      this.touch(now);
    } else {
      this.reply(socket, { t: 'nope', of: message.t, reason: result.reason, budgets: session.budgets });
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    this.sessions.delete(socket);
    this.broadcast([{ k: 'presence', count: Math.max(0, this.ctx.getWebSockets().length - 1) }]);
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    this.sessions.delete(socket);
  }

  // ----- The world's own clock -------------------------------------------

  async alarm(): Promise<void> {
    const now = Date.now();
    const world = this.world();
    const deltas: Delta[] = [];
    const random = createRandom(hashInts(now & 0xffffff, 3, 17));

    for (const creature of world.creatures.values()) {
      if (random() < 0.55) continue;
      const options = neighbours(creature.x, creature.y)
        .filter((cell) => isWalkable(world, cell.x, cell.y) && !world.thingAt(cell.x, cell.y));
      if (options.length === 0) continue;
      const to = options[Math.floor(random() * options.length)];
      const facing = facingFrom(creature, to);
      this.sql.exec('UPDATE creatures SET x = ?, y = ?, facing = ?, moved_at = ? WHERE id = ?', to.x, to.y, facing, now, creature.id);
      creature.x = to.x;
      creature.y = to.y;
      deltas.push({ k: 'hop', creature: creature.id, to, facing });
    }

    const spawned = this.maybeSpawnCreature(world, now, random);
    if (spawned) deltas.push(spawned);

    const omen = this.rollOmen(world, now, random);
    if (omen !== undefined) deltas.push({ k: 'omen', omen });

    if (deltas.length > 0) this.broadcast(deltas);
    await this.scheduleTick(now, true);
  }

  private async scheduleTick(now: number, fromAlarm = false): Promise<void> {
    const existing = await this.ctx.storage.getAlarm();
    if (existing !== null && !fromAlarm) return;
    const lastTouch = Number(this.meta('touched_at') ?? 0);
    const open = this.ctx.getWebSockets().length > 0;
    const active = open || now - lastTouch < ACTIVE_WINDOW_MS;
    await this.ctx.storage.setAlarm(now + (active ? TICK_ACTIVE_MS : TICK_IDLE_MS));
  }

  // ----- Actions -----------------------------------------------------------

  private handle(message: ClientMessage, session: Session, now: number): HandleResult {
    switch (message.t) {
      case 'build':
        return this.build(message, session, now);
      case 'place':
        return this.place(message, session, now);
      case 'chalk':
        return this.chalk(message, session);
      case 'nudge':
        return this.nudge(message, session, now);
      case 'wave':
        return this.wave(session, now);
      default:
        return { ok: false, reason: 'shape' };
    }
  }

  private build(message: Extract<ClientMessage, { t: 'build' }>, session: Session, now: number): HandleResult {
    if (session.budgets.build <= 0) return { ok: false, reason: 'spent' };
    const world = this.world();
    let spot: { x: number; y: number; z: number } | null = null;
    let note: string | undefined;
    if (typeof message.x === 'number' && typeof message.y === 'number') {
      const verdict = canBuild(world, message.x, message.y);
      if (!verdict.ok) return { ok: false, reason: verdict.reason };
      spot = { x: message.x, y: message.y, z: verdict.z };
    } else {
      const spots = buildSpots(world);
      if (spots.length === 0) return { ok: false, reason: 'full' };
      const random = createRandom(hashInts(session.id, now & 0xffff, 5));
      spot = spots[Math.floor(random() * spots.length)];
      note = 'chosen';
    }
    const hue = ROOM_HUES[hashInts(spot.x, spot.y, spot.z + session.id) % ROOM_HUES.length];
    const room: Room = {
      id: this.nextId('room'),
      x: spot.x,
      y: spot.y,
      z: spot.z,
      hue,
      roof: roofFor(spot.x, spot.y, spot.z),
      litAt: 0,
      lights: 0,
      sign: blankSign(),
    };
    this.sql.exec(
      'INSERT INTO rooms (id, x, y, z, hue, roof, lit_at, lights, sign) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      room.id, room.x, room.y, room.z, room.hue, room.roof, room.litAt, room.lights, encodeSign(room.sign),
    );
    session.budgets.build -= 1;
    return { ok: true, deltas: [{ k: 'room', room }], note };
  }

  private place(message: Extract<ClientMessage, { t: 'place' }>, session: Session, now: number): HandleResult {
    if (session.budgets.place <= 0) return { ok: false, reason: 'spent' };
    if (!session.hand.includes(message.kind)) return { ok: false, reason: 'hand' };
    const world = this.world();
    let spot: Point | null = null;
    let note: string | undefined;
    if (typeof message.x === 'number' && typeof message.y === 'number') {
      const verdict = canPlace(world, message.kind, message.x, message.y);
      if (!verdict.ok) return { ok: false, reason: verdict.reason };
      spot = { x: message.x, y: message.y };
    } else {
      const spots = placeSpots(world, message.kind);
      if (spots.length === 0) return { ok: false, reason: 'full' };
      const random = createRandom(hashInts(session.id, now & 0xffff, 6));
      spot = spots[Math.floor(random() * spots.length)];
      note = 'chosen';
    }
    const thing: Thing = { id: this.nextId('thing'), kind: message.kind, x: spot.x, y: spot.y, placedAt: now };
    this.sql.exec(
      'INSERT INTO things (id, kind, x, y, placed_at) VALUES (?, ?, ?, ?, ?)',
      thing.id, thing.kind, thing.x, thing.y, thing.placedAt,
    );
    session.budgets.place -= 1;
    return { ok: true, deltas: [{ k: 'thing', thing }], note };
  }

  private chalk(message: Extract<ClientMessage, { t: 'chalk' }>, session: Session): HandleResult {
    if (session.budgets.chalk <= 0) return { ok: false, reason: 'spent' };
    const world = this.world();
    const verdict = canChalk(world, message.room, message.strokes, session.budgets.chalk);
    if (!verdict.ok) return { ok: false, reason: verdict.reason };
    const room = world.rooms.get(message.room) as Room;
    for (const [cell, colour] of verdict.strokes) room.sign[cell] = colour;
    this.sql.exec('UPDATE rooms SET sign = ? WHERE id = ?', encodeSign(room.sign), room.id);
    session.budgets.chalk -= verdict.strokes.length;
    return { ok: true, deltas: [{ k: 'chalk', room: room.id, strokes: verdict.strokes }] };
  }

  private nudge(message: Extract<ClientMessage, { t: 'nudge' }>, session: Session, now: number): HandleResult {
    if (session.budgets.nudge <= 0) return { ok: false, reason: 'spent' };
    const world = this.world();
    const creature = world.creatures.get(message.creature);
    if (!creature) return { ok: false, reason: 'creature' };
    const from = isPoint(message.from) ? message.from : { x: creature.x + 1, y: creature.y + 1 };
    const random = createRandom(hashInts(session.id, now & 0xffff, creature.id));
    const to = nudgeTarget(world, creature, from, random);
    if (!to) return { ok: false, reason: 'stuck' };
    const facing = facingFrom(creature, to);
    this.sql.exec('UPDATE creatures SET x = ?, y = ?, facing = ?, moved_at = ? WHERE id = ?', to.x, to.y, facing, now, creature.id);
    session.budgets.nudge -= 1;
    return { ok: true, deltas: [{ k: 'hop', creature: creature.id, to, facing }] };
  }

  private wave(session: Session, now: number): HandleResult {
    if (now - session.lastWaveAt < WAVE_GAP_MS) return { ok: false, reason: 'hurry' };
    session.lastWaveAt = now;
    const world = this.world();
    const rooms = [...world.rooms.values()];
    const random = createRandom(hashInts(session.id, now & 0xffff, 8));
    const room = rooms[Math.floor(random() * rooms.length)];
    const at = room ? (doorstep(world, room) ?? { x: room.x, y: room.y }) : entryPoint();
    return { ok: true, deltas: [{ k: 'wave', at }] };
  }

  /** Every connection is an arrival: a walker, worn ground, a lit window. */
  private arrive(now: number, random: () => number): Delta[] {
    const world = this.world();
    const rooms = [...world.rooms.values()];
    if (rooms.length === 0) return [];
    // Prefer rooms that have been entered least, so light spreads.
    const least = Math.min(...rooms.map((room) => room.lights));
    const quiet = rooms.filter((room) => room.lights <= least + 1);
    const room = quiet[Math.floor(random() * quiet.length)];
    const step = doorstep(world, room);
    const path = step ? findPath(world, entryPoint(), step) : [];
    const worn: Array<Point & { wear: number }> = [];
    for (const cell of path) {
      const wear = world.addWear(cell.x, cell.y);
      this.sql.exec(
        'INSERT INTO tiles (x, y, wear) VALUES (?, ?, ?) ON CONFLICT(x, y) DO UPDATE SET wear = excluded.wear',
        cell.x, cell.y, wear,
      );
      worn.push({ x: cell.x, y: cell.y, wear });
    }
    const lights = room.lights + 1;
    this.sql.exec('UPDATE rooms SET lit_at = ?, lights = ? WHERE id = ?', now, lights, room.id);
    const visits = Number(this.meta('visits') ?? 0) + 1;
    this.setMeta('visits', String(visits));
    return [
      { k: 'walker', path, room: room.id },
      { k: 'wear', tiles: worn },
      { k: 'light', room: room.id, litAt: now, lights },
      { k: 'visits', visits },
    ];
  }

  private maybeSpawnCreature(world: World, now: number, random: () => number): Delta | null {
    // One more little one for every dozen rooms, up to a small flock.
    const wanted = Math.min(MAX_CREATURES, 2 + Math.floor(world.rooms.size / 12));
    if (world.creatures.size >= wanted) return null;
    const spots: Point[] = [];
    for (const cell of world.groundRoomCells()) {
      for (const candidate of neighbours(cell.x, cell.y)) {
        if (isWalkable(world, candidate.x, candidate.y) && !world.thingAt(candidate.x, candidate.y)) spots.push(candidate);
      }
    }
    if (spots.length === 0) return null;
    const spot = spots[Math.floor(random() * spots.length)];
    const creature: Creature = { id: this.nextId('creature'), x: spot.x, y: spot.y, facing: Math.floor(random() * 4), movedAt: now };
    this.sql.exec(
      'INSERT INTO creatures (id, x, y, facing, moved_at) VALUES (?, ?, ?, ?, ?)',
      creature.id, creature.x, creature.y, creature.facing, creature.movedAt,
    );
    world.creatures.set(creature.id, creature);
    // A newly hatched creature is announced as a hop onto its first cell.
    return { k: 'hop', creature: creature.id, to: spot, facing: creature.facing };
  }

  /** Rare oddities: a window with eyes, a hum from the cave, a stranger. */
  private rollOmen(world: World, now: number, random: () => number): Omen | null | undefined {
    const current = this.currentOmen(now);
    if (current) return undefined;
    const hadOmen = this.meta('omen') !== null;
    if (hadOmen) {
      this.setMeta('omen', null);
      return null;
    }
    if (random() > 0.12) return undefined;
    const roll = random();
    let omen: Omen;
    if (roll < 0.6 && world.rooms.size > 0) {
      const rooms = [...world.rooms.values()];
      omen = { kind: 'eyes', room: rooms[Math.floor(random() * rooms.length)].id, until: now + 45 * 60 * 1000 };
    } else if (roll < 0.85) {
      omen = { kind: 'hum', until: now + 30 * 60 * 1000 };
    } else {
      omen = { kind: 'visitor', until: now + 20 * 60 * 1000 };
    }
    this.setMeta('omen', JSON.stringify(omen));
    return omen;
  }

  private currentOmen(now: number): Omen | null {
    const raw = this.meta('omen');
    if (!raw) return null;
    try {
      const omen = JSON.parse(raw) as Omen;
      return omen.until > now ? omen : null;
    } catch {
      return null;
    }
  }

  // ----- Persistence -------------------------------------------------------

  private ensureSchema(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY, x INTEGER NOT NULL, y INTEGER NOT NULL, z INTEGER NOT NULL,
        hue TEXT NOT NULL, roof TEXT NOT NULL, lit_at INTEGER NOT NULL, lights INTEGER NOT NULL, sign TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS things (
        id INTEGER PRIMARY KEY, kind TEXT NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, placed_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS creatures (
        id INTEGER PRIMARY KEY, x INTEGER NOT NULL, y INTEGER NOT NULL, facing INTEGER NOT NULL, moved_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tiles (x INTEGER NOT NULL, y INTEGER NOT NULL, wear INTEGER NOT NULL, PRIMARY KEY (x, y));
    `);
    if (this.meta('version') === null) this.seed(Date.now());
  }

  private seed(now: number): void {
    const seed = seedSnapshot(now);
    for (const room of seed.rooms) {
      this.sql.exec(
        'INSERT INTO rooms (id, x, y, z, hue, roof, lit_at, lights, sign) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        room.id, room.x, room.y, room.z, room.hue, room.roof, room.litAt, room.lights, encodeSign(room.sign),
      );
    }
    for (const thing of seed.things) {
      this.sql.exec('INSERT INTO things (id, kind, x, y, placed_at) VALUES (?, ?, ?, ?, ?)', thing.id, thing.kind, thing.x, thing.y, thing.placedAt);
    }
    for (const creature of seed.creatures) {
      this.sql.exec('INSERT INTO creatures (id, x, y, facing, moved_at) VALUES (?, ?, ?, ?, ?)', creature.id, creature.x, creature.y, creature.facing, creature.movedAt);
    }
    this.setMeta('version', String(WORLD_VERSION));
    this.setMeta('created_at', String(now));
    this.setMeta('visits', '0');
    this.setMeta('id_room', String(seed.rooms.length));
    this.setMeta('id_thing', String(seed.things.length));
    this.setMeta('id_creature', String(seed.creatures.length));
    this.setMeta('id_session', '0');
  }

  private snapshot(): Snapshot {
    const rooms = this.sql.exec<RoomRow>('SELECT * FROM rooms ORDER BY id').toArray().map(roomFromRow);
    const things = this.sql.exec<ThingRow>('SELECT * FROM things ORDER BY id').toArray().map(thingFromRow);
    const creatures = this.sql.exec<CreatureRow>('SELECT * FROM creatures ORDER BY id').toArray().map(creatureFromRow);
    const tiles = this.sql.exec<{ x: number; y: number; wear: number }>('SELECT x, y, wear FROM tiles WHERE wear > 0').toArray();
    return {
      version: WORLD_VERSION,
      createdAt: Number(this.meta('created_at') ?? 0),
      now: Date.now(),
      visits: Number(this.meta('visits') ?? 0),
      rooms,
      things,
      creatures,
      tiles,
    };
  }

  private world(): World {
    return new World(this.snapshot());
  }

  private meta(name: string): string | null {
    const row = this.sql.exec<{ value: string }>('SELECT value FROM meta WHERE key = ?', name).toArray()[0];
    return row ? row.value : null;
  }

  private setMeta(name: string, value: string | null): void {
    if (value === null) {
      this.sql.exec('DELETE FROM meta WHERE key = ?', name);
      return;
    }
    this.sql.exec('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', name, value);
  }

  private nextId(kind: 'room' | 'thing' | 'creature' | 'session'): number {
    const next = Number(this.meta(`id_${kind}`) ?? 0) + 1;
    this.setMeta(`id_${kind}`, String(next));
    return next;
  }

  private touch(now: number): void {
    this.setMeta('touched_at', String(now));
  }

  // ----- Fan-out -----------------------------------------------------------

  private reply(socket: WebSocket, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      this.sessions.delete(socket);
    }
  }

  private broadcast(ops: Delta[]): void {
    const payload = JSON.stringify({ t: 'delta', ops } satisfies ServerMessage);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        this.sessions.delete(socket);
      }
    }
  }
}

type HandleResult = { ok: true; deltas: Delta[]; note?: string } | { ok: false; reason: string };

type Env = Record<string, unknown>;

type RoomRow = {
  id: number;
  x: number;
  y: number;
  z: number;
  hue: string;
  roof: string;
  lit_at: number;
  lights: number;
  sign: string;
};
type ThingRow = {
  id: number;
  kind: string;
  x: number;
  y: number;
  placed_at: number;
};
type CreatureRow = {
  id: number;
  x: number;
  y: number;
  facing: number;
  moved_at: number;
};

function roomFromRow(row: RoomRow): Room {
  return {
    id: row.id,
    x: row.x,
    y: row.y,
    z: row.z,
    hue: row.hue as Room['hue'],
    roof: row.roof as Room['roof'],
    litAt: row.lit_at,
    lights: row.lights,
    sign: decodeSign(row.sign),
  };
}

function thingFromRow(row: ThingRow): Thing {
  return { id: row.id, kind: row.kind as ThingKind, x: row.x, y: row.y, placedAt: row.placed_at };
}

function creatureFromRow(row: CreatureRow): Creature {
  return { id: row.id, x: row.x, y: row.y, facing: row.facing, movedAt: row.moved_at };
}

/** Signs are stored as a compact digit string, one character per cell. */
function encodeSign(sign: number[]): string {
  return sign.map((cell) => String(cell)).join('');
}

function decodeSign(raw: string): number[] {
  const sign = blankSign();
  for (let index = 0; index < Math.min(raw.length, SIGN_CELLS); index += 1) {
    const value = Number(raw[index]);
    sign[index] = value === 1 || value === 2 ? value : 0;
  }
  return sign;
}

function facingFrom(from: Point, to: Point): number {
  if (to.x > from.x) return 0;
  if (to.y > from.y) return 1;
  if (to.x < from.x) return 2;
  return 3;
}

function isPoint(value: unknown): value is Point {
  return !!value && typeof value === 'object'
    && Number.isFinite((value as Point).x) && Number.isFinite((value as Point).y);
}
