/**
 * The renderer: camera, layers, picking and the frame loop. It reads the
 * View and draws; it never changes shared state.
 */
import { hashInts, unit } from '../shared/rng.ts';
import {
  type Creature,
  GRID,
  type Point,
  type Room,
  type Thing,
  type ThingKind,
  WELL,
  canBuild,
  canPlace,
  growthStage,
  CENTER,
  clearingCells,
  windowGlow,
} from '../shared/world.ts';
import {
  type Camera,
  LEVEL_H,
  TILE_H,
  TILE_W,
  canvasToWorld,
  cellAt,
  depthOf,
  pointInPolygon,
  project,
  type ScreenPoint,
  worldToCanvas,
} from './iso.ts';
import { type Clock, approach, createClock, easeOut, prefersReducedMotion, onReducedMotionChange } from './motion.ts';
import * as P from './palette.ts';
import {
  drawCave,
  drawCellHighlight,
  drawCreature,
  drawGlow,
  drawGroundCell,
  drawMoon,
  drawRoom,
  drawThing,
  drawTree,
  drawWalker,
  drawWave,
  drawWell,
  roomFaces,
  windowCentre,
  creatureScreenPosition,
} from './sprites.ts';
import { HOP_MS, PULSE_MS, WAVE_MS, type View, type Walker } from './view.ts';

export type Hover =
  | { kind: 'build'; cell: Point; z: number; ok: boolean }
  | { kind: 'place'; thing: ThingKind; cell: Point; ok: boolean }
  | { kind: 'chalk'; room: Room | null }
  | { kind: 'nudge'; creature: Creature | null }
  | null;

export type Hit =
  | { kind: 'creature'; creature: Creature }
  | { kind: 'room'; room: Room; face: 'left' | 'right' | 'top' }
  | { kind: 'cell'; cell: Point };

const MIN_ZOOM = 0.35;
/** Below this the whole clearing is too small to read; frame the settlement instead. */
const FIT_FLOOR = 0.62;
const MAX_ZOOM = 2.6;

interface SceneObject {
  depth: number;
  draw(ctx: CanvasRenderingContext2D): void;
}

export class Scene {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly view: View;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private readonly camera: Camera = { cx: 0, cy: 0, zoom: 1 };
  private readonly cameraTarget: Camera = { cx: 0, cy: 0, zoom: 1 };
  private readonly clock = createClock();
  private lastFrame = 0;
  private reduced = prefersReducedMotion();
  private running = false;
  private frameHandle = 0;
  hover: Hover = null;
  /** The cells beyond the clearing that hold trees, computed once. */
  private readonly trees: Point[] = [];
  private readonly floor: Array<Point & { fade: number }> = [];
  private cave: Point = { x: 0, y: 0 };
  /** The moon hangs in world space beyond the right-hand treeline, so it never sits over the woods. */
  private moon = { sx: 0, sy: 0, r: 40 };
  private stars: HTMLCanvasElement | null = null;
  private fog: HTMLCanvasElement | null = null;
  private grain: HTMLCanvasElement | null = null;
  private vignette: CanvasGradient | null = null;
  private readonly clearingCells: Point[] = [];

  constructor(canvas: HTMLCanvasElement, view: View) {
    this.canvas = canvas;
    this.view = view;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available.');
    this.ctx = ctx;
    this.relayout();
    onReducedMotionChange((reduced) => {
      this.reduced = reduced;
    });
    this.resize();
    this.fitToSettlement(true);
  }

  // ----- Lifecycle -----------------------------------------------------------

  start(): void {
    if (this.running) return;
    this.running = true;
    let reported = false;
    const frame = (now: number) => {
      if (!this.running) return;
      try {
        this.render(now);
      } catch (error) {
        // Keep the clearing alive; one bad frame must not end the night.
        if (!reported) {
          reported = true;
          console.error('[irrwisch] frame failed', error);
        }
      }
      this.frameHandle = requestAnimationFrame(frame);
    };
    this.frameHandle = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.stars = makeStars(this.width, this.height, this.dpr);
    this.vignette = null;
    if (!this.fog) this.fog = makeFog();
    if (!this.grain) this.grain = makeGrain();
  }

  // ----- Camera --------------------------------------------------------------

  /** Frame the whole clearing with a ring of woods around it; the settlement sits a little above centre. */
  fitToSettlement(immediate = false): void {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const cell of this.clearingCells) {
      const point = project(cell.x, cell.y);
      minX = Math.min(minX, point.sx - TILE_W / 2);
      maxX = Math.max(maxX, point.sx + TILE_W / 2);
      minY = Math.min(minY, point.sy - TILE_H / 2);
      maxY = Math.max(maxY, point.sy + TILE_H / 2);
    }
    const spanX = (maxX - minX) * 1.18;
    const spanY = (maxY - minY) * 1.35;
    let zoom = Math.min(this.width / spanX, this.height / spanY);
    const wholeClearing = zoom >= FIT_FLOOR;
    // Weight the centre toward where the rooms are, so a lopsided settlement stays in view.
    const rooms = [...this.view.world.rooms.values()];
    const focus = rooms.length > 0
      ? rooms.reduce((sum, room) => {
          const point = project(room.x, room.y, room.z);
          return { sx: sum.sx + point.sx / rooms.length, sy: sum.sy + point.sy / rooms.length };
        }, { sx: 0, sy: 0 })
      : project(WELL.x, WELL.y);
    if (wholeClearing) {
      zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
      this.cameraTarget.cx = ((minX + maxX) / 2) * 0.4 + focus.sx * 0.6;
      this.cameraTarget.cy = ((minY + maxY) / 2) * 0.4 + focus.sy * 0.6 + (this.height / zoom) * 0.06;
    } else {
      // The clearing has outgrown the screen: frame the houses and let the visitor pan to the woods.
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      let bottom = -Infinity;
      for (const room of rooms) {
        const point = project(room.x, room.y, room.z);
        left = Math.min(left, point.sx);
        right = Math.max(right, point.sx);
        top = Math.min(top, point.sy);
        bottom = Math.max(bottom, point.sy);
      }
      const settleX = right - left + TILE_W * 10;
      const settleY = bottom - top + TILE_H * 14;
      zoom = clamp(Math.min(this.width / settleX, this.height / settleY), FIT_FLOOR, 1.2);
      this.cameraTarget.cx = (left + right) / 2;
      this.cameraTarget.cy = (top + bottom) / 2 + (this.height / zoom) * 0.04;
    }
    this.cameraTarget.zoom = zoom;
    if (immediate || this.reduced) Object.assign(this.camera, this.cameraTarget);
  }

  panBy(dx: number, dy: number): void {
    this.cameraTarget.cx -= dx / this.camera.zoom;
    this.cameraTarget.cy -= dy / this.camera.zoom;
    this.clampCamera();
    this.camera.cx = this.cameraTarget.cx;
    this.camera.cy = this.cameraTarget.cy;
  }

  zoomAt(factor: number, canvasX: number, canvasY: number): void {
    const before = canvasToWorld(this.camera, { sx: canvasX, sy: canvasY }, this.width, this.height);
    const zoom = clamp(this.cameraTarget.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    this.cameraTarget.zoom = zoom;
    this.camera.zoom = zoom;
    const after = canvasToWorld(this.camera, { sx: canvasX, sy: canvasY }, this.width, this.height);
    this.cameraTarget.cx += before.sx - after.sx;
    this.cameraTarget.cy += before.sy - after.sy;
    this.clampCamera();
    this.camera.cx = this.cameraTarget.cx;
    this.camera.cy = this.cameraTarget.cy;
  }

  private clampCamera(): void {
    const corners = [project(0, 0), project(GRID, 0), project(0, GRID), project(GRID, GRID)];
    const minX = Math.min(...corners.map((c) => c.sx));
    const maxX = Math.max(...corners.map((c) => c.sx));
    const minY = Math.min(...corners.map((c) => c.sy)) - LEVEL_H * 6;
    const maxY = Math.max(...corners.map((c) => c.sy));
    this.cameraTarget.cx = clamp(this.cameraTarget.cx, minX, maxX);
    this.cameraTarget.cy = clamp(this.cameraTarget.cy, minY, maxY);
  }

  // ----- Picking -------------------------------------------------------------

  /** Convert a pointer position (CSS px within the canvas) into a world point. */
  worldAt(canvasX: number, canvasY: number): ScreenPoint {
    return canvasToWorld(this.camera, { sx: canvasX, sy: canvasY }, this.width, this.height);
  }

  hitTest(canvasX: number, canvasY: number): Hit {
    const point = this.worldAt(canvasX, canvasY);
    const now = performance.now();
    // Creatures first: they are small and sit in front of their cell.
    for (const creature of [...this.view.world.creatures.values()].reverse()) {
      const hop = this.view.hops.find((candidate) => candidate.creature === creature.id);
      const position = creatureScreenPosition(creature, {
        hop: hop ? { from: hop.from, t: easeOut((now - hop.startedAt) / HOP_MS) } : undefined,
        blink: false,
        nudgeable: false,
      });
      const dx = point.sx - position.sx;
      const dy = point.sy - (position.sy - 8);
      if (dx * dx + dy * dy <= 12 * 12) return { kind: 'creature', creature };
    }
    // Rooms, front-most first.
    const rooms = [...this.view.world.rooms.values()].sort(
      (a, b) => depthOf(b.x, b.y, b.z) - depthOf(a.x, a.y, a.z),
    );
    for (const room of rooms) {
      const faces = roomFaces(room);
      if (pointInPolygon(point, faces.top)) return { kind: 'room', room, face: 'top' };
      if (pointInPolygon(point, faces.left)) return { kind: 'room', room, face: 'left' };
      if (pointInPolygon(point, faces.right)) return { kind: 'room', room, face: 'right' };
    }
    return { kind: 'cell', cell: cellAt(point.sx, point.sy) };
  }

  /** Resolve a hover for the current mode from a pointer position. */
  hoverFor(mode: 'build' | 'place' | 'chalk' | 'nudge', canvasX: number, canvasY: number, thing?: ThingKind): Hover {
    const hit = this.hitTest(canvasX, canvasY);
    const world = this.view.world;
    switch (mode) {
      case 'build': {
        const cell = hit.kind === 'room' ? { x: hit.room.x, y: hit.room.y } : hit.kind === 'cell' ? hit.cell : null;
        if (!cell) return { kind: 'build', cell: { x: -1, y: -1 }, z: 0, ok: false };
        const verdict = canBuild(world, cell.x, cell.y);
        return { kind: 'build', cell, z: verdict.ok ? verdict.z : 0, ok: verdict.ok };
      }
      case 'place': {
        const cell = hit.kind === 'cell' ? hit.cell : hit.kind === 'room' ? { x: hit.room.x, y: hit.room.y } : null;
        if (!cell || !thing) return { kind: 'place', thing: thing ?? 'stone', cell: { x: -1, y: -1 }, ok: false };
        return { kind: 'place', thing, cell, ok: canPlace(world, thing, cell.x, cell.y).ok };
      }
      case 'chalk':
        return { kind: 'chalk', room: hit.kind === 'room' ? hit.room : null };
      case 'nudge':
        return { kind: 'nudge', creature: hit.kind === 'creature' ? hit.creature : null };
      default:
        return null;
    }
  }

  /** Where a room's window sits on the canvas, for UI anchoring. */
  anchorFor(room: Room): ScreenPoint {
    return worldToCanvas(this.camera, windowCentre(room), this.width, this.height);
  }

  // ----- Frame -----------------------------------------------------------------

  private render(nowMs: number): void {
    const clock = this.clock.tick(nowMs);
    const delta = this.lastFrame ? Math.min(0.1, (nowMs - this.lastFrame) / 1000) : 0;
    this.lastFrame = nowMs;
    this.view.sweep(nowMs);
    this.easeCamera(delta);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawSky(ctx, clock);

    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.cx, -this.camera.cy);
    drawMoon(ctx, this.moon.sx, this.moon.sy, this.moon.r, clock.seconds, this.moonShadow(clock));
    this.drawGround(ctx);
    const objects = this.collectObjects(clock, nowMs);
    objects.sort((a, b) => a.depth - b.depth);
    for (const object of objects) object.draw(ctx);
    this.drawLight(ctx, clock, nowMs);
    ctx.restore();

    this.drawFog(ctx, clock);
    this.drawGrain(ctx, clock);
    this.drawVignette(ctx);
  }

  private easeCamera(delta: number): void {
    if (this.reduced || delta === 0) {
      Object.assign(this.camera, this.cameraTarget);
      return;
    }
    this.camera.cx = approach(this.camera.cx, this.cameraTarget.cx, 6, delta);
    this.camera.cy = approach(this.camera.cy, this.cameraTarget.cy, 6, delta);
    this.camera.zoom = approach(this.camera.zoom, this.cameraTarget.zoom, 6, delta);
  }

  private visibleWorldBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const topLeft = canvasToWorld(this.camera, { sx: 0, sy: 0 }, this.width, this.height);
    const bottomRight = canvasToWorld(this.camera, { sx: this.width, sy: this.height }, this.width, this.height);
    return { minX: topLeft.sx - TILE_W, maxX: bottomRight.sx + TILE_W, minY: topLeft.sy - LEVEL_H * 4, maxY: bottomRight.sy + TILE_H * 2 };
  }

  private drawSky(ctx: CanvasRenderingContext2D, clock: Clock): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, P.SKY_TOP);
    gradient.addColorStop(0.6, P.SKY_BOTTOM);
    gradient.addColorStop(1, P.HORIZON);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    if (this.stars) {
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.stars, 0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
      // A few twinklers on the stepped clock.
      for (let index = 0; index < 14; index += 1) {
        const sx = unit(hashInts(index, 91, 1)) * this.width;
        const sy = unit(hashInts(index, 92, 1)) * this.height * 0.6;
        const phase = (clock.step + index * 5) % 24;
        const alpha = phase < 3 ? 0.9 : 0.25;
        ctx.fillStyle = `rgba(230, 236, 255, ${alpha})`;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
    }
  }

  /** 0..1 progress of a figure crossing the moon, or 0. Everyone sees it together. */
  private moonShadow(clock: Clock): number {
    const serverSeconds = this.view.now() / 1000;
    const period = 11 * 60;
    const within = serverSeconds % period;
    const visitor = this.view.omen?.kind === 'visitor';
    const window = visitor ? 40 : 18;
    if (within > window) return 0;
    if (this.reduced) return 0;
    return within / window;
  }

  private drawGround(ctx: CanvasRenderingContext2D): void {
    const bounds = this.visibleWorldBounds();
    for (const cell of this.floor) {
      const c = project(cell.x, cell.y);
      if (c.sx < bounds.minX || c.sx > bounds.maxX || c.sy < bounds.minY || c.sy > bounds.maxY) continue;
      drawGroundCell(ctx, cell.x, cell.y, 0, false, cell.fade);
    }
    for (const cell of this.clearingCells) {
      const c = project(cell.x, cell.y);
      if (c.sx < bounds.minX || c.sx > bounds.maxX || c.sy < bounds.minY || c.sy > bounds.maxY) continue;
      drawGroundCell(ctx, cell.x, cell.y, this.view.world.wearAt(cell.x, cell.y), true);
    }
    const hover = this.hover;
    if (hover && (hover.kind === 'build' || hover.kind === 'place') && hover.cell.x >= 0) {
      drawCellHighlight(ctx, hover.cell.x, hover.cell.y, 0, hover.ok);
    }
  }

  private collectObjects(clock: Clock, nowMs: number): SceneObject[] {
    const objects: SceneObject[] = [];
    const bounds = this.visibleWorldBounds();
    const world = this.view.world;
    const serverNow = this.view.now();
    const inView = (c: ScreenPoint): boolean => c.sx >= bounds.minX && c.sx <= bounds.maxX && c.sy >= bounds.minY && c.sy <= bounds.maxY;

    for (const cell of this.trees) {
      const c = project(cell.x, cell.y);
      if (!inView(c)) continue;
      objects.push({ depth: depthOf(cell.x, cell.y, 0, 5), draw: (ctx) => drawTree(ctx, cell.x, cell.y) });
    }
    objects.push({ depth: depthOf(WELL.x, WELL.y, 0, 3), draw: (ctx) => drawWell(ctx, WELL.x, WELL.y) });
    const hum = this.view.omen?.kind === 'hum' ? 0.5 + 0.5 * Math.sin(clock.seconds * 1.7) : 0;
    objects.push({ depth: depthOf(this.cave.x, this.cave.y, 0, 1), draw: (ctx) => drawCave(ctx, this.cave.x, this.cave.y, hum) });

    const eyesRoom = this.view.omen?.kind === 'eyes' ? this.view.omen.room : undefined;
    for (const room of world.rooms.values()) {
      const c = project(room.x, room.y, room.z);
      if (!inView(c)) continue;
      const pulse = this.view.pulses.find((p) => (p.kind === 'room' || p.kind === 'chalk') && p.at.x === room.x && p.at.y === room.y && p.z === room.z);
      objects.push({
        depth: depthOf(room.x, room.y, room.z, 4),
        draw: (ctx) => drawRoom(ctx, room, {
          glow: windowGlow(room, serverNow),
          eyes: eyesRoom === room.id,
          pulse: pulse ? (nowMs - pulse.startedAt) / PULSE_MS : undefined,
        }),
      });
    }

    for (const thing of world.things.values()) {
      const c = project(thing.x, thing.y);
      if (!inView(c)) continue;
      const pulse = this.view.pulses.find((p) => p.kind === 'thing' && p.at.x === thing.x && p.at.y === thing.y);
      objects.push({
        depth: depthOf(thing.x, thing.y, 0, 3),
        draw: (ctx) => drawThing(ctx, thing, {
          stage: growthStage(thing, serverNow),
          pulse: pulse ? (nowMs - pulse.startedAt) / PULSE_MS : undefined,
        }),
      });
    }

    for (const creature of world.creatures.values()) {
      const hop = this.view.hops.find((candidate) => candidate.creature === creature.id);
      const hopT = hop ? easeOut((nowMs - hop.startedAt) / HOP_MS) : undefined;
      const blink = (clock.step + creature.id * 11) % 44 < 2;
      const nudgeable = this.hover?.kind === 'nudge' && this.hover.creature?.id === creature.id;
      const depthCell = hop && hopT !== undefined && hopT < 0.5 ? hop.from : { x: creature.x, y: creature.y };
      objects.push({
        depth: depthOf(depthCell.x, depthCell.y, 0, 6),
        draw: (ctx) => drawCreature(ctx, creature, {
          hop: hop && hopT !== undefined ? { from: hop.from, t: this.reduced ? 1 : hopT } : undefined,
          blink,
          nudgeable,
        }),
      });
    }

    for (const walker of this.view.walkers) {
      const look = this.walkerLook(walker, clock, nowMs);
      if (!look) continue;
      objects.push({ depth: depthOf(look.cell.x, look.cell.y, 0, 7), draw: (ctx) => drawWalker(ctx, look) });
    }

    for (const wave of this.view.waves) {
      const t = (nowMs - wave.startedAt) / WAVE_MS;
      objects.push({ depth: depthOf(wave.at.x, wave.at.y, 0, 8), draw: (ctx) => drawWave(ctx, wave.at, t) });
    }

    const hover = this.hover;
    if (hover?.kind === 'build' && hover.ok) {
      const ghost: Room = { id: -1, x: hover.cell.x, y: hover.cell.y, z: hover.z, hue: 'ochre', roof: 'pitched', litAt: 0, lights: 0, sign: [] };
      objects.push({ depth: depthOf(ghost.x, ghost.y, ghost.z, 4), draw: (ctx) => drawRoom(ctx, ghost, { glow: 0, eyes: false, ghost: true }) });
    }
    if (hover?.kind === 'place' && hover.ok) {
      const ghost: Thing = { id: -1, kind: hover.thing, x: hover.cell.x, y: hover.cell.y, placedAt: serverNow };
      objects.push({ depth: depthOf(ghost.x, ghost.y, 0, 3), draw: (ctx) => drawThing(ctx, ghost, { stage: 0, ghost: true }) });
    }
    return objects;
  }

  private walkerLook(walker: Walker, clock: Clock, nowMs: number): (Parameters<typeof drawWalker>[1] & { cell: Point }) | null {
    const path = walker.path;
    if (path.length === 0) return null;
    const totalWalk = (path.length - 1) * walker.pace;
    // Frame timestamps can trail performance.now() by a few ms; never walk backwards.
    const elapsedRaw = Math.max(0, nowMs - walker.startedAt);
    const elapsed = this.reduced ? totalWalk : Math.floor(elapsedRaw / 125) * 125;
    if (elapsed >= totalWalk) {
      const end = path[path.length - 1];
      const fade = this.reduced ? Math.max(0, 1 - elapsedRaw / 900) : Math.max(0, 1 - (elapsedRaw - totalWalk) / 800);
      if (fade <= 0) return null;
      const position = project(end.x, end.y);
      return { position, facingRight: true, stepParity: 0, fade, cell: end };
    }
    const index = Math.min(path.length - 2, Math.floor(elapsed / walker.pace));
    const t = (elapsed - index * walker.pace) / walker.pace;
    const from = project(path[index].x, path[index].y);
    const to = project(path[index + 1].x, path[index + 1].y);
    const position = { sx: from.sx + (to.sx - from.sx) * t, sy: from.sy + (to.sy - from.sy) * t - Math.abs(Math.sin(t * Math.PI)) * 1.2 };
    return {
      position,
      facingRight: to.sx >= from.sx,
      stepParity: clock.step % 2,
      fade: Math.min(1, elapsedRaw / 300),
      cell: path[index + 1],
    };
  }

  private drawLight(ctx: CanvasRenderingContext2D, clock: Clock, nowMs: number): void {
    const bounds = this.visibleWorldBounds();
    const serverNow = this.view.now();
    const flicker = (seed: number): number => 0.92 + unit(hashInts(clock.step, seed, 3)) * 0.16;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Many lit windows side by side would add up to a white blur; share the light out as the place grows.
    const crowd = Math.min(1, 3.4 / Math.sqrt(Math.max(1, this.view.world.rooms.size)));
    for (const room of this.view.world.rooms.values()) {
      const glow = windowGlow(room, serverNow);
      if (glow <= 0) continue;
      const w = windowCentre(room);
      if (w.sx < bounds.minX || w.sx > bounds.maxX || w.sy < bounds.minY || w.sy > bounds.maxY) continue;
      drawGlow(ctx, w.sx + 1, w.sy, 34 + glow * 14, 0.22 * glow * crowd * (this.reduced ? 1 : flicker(room.id)));
    }
    for (const thing of this.view.world.things.values()) {
      const c = project(thing.x, thing.y);
      if (c.sx < bounds.minX || c.sx > bounds.maxX || c.sy < bounds.minY || c.sy > bounds.maxY) continue;
      if (thing.kind === 'lantern') drawGlow(ctx, c.sx, c.sy - 20, 54, 0.32 * (this.reduced ? 1 : flicker(thing.id)));
      if (thing.kind === 'pumpkin') drawGlow(ctx, c.sx, c.sy - 5, 30, 0.26 * (this.reduced ? 1 : flicker(thing.id + 500)), '255, 120, 40');
      if (thing.kind === 'mushroom') drawGlow(ctx, c.sx, c.sy - 6, 16, 0.12, '255, 150, 150');
    }
    for (const walker of this.view.walkers) {
      const look = this.walkerLook(walker, clock, nowMs);
      if (!look) continue;
      drawGlow(ctx, look.position.sx + (look.facingRight ? 7 : -7), look.position.sy - 7, 30, 0.3 * look.fade);
    }
    for (const pulse of this.view.pulses) {
      if (pulse.kind !== 'light') continue;
      const room = this.view.world.rooms.get(-1) ?? [...this.view.world.rooms.values()].find((r) => r.x === pulse.at.x && r.y === pulse.at.y && r.z === pulse.z);
      if (!room) continue;
      const t = (nowMs - pulse.startedAt) / PULSE_MS;
      const w = windowCentre(room);
      drawGlow(ctx, w.sx, w.sy, 60 + t * 40, 0.4 * (1 - t));
    }
    if (this.view.omen?.kind === 'hum') {
      const c = project(this.cave.x, this.cave.y);
      drawGlow(ctx, c.sx, c.sy - 4, 40, 0.18 + 0.1 * Math.sin(clock.seconds * 1.7));
    }
    ctx.restore();
  }

  private drawFog(ctx: CanvasRenderingContext2D, clock: Clock): void {
    if (!this.fog) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const drift = this.reduced ? 0 : clock.seconds;
    const layers = [
      { alpha: 0.09, speed: 7, scale: 1.7, offsetY: this.height * 0.3 },
      { alpha: 0.06, speed: -4, scale: 2.6, offsetY: this.height * 0.45 },
    ];
    for (const layer of layers) {
      const w = this.fog.width * layer.scale;
      const h = this.fog.height * layer.scale;
      const shift = ((drift * layer.speed) % w + w) % w;
      ctx.globalAlpha = layer.alpha;
      for (let x = -w + shift; x < this.width + w; x += w) {
        ctx.drawImage(this.fog, x - w, layer.offsetY, w, h);
      }
    }
    ctx.restore();
  }

  private drawGrain(ctx: CanvasRenderingContext2D, clock: Clock): void {
    if (!this.grain) return;
    const pattern = ctx.createPattern(this.grain, 'repeat');
    if (!pattern) return;
    ctx.save();
    ctx.globalAlpha = 0.05;
    const offset = this.reduced ? 0 : (clock.step % 7) * 13;
    ctx.translate(-offset, -offset);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, this.width + offset, this.height + offset);
    ctx.restore();
  }

  private drawVignette(ctx: CanvasRenderingContext2D): void {
    if (!this.vignette) {
      const radius = Math.hypot(this.width, this.height) * 0.6;
      this.vignette = ctx.createRadialGradient(this.width / 2, this.height / 2, radius * 0.35, this.width / 2, this.height / 2, radius);
      this.vignette.addColorStop(0, 'rgba(0,0,0,0)');
      this.vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    }
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  // ----- Static layout ----------------------------------------------------------

  /** Recompute the clearing, the forest ring, the cave and the moon; called at start and whenever the woods recede. */
  relayout(): void {
    const growth = this.view.world.growth;
    this.clearingCells.length = 0;
    this.floor.length = 0;
    this.trees.length = 0;
    let cave: Point = { x: CENTER.x, y: CENTER.y };
    let caveScore = Infinity;
    const clearing = new Set<string>();
    for (const cell of clearingCells(growth)) {
      clearing.add(`${cell.x},${cell.y}`);
      this.clearingCells.push(cell);
    }
    const reach = 13 + growth + 10;
    for (let x = CENTER.x - reach; x <= CENTER.x + reach; x += 1) {
      for (let y = CENTER.y - reach; y <= CENTER.y + reach; y += 1) {
        if (clearing.has(`${x},${y}`)) continue;
        let ring = Infinity;
        for (let dx = -9; dx <= 9 && ring > 1; dx += 1) {
          for (let dy = -9; dy <= 9; dy += 1) {
            if (clearing.has(`${x + dx},${y + dy}`)) ring = Math.min(ring, Math.max(Math.abs(dx), Math.abs(dy)));
          }
        }
        if (ring > 9) continue;
        this.floor.push({ x, y, fade: ring <= 5 ? 0 : (ring - 5) / 4 });
        const chance = ring === 1 ? 0.8 : ring <= 3 ? 0.62 : ring <= 5 ? 0.3 : 0;
        if (unit(hashInts(x, y, 51)) < chance) this.trees.push({ x, y });
        if (ring === 1) {
          const score = x + y + unit(hashInts(x, y, 52)) * 2;
          if (score < caveScore) {
            caveScore = score;
            cave = { x, y };
          }
        }
      }
    }
    // The cave mouth sits where the forest meets the clearing at the back; no tree grows in it.
    for (let index = this.trees.length - 1; index >= 0; index -= 1) {
      const tree = this.trees[index];
      if (Math.abs(tree.x - cave.x) <= 1 && Math.abs(tree.y - cave.y) <= 1) this.trees.splice(index, 1);
    }
    this.cave = cave;
    const centre = project(CENTER.x, CENTER.y);
    const radius = 10.5 + growth;
    this.moon = { sx: centre.sx + (radius + 12) * (TILE_W / 2), sy: centre.sy - (radius + 6) * (TILE_H / 2), r: 40 };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function makeStars(width: number, height: number, dpr: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(dpr, dpr);
  const count = Math.round((width * height) / 5200);
  for (let index = 0; index < count; index += 1) {
    const sx = unit(hashInts(index, 61, 7)) * width;
    const sy = unit(hashInts(index, 62, 7)) ** 1.6 * height * 0.85;
    const size = 0.4 + unit(hashInts(index, 63, 7)) * 1.1;
    const alpha = 0.25 + unit(hashInts(index, 64, 7)) * 0.6;
    ctx.fillStyle = `rgba(226, 232, 250, ${alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, size, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

function makeFog(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  for (let index = 0; index < 18; index += 1) {
    const x = unit(hashInts(index, 71, 2)) * 512;
    const y = 120 + unit(hashInts(index, 72, 2)) * 80;
    const rx = 60 + unit(hashInts(index, 73, 2)) * 110;
    const ry = 18 + unit(hashInts(index, 74, 2)) * 34;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, rx);
    gradient.addColorStop(0, 'rgba(165, 180, 205, 0.42)');
    gradient.addColorStop(1, 'rgba(165, 180, 205, 0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.translate(-x, -y);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Wrap the horizontal seam by blending the left strip onto the right edge.
  ctx.globalAlpha = 0.5;
  ctx.drawImage(canvas, 0, 0, 128, 320, 512 - 128, 0, 128, 320);
  return canvas;
}

function makeGrain(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const image = ctx.createImageData(160, 160);
  for (let index = 0; index < image.data.length; index += 4) {
    const value = 90 + unit(hashInts(index, 81, 4)) * 130;
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
