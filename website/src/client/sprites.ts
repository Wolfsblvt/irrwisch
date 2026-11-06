/**
 * Everything in the clearing is drawn in code. These functions take a
 * context already transformed into world space (see scene.ts) and draw one
 * object at its cell. The look is a miniature: slightly loose proportions,
 * flat faces, one warm colour.
 */
import { hashInts, unit } from '../shared/rng.ts';
import {
  CHALK_EMBER,
  CHALK_WHITE,
  type Creature,
  type Room,
  SIGN_SIZE,
  type Thing,
  type Point,
} from '../shared/world.ts';
import { LEVEL_H, TILE_H, TILE_W, project, type ScreenPoint } from './iso.ts';
import * as P from './palette.ts';

const BLOCK_INSET = 0.86;
const ROOF_H = 13;

type Ctx = CanvasRenderingContext2D;

function polygon(ctx: Ctx, points: ScreenPoint[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0].sx, points[0].sy);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].sx, points[index].sy);
  ctx.closePath();
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Parse '#rrggbb' or 'rgb(r,g,b)' into channels, so mixes can be nested. */
function channels(colour: string): [number, number, number] {
  if (colour.startsWith('#')) {
    const value = parseInt(colour.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }
  const parts = colour.match(/\d+/g) ?? ['0', '0', '0'];
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

function mix(colourA: string, colourB: string, t: number): string {
  const a = channels(colourA);
  const b = channels(colourB);
  const r = Math.round(lerp(a[0], b[0], t));
  const g = Math.round(lerp(a[1], b[1], t));
  const bl = Math.round(lerp(a[2], b[2], t));
  return `rgb(${r},${g},${bl})`;
}

function shade(hex: string, amount: number): string {
  return amount >= 0 ? mix(hex, '#ffffff', amount) : mix(hex, '#000000', -amount);
}

// ----- Ground -------------------------------------------------------------

export function drawGroundCell(ctx: Ctx, x: number, y: number, wear: number, inClearing: boolean, fade = 0): void {
  const c = project(x, y);
  const noise = unit(hashInts(x, y, 11));
  // Soft mottling: average the cell with its neighbours so the ground does not read as a chessboard.
  const soft = (noise + unit(hashInts(x + 1, y, 11)) + unit(hashInts(x, y + 1, 11)) + unit(hashInts(x + 1, y + 1, 11))) / 4;
  let fill: string;
  if (inClearing) {
    const worn = Math.min(1, wear / 10);
    fill = mix(shade(P.GROUND, (soft - 0.5) * 0.1), P.GROUND_WORN, worn);
  } else {
    fill = mix(shade(P.FOREST_FLOOR, (noise - 0.5) * 0.1), P.SKY_BOTTOM, Math.min(1, fade));
  }
  ctx.fillStyle = fill;
  // Overdraw by a hair so adjacent diamonds leave no antialiased seam.
  const hw = TILE_W / 2 + 0.6;
  const hh = TILE_H / 2 + 0.3;
  polygon(ctx, [
    { sx: c.sx, sy: c.sy - hh },
    { sx: c.sx + hw, sy: c.sy },
    { sx: c.sx, sy: c.sy + hh },
    { sx: c.sx - hw, sy: c.sy },
  ]);
  ctx.fill();
  if (inClearing && wear < 2 && noise > 0.9) {
    // A pebble or two.
    ctx.fillStyle = shade(P.GROUND, 0.18);
    ctx.beginPath();
    ctx.ellipse(c.sx + (noise - 0.95) * 200, c.sy + 3, 1.8, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (inClearing && wear < 3 && noise > 0.74) {
    // A tuft of grass, a few faint strokes.
    ctx.strokeStyle = shade(P.GROUND, 0.1);
    ctx.lineWidth = 0.8;
    const gx = c.sx + (noise - 0.5) * 20;
    const gy = c.sy + (unit(hashInts(x, y, 12)) - 0.5) * 8;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx - 1.2, gy - 2.6);
    ctx.moveTo(gx + 0.8, gy);
    ctx.lineTo(gx + 1.4, gy - 3.2);
    ctx.moveTo(gx + 1.6, gy);
    ctx.lineTo(gx + 2.8, gy - 2);
    ctx.stroke();
  }
  if (inClearing && wear >= 3) {
    // Footprints: little paired dents along the worn ground.
    ctx.fillStyle = shade(P.GROUND_WORN, -0.25);
    const count = Math.min(3, Math.floor(wear / 4) + 1);
    for (let index = 0; index < count; index += 1) {
      const jitter = unit(hashInts(x, y, 20 + index));
      const px = c.sx + (jitter - 0.5) * 18;
      const py = c.sy + (unit(hashInts(x, y, 30 + index)) - 0.5) * 7;
      ctx.beginPath();
      ctx.ellipse(px, py, 1.6, 1, 0, 0, Math.PI * 2);
      ctx.ellipse(px + 3, py - 1.5, 1.6, 1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawCellHighlight(ctx: Ctx, x: number, y: number, z: number, ok: boolean): void {
  const c = project(x, y, z);
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = ok ? 'rgba(255, 176, 103, 0.95)' : 'rgba(255, 110, 110, 0.8)';
  ctx.fillStyle = ok ? 'rgba(255, 176, 103, 0.14)' : 'rgba(255, 110, 110, 0.08)';
  polygon(ctx, [
    { sx: c.sx, sy: c.sy - TILE_H / 2 },
    { sx: c.sx + TILE_W / 2, sy: c.sy },
    { sx: c.sx, sy: c.sy + TILE_H / 2 },
    { sx: c.sx - TILE_W / 2, sy: c.sy },
  ]);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ----- Rooms ----------------------------------------------------------------

interface BlockCorners {
  n: ScreenPoint;
  e: ScreenPoint;
  s: ScreenPoint;
  w: ScreenPoint;
  nu: ScreenPoint;
  eu: ScreenPoint;
  su: ScreenPoint;
  wu: ScreenPoint;
}

export function blockCorners(x: number, y: number, z: number, inset = BLOCK_INSET): BlockCorners {
  const c = project(x, y, z);
  const hw = (TILE_W / 2) * inset;
  const hh = (TILE_H / 2) * inset;
  const n = { sx: c.sx, sy: c.sy - hh };
  const e = { sx: c.sx + hw, sy: c.sy };
  const s = { sx: c.sx, sy: c.sy + hh };
  const w = { sx: c.sx - hw, sy: c.sy };
  const up = (p: ScreenPoint): ScreenPoint => ({ sx: p.sx, sy: p.sy - LEVEL_H });
  return { n, e, s, w, nu: up(n), eu: up(e), su: up(s), wu: up(w) };
}

/** The visible faces of a room, for hit testing. */
export function roomFaces(room: Room): { left: ScreenPoint[]; right: ScreenPoint[]; top: ScreenPoint[] } {
  const b = blockCorners(room.x, room.y, room.z);
  return {
    left: [b.w, b.s, b.su, b.wu],
    right: [b.s, b.e, b.eu, b.su],
    top: [b.nu, b.eu, { sx: b.su.sx, sy: b.su.sy - ROOF_H }, b.wu],
  };
}

export interface RoomLook {
  glow: number;
  eyes: boolean;
  ghost?: boolean;
  pulse?: number;
}

export function drawRoom(ctx: Ctx, room: Room, look: RoomLook): void {
  const faces = P.ROOM_FACES[room.hue];
  const b = blockCorners(room.x, room.y, room.z);
  ctx.save();
  if (look.ghost) ctx.globalAlpha = 0.55;
  if (look.pulse !== undefined) {
    const scale = 1 + Math.sin(look.pulse * Math.PI) * 0.06;
    const centre = project(room.x, room.y, room.z);
    ctx.translate(centre.sx, centre.sy);
    ctx.scale(scale, scale);
    ctx.translate(-centre.sx, -centre.sy);
  }

  // Walls.
  ctx.fillStyle = faces.left;
  polygon(ctx, [b.w, b.s, b.su, b.wu]);
  ctx.fill();
  ctx.fillStyle = faces.right;
  polygon(ctx, [b.s, b.e, b.eu, b.su]);
  ctx.fill();
  // A faint seam where the faces meet.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(b.s.sx, b.s.sy);
  ctx.lineTo(b.su.sx, b.su.sy);
  ctx.stroke();

  drawDoorAndSlate(ctx, room, b, faces.left);
  drawWindow(ctx, b, look.glow, look.eyes, faces.right);
  drawRoof(ctx, room, b, faces);
  ctx.restore();
}

function faceTransform(ctx: Ctx, origin: ScreenPoint, u: ScreenPoint, v: ScreenPoint): void {
  ctx.transform(u.sx, u.sy, v.sx, v.sy, origin.sx, origin.sy);
}

function drawDoorAndSlate(ctx: Ctx, room: Room, b: BlockCorners, wall: string): void {
  // Left face basis: origin w, u along the bottom edge to s, v straight up.
  const u = { sx: b.s.sx - b.w.sx, sy: b.s.sy - b.w.sy };
  const v = { sx: 0, sy: b.wu.sy - b.w.sy };
  ctx.save();
  faceTransform(ctx, b.w, u, v);
  if (room.z === 0) {
    ctx.fillStyle = shade(wall, -0.55);
    ctx.fillRect(0.56, 0.02, 0.26, 0.52);
    ctx.fillStyle = shade(wall, -0.3);
    ctx.fillRect(0.6, 0.06, 0.18, 0.44);
    // A door knob.
    ctx.fillStyle = P.LANTERN;
    ctx.fillRect(0.73, 0.28, 0.03, 0.04);
  }
  // The slate: a dark square with the chalk cells.
  const slateX = room.z === 0 ? 0.1 : 0.25;
  const slateY = room.z === 0 ? 0.36 : 0.28;
  const slateSize = 0.42;
  ctx.fillStyle = P.SLATE_EDGE;
  ctx.fillRect(slateX - 0.03, slateY - 0.03, slateSize + 0.06, slateSize + 0.06);
  ctx.fillStyle = P.SLATE;
  ctx.fillRect(slateX, slateY, slateSize, slateSize);
  const cell = slateSize / SIGN_SIZE;
  for (let index = 0; index < room.sign.length; index += 1) {
    const value = room.sign[index];
    if (value !== CHALK_WHITE && value !== CHALK_EMBER) continue;
    const column = index % SIGN_SIZE;
    const row = Math.floor(index / SIGN_SIZE);
    ctx.fillStyle = value === CHALK_WHITE ? P.CHALK : P.EMBER;
    ctx.fillRect(slateX + column * cell + cell * 0.08, slateY + slateSize - (row + 1) * cell + cell * 0.08, cell * 0.84, cell * 0.84);
  }
  ctx.restore();
}

export function windowCentre(room: Room): ScreenPoint {
  const b = blockCorners(room.x, room.y, room.z);
  return {
    sx: (b.s.sx + b.e.sx) / 2,
    sy: (b.s.sy + b.e.sy) / 2 - LEVEL_H * 0.55,
  };
}

function drawWindow(ctx: Ctx, b: BlockCorners, glow: number, eyes: boolean, wall: string): void {
  const u = { sx: b.e.sx - b.s.sx, sy: b.e.sy - b.s.sy };
  const v = { sx: 0, sy: b.su.sy - b.s.sy };
  ctx.save();
  faceTransform(ctx, b.s, u, v);
  ctx.fillStyle = shade(wall, -0.5);
  ctx.fillRect(0.34, 0.36, 0.32, 0.36);
  const pane = glow > 0 ? mix('#1a1410', P.LANTERN, Math.min(1, glow * 0.95)) : '#15131a';
  ctx.fillStyle = pane;
  ctx.fillRect(0.38, 0.4, 0.24, 0.28);
  // Mullions.
  ctx.fillStyle = shade(wall, -0.5);
  ctx.fillRect(0.495, 0.4, 0.014, 0.28);
  ctx.fillRect(0.38, 0.535, 0.24, 0.012);
  if (eyes) {
    ctx.fillStyle = P.PUPIL;
    ctx.beginPath();
    ctx.ellipse(0.45, 0.5, 0.025, 0.045, 0, 0, Math.PI * 2);
    ctx.ellipse(0.55, 0.5, 0.025, 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRoof(ctx: Ctx, room: Room, b: BlockCorners, faces: (typeof P.ROOM_FACES)['ochre']): void {
  const grow = (p: ScreenPoint, centre: ScreenPoint, factor: number): ScreenPoint => ({
    sx: centre.sx + (p.sx - centre.sx) * factor,
    sy: centre.sy + (p.sy - centre.sy) * factor,
  });
  const centre = { sx: (b.nu.sx + b.su.sx) / 2, sy: (b.nu.sy + b.su.sy) / 2 };
  const overhang = 1.1;
  const n = grow(b.nu, centre, overhang);
  const e = grow(b.eu, centre, overhang);
  const s = grow(b.su, centre, overhang);
  const w = grow(b.wu, centre, overhang);
  const chimney = unit(hashInts(room.x, room.y, room.z + 77)) > 0.6;

  if (room.roof === 'flat') {
    ctx.fillStyle = faces.top;
    polygon(ctx, [b.nu, b.eu, b.su, b.wu]);
    ctx.fill();
    ctx.fillStyle = faces.roofShade;
    polygon(ctx, [b.wu, b.su, { sx: b.su.sx, sy: b.su.sy - 3 }, { sx: b.wu.sx, sy: b.wu.sy - 3 }]);
    ctx.fill();
    polygon(ctx, [b.su, b.eu, { sx: b.eu.sx, sy: b.eu.sy - 3 }, { sx: b.su.sx, sy: b.su.sy - 3 }]);
    ctx.fill();
    ctx.fillStyle = faces.roof;
    polygon(ctx, [
      { sx: b.nu.sx, sy: b.nu.sy - 3 },
      { sx: b.eu.sx, sy: b.eu.sy - 3 },
      { sx: b.su.sx, sy: b.su.sy - 3 },
      { sx: b.wu.sx, sy: b.wu.sy - 3 },
    ]);
    ctx.fill();
  } else if (room.roof === 'hip') {
    const ridgeW = { sx: lerp(w.sx, centre.sx, 0.35), sy: w.sy - ROOF_H };
    const ridgeE = { sx: lerp(e.sx, centre.sx, 0.35), sy: e.sy - ROOF_H };
    ctx.fillStyle = faces.roofShade;
    polygon(ctx, [w, n, e, ridgeE, ridgeW]);
    ctx.fill();
    ctx.fillStyle = faces.roof;
    polygon(ctx, [w, s, e, ridgeE, ridgeW]);
    ctx.fill();
    ctx.strokeStyle = shade(faces.roof, 0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ridgeW.sx, ridgeW.sy);
    ctx.lineTo(ridgeE.sx, ridgeE.sy);
    ctx.stroke();
  } else {
    const ridgeN = { sx: n.sx, sy: n.sy - ROOF_H };
    const ridgeS = { sx: s.sx, sy: s.sy - ROOF_H };
    ctx.fillStyle = faces.roofShade;
    polygon(ctx, [n, w, s, ridgeS, ridgeN]);
    ctx.fill();
    ctx.fillStyle = shade(faces.roof, 0.08);
    polygon(ctx, [n, e, s, ridgeS, ridgeN]);
    ctx.fill();
    ctx.strokeStyle = shade(faces.roof, 0.22);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ridgeN.sx, ridgeN.sy);
    ctx.lineTo(ridgeS.sx, ridgeS.sy);
    ctx.stroke();
  }

  if (chimney) {
    const cx = centre.sx + 7;
    const cy = centre.sy - ROOF_H - 2;
    ctx.fillStyle = P.STONE_DARK;
    ctx.fillRect(cx - 2.5, cy - 7, 5, 9);
    ctx.fillStyle = P.STONE;
    ctx.fillRect(cx - 3, cy - 8, 6, 2);
  }
}

// ----- Things ---------------------------------------------------------------

export interface ThingLook {
  stage: number;
  pulse?: number;
  ghost?: boolean;
}

export function drawThing(ctx: Ctx, thing: Thing, look: ThingLook): void {
  const c = project(thing.x, thing.y);
  ctx.save();
  if (look.ghost) ctx.globalAlpha = 0.6;
  if (look.pulse !== undefined) {
    const scale = 1 + Math.sin(look.pulse * Math.PI) * 0.18;
    ctx.translate(c.sx, c.sy);
    ctx.scale(scale, scale);
    ctx.translate(-c.sx, -c.sy);
  }
  switch (thing.kind) {
    case 'lantern':
      drawLantern(ctx, c);
      break;
    case 'sapling':
      drawSapling(ctx, c, look.stage, thing.id);
      break;
    case 'mushroom':
      drawMushroom(ctx, c, thing.id);
      break;
    case 'stone':
      drawStone(ctx, c, thing.id);
      break;
    case 'pumpkin':
      drawPumpkin(ctx, c);
      break;
    case 'bones':
      drawBones(ctx, c);
      break;
    case 'scarecrow':
      drawScarecrow(ctx, c);
      break;
    default:
      break;
  }
  ctx.restore();
}

function drawLantern(ctx: Ctx, c: ScreenPoint): void {
  ctx.fillStyle = P.WOOD_DARK;
  ctx.fillRect(c.sx - 1, c.sy - 20, 2, 20);
  ctx.fillRect(c.sx - 4, c.sy - 1, 8, 2);
  ctx.fillStyle = P.STONE_DARK;
  ctx.fillRect(c.sx - 4, c.sy - 24, 8, 2);
  ctx.fillRect(c.sx - 3.5, c.sy - 23, 7, 7);
  ctx.fillStyle = P.LANTERN;
  ctx.fillRect(c.sx - 2.5, c.sy - 22, 5, 5);
}

function drawSapling(ctx: Ctx, c: ScreenPoint, stage: number, id: number): void {
  const lean = (unit(hashInts(id, 1, 1)) - 0.5) * 3;
  if (stage === 0) {
    ctx.strokeStyle = P.LEAF;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(c.sx, c.sy);
    ctx.lineTo(c.sx + lean, c.sy - 6);
    ctx.stroke();
    ctx.fillStyle = P.LEAF;
    ctx.beginPath();
    ctx.ellipse(c.sx + lean - 2.5, c.sy - 5, 2.6, 1.4, -0.5, 0, Math.PI * 2);
    ctx.ellipse(c.sx + lean + 2.5, c.sy - 7, 2.6, 1.4, 0.5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const size = stage === 1 ? 7 : stage === 2 ? 11 : 15;
  const trunk = stage === 1 ? 3 : stage === 2 ? 8 : 13;
  ctx.fillStyle = P.TRUNK;
  ctx.fillRect(c.sx - 1.2, c.sy - trunk, 2.4, trunk);
  ctx.fillStyle = P.LEAF_DARK;
  ctx.beginPath();
  ctx.ellipse(c.sx + lean, c.sy - trunk - size * 0.6, size, size * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.LEAF;
  ctx.beginPath();
  ctx.ellipse(c.sx + lean - size * 0.25, c.sy - trunk - size * 0.75, size * 0.65, size * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMushroom(ctx: Ctx, c: ScreenPoint, id: number): void {
  const tilt = (unit(hashInts(id, 2, 2)) - 0.5) * 0.4;
  ctx.fillStyle = P.MUSHROOM_STEM;
  ctx.fillRect(c.sx - 1.5, c.sy - 7, 3, 7);
  ctx.fillStyle = P.MUSHROOM;
  ctx.beginPath();
  ctx.ellipse(c.sx, c.sy - 7, 6, 4, tilt, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.CHALK;
  ctx.beginPath();
  ctx.arc(c.sx - 2, c.sy - 9, 0.9, 0, Math.PI * 2);
  ctx.arc(c.sx + 2.5, c.sy - 8.5, 0.7, 0, Math.PI * 2);
  ctx.fill();
  // A smaller sibling.
  ctx.fillStyle = P.MUSHROOM_STEM;
  ctx.fillRect(c.sx + 5, c.sy - 3, 2, 3);
  ctx.fillStyle = P.MUSHROOM;
  ctx.beginPath();
  ctx.ellipse(c.sx + 6, c.sy - 3, 3.2, 2.2, 0, Math.PI, Math.PI * 2);
  ctx.fill();
}

function drawStone(ctx: Ctx, c: ScreenPoint, id: number): void {
  const w = 7 + unit(hashInts(id, 3, 3)) * 5;
  ctx.fillStyle = P.STONE_DARK;
  ctx.beginPath();
  ctx.ellipse(c.sx, c.sy - 2, w, w * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.STONE;
  ctx.beginPath();
  ctx.ellipse(c.sx - w * 0.2, c.sy - 3.5, w * 0.6, w * 0.32, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawPumpkin(ctx: Ctx, c: ScreenPoint): void {
  ctx.fillStyle = P.PUMPKIN_DARK;
  ctx.beginPath();
  ctx.ellipse(c.sx, c.sy - 5, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.PUMPKIN;
  ctx.beginPath();
  ctx.ellipse(c.sx - 3, c.sy - 5, 4, 6.5, 0, 0, Math.PI * 2);
  ctx.ellipse(c.sx + 3, c.sy - 5, 4, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.LEAF_DARK;
  ctx.fillRect(c.sx - 1, c.sy - 14, 2, 3);
  // The carved face glows from inside.
  ctx.fillStyle = P.EMBER;
  ctx.beginPath();
  ctx.moveTo(c.sx - 5, c.sy - 5);
  ctx.lineTo(c.sx - 2, c.sy - 5);
  ctx.lineTo(c.sx - 3.5, c.sy - 8);
  ctx.closePath();
  ctx.moveTo(c.sx + 5, c.sy - 5);
  ctx.lineTo(c.sx + 2, c.sy - 5);
  ctx.lineTo(c.sx + 3.5, c.sy - 8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(c.sx - 4, c.sy - 2);
  ctx.lineTo(c.sx - 2, c.sy);
  ctx.lineTo(c.sx, c.sy - 2);
  ctx.lineTo(c.sx + 2, c.sy);
  ctx.lineTo(c.sx + 4, c.sy - 2);
  ctx.lineTo(c.sx + 4, c.sy - 1);
  ctx.lineTo(c.sx - 4, c.sy - 1);
  ctx.closePath();
  ctx.fill();
}

function drawBones(ctx: Ctx, c: ScreenPoint): void {
  ctx.strokeStyle = P.BONE;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c.sx - 6, c.sy + 1);
  ctx.lineTo(c.sx + 2, c.sy - 3);
  ctx.moveTo(c.sx - 5, c.sy - 3);
  ctx.lineTo(c.sx + 3, c.sy + 1);
  ctx.stroke();
  ctx.fillStyle = P.BONE;
  ctx.beginPath();
  ctx.ellipse(c.sx + 6, c.sy - 4, 4, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(c.sx + 3.5, c.sy - 2, 5, 2.2);
  ctx.fillStyle = P.PUPIL;
  ctx.beginPath();
  ctx.arc(c.sx + 4.6, c.sy - 4.5, 1, 0, Math.PI * 2);
  ctx.arc(c.sx + 7.4, c.sy - 4.5, 1, 0, Math.PI * 2);
  ctx.fill();
}

function drawScarecrow(ctx: Ctx, c: ScreenPoint): void {
  ctx.fillStyle = P.WOOD_DARK;
  ctx.fillRect(c.sx - 1, c.sy - 24, 2, 24);
  ctx.fillRect(c.sx - 9, c.sy - 17, 18, 2);
  ctx.fillStyle = P.WOOD;
  polygon(ctx, [
    { sx: c.sx - 6, sy: c.sy - 16 },
    { sx: c.sx + 6, sy: c.sy - 16 },
    { sx: c.sx + 4, sy: c.sy - 6 },
    { sx: c.sx - 4, sy: c.sy - 6 },
  ]);
  ctx.fill();
  ctx.fillStyle = P.PALE;
  ctx.beginPath();
  ctx.arc(c.sx, c.sy - 21, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.PUPIL;
  ctx.fillRect(c.sx - 2, c.sy - 22, 1.2, 1.2);
  ctx.fillRect(c.sx + 1, c.sy - 22, 1.2, 1.2);
  ctx.fillRect(c.sx - 1.5, c.sy - 19.5, 3, 0.8);
  ctx.fillStyle = P.WOOD_DARK;
  ctx.fillRect(c.sx - 6, c.sy - 25, 12, 1.5);
  ctx.fillRect(c.sx - 3, c.sy - 29, 6, 4.5);
}

// ----- The well and the cave -----------------------------------------------

export function drawWell(ctx: Ctx, x: number, y: number): void {
  const c = project(x, y);
  ctx.fillStyle = P.STONE_DARK;
  ctx.beginPath();
  ctx.ellipse(c.sx, c.sy - 2, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#05070a';
  ctx.beginPath();
  ctx.ellipse(c.sx, c.sy - 5, 8, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.STONE;
  ctx.beginPath();
  ctx.ellipse(c.sx, c.sy - 6, 10, 5.4, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.WOOD_DARK;
  ctx.fillRect(c.sx - 8, c.sy - 24, 2, 20);
  ctx.fillRect(c.sx + 6, c.sy - 24, 2, 20);
  ctx.fillStyle = P.WOOD;
  polygon(ctx, [
    { sx: c.sx - 12, sy: c.sy - 23 },
    { sx: c.sx, sy: c.sy - 31 },
    { sx: c.sx + 12, sy: c.sy - 23 },
  ]);
  ctx.fill();
  ctx.strokeStyle = P.PALE;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(c.sx, c.sy - 23);
  ctx.lineTo(c.sx, c.sy - 12);
  ctx.stroke();
  ctx.fillStyle = P.WOOD_DARK;
  ctx.fillRect(c.sx - 2.5, c.sy - 12, 5, 4);
}

export function drawCave(ctx: Ctx, x: number, y: number, hum: number): void {
  const c = project(x, y);
  ctx.fillStyle = P.TREE_DARK;
  ctx.beginPath();
  ctx.ellipse(c.sx, c.sy - 6, 22, 16, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#030406';
  ctx.beginPath();
  ctx.ellipse(c.sx, c.sy - 4, 14, 11, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  if (hum > 0) {
    ctx.fillStyle = `rgba(255, 138, 61, ${0.25 * hum})`;
    ctx.beginPath();
    ctx.ellipse(c.sx, c.sy - 3, 8, 6, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 200, 150, ${0.9 * hum})`;
    ctx.beginPath();
    ctx.arc(c.sx - 3, c.sy - 6, 1, 0, Math.PI * 2);
    ctx.arc(c.sx + 3, c.sy - 6, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ----- Trees ------------------------------------------------------------------

export function drawTree(ctx: Ctx, x: number, y: number): void {
  const c = project(x, y);
  const scale = 0.75 + unit(hashInts(x, y, 41)) * 0.6;
  const sway = (unit(hashInts(x, y, 42)) - 0.5) * 14;
  const lean = (unit(hashInts(x, y, 43)) - 0.5) * 6;
  ctx.save();
  ctx.translate(c.sx + sway, c.sy + lean);
  ctx.scale(scale, scale);
  ctx.fillStyle = P.TRUNK;
  ctx.fillRect(-1.5, -8, 3, 8);
  const layers = [
    { w: 17, top: -38, base: -10, fill: P.TREE_MID },
    { w: 13, top: -46, base: -24, fill: P.TREE_LIGHT },
    { w: 9, top: -54, base: -36, fill: P.TREE_MID },
  ];
  for (const layer of layers) {
    ctx.fillStyle = layer.fill;
    polygon(ctx, [
      { sx: 0, sy: layer.top },
      { sx: layer.w, sy: layer.base },
      { sx: -layer.w, sy: layer.base },
    ]);
    ctx.fill();
    ctx.fillStyle = P.TREE_DARK;
    polygon(ctx, [
      { sx: 0, sy: layer.top },
      { sx: layer.w, sy: layer.base },
      { sx: 0, sy: layer.base },
    ]);
    ctx.fill();
  }
  ctx.restore();
}

// ----- Creatures and walkers -----------------------------------------------

export interface CreatureLook {
  /** 0..1 hop progress or undefined when standing. */
  hop?: { from: Point; t: number };
  blink: boolean;
  nudgeable: boolean;
}

export function creatureScreenPosition(creature: Creature, look: CreatureLook): ScreenPoint {
  if (!look.hop) return project(creature.x, creature.y);
  const from = project(look.hop.from.x, look.hop.from.y);
  const to = project(creature.x, creature.y);
  const t = look.hop.t;
  return {
    sx: lerp(from.sx, to.sx, t),
    sy: lerp(from.sy, to.sy, t) - Math.sin(t * Math.PI) * 10,
  };
}

export function drawCreature(ctx: Ctx, creature: Creature, look: CreatureLook): void {
  const c = creatureScreenPosition(creature, look);
  const squash = look.hop ? 1 - Math.sin(look.hop.t * Math.PI) * 0.15 : 1;
  ctx.save();
  ctx.translate(c.sx, c.sy);
  ctx.scale(1 / squash, squash);
  // Shadow on the ground.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 1, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Feet.
  ctx.fillStyle = P.CREATURE;
  ctx.beginPath();
  ctx.ellipse(-3.5, 0, 2.2, 1.3, 0, 0, Math.PI * 2);
  ctx.ellipse(3.5, 0, 2.2, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = P.CREATURE;
  ctx.beginPath();
  ctx.ellipse(0, -8, 7.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.CREATURE_RIM;
  ctx.beginPath();
  ctx.ellipse(-2, -10.5, 4, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // One eye, which looks where the creature faces.
  const look_x = creature.facing === 0 ? 1.2 : creature.facing === 2 ? -1.2 : 0;
  const look_y = creature.facing === 1 ? 0.8 : creature.facing === 3 ? -0.8 : 0;
  if (look.blink) {
    ctx.strokeStyle = P.EYE;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-2.5, -8);
    ctx.lineTo(2.5, -8);
    ctx.stroke();
  } else {
    ctx.fillStyle = P.EYE;
    ctx.beginPath();
    ctx.ellipse(0, -8, 3.4, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.PUPIL;
    ctx.beginPath();
    ctx.ellipse(look_x, -8 + look_y, 1.6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.EYE;
    ctx.beginPath();
    ctx.arc(look_x - 0.6, -9 + look_y, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (look.nudgeable) {
    ctx.strokeStyle = 'rgba(255, 176, 103, 0.9)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.ellipse(0, -7, 11, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export interface WalkerLook {
  position: ScreenPoint;
  facingRight: boolean;
  stepParity: number;
  fade: number;
}

export function drawWalker(ctx: Ctx, look: WalkerLook): void {
  const { sx, sy } = look.position;
  ctx.save();
  ctx.globalAlpha = look.fade;
  ctx.translate(sx, sy);
  if (!look.facingRight) ctx.scale(-1, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0.5, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs.
  ctx.strokeStyle = '#1b1620';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (look.stepParity === 0) {
    ctx.moveTo(-1.5, -5);
    ctx.lineTo(-2.5, 0);
    ctx.moveTo(1.5, -5);
    ctx.lineTo(2.5, 0);
  } else {
    ctx.moveTo(-1, -5);
    ctx.lineTo(0.5, 0);
    ctx.moveTo(1, -5);
    ctx.lineTo(-0.5, 0);
  }
  ctx.stroke();
  // Cloak.
  ctx.fillStyle = '#2a2233';
  polygon(ctx, [
    { sx: 0, sy: -15 },
    { sx: 4.5, sy: -4 },
    { sx: -4.5, sy: -4 },
  ]);
  ctx.fill();
  // Head.
  ctx.fillStyle = P.PALE;
  ctx.beginPath();
  ctx.arc(0, -16, 3, 0, Math.PI * 2);
  ctx.fill();
  // Arm and lantern.
  ctx.strokeStyle = '#2a2233';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(3, -10);
  ctx.lineTo(7, -8);
  ctx.stroke();
  ctx.fillStyle = P.LANTERN;
  ctx.fillRect(6, -8, 2.6, 3.4);
  ctx.restore();
}

/** A small raised lantern and three expanding rings, for a wave. */
export function drawWave(ctx: Ctx, at: Point, t: number): void {
  const c = project(at.x, at.y);
  ctx.save();
  ctx.strokeStyle = `rgba(255, 176, 103, ${(1 - t) * 0.8})`;
  ctx.lineWidth = 1.2;
  for (let ring = 0; ring < 3; ring += 1) {
    const r = 6 + (t * 28 + ring * 6) % 34;
    ctx.beginPath();
    ctx.ellipse(c.sx, c.sy - 4, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ----- Light -----------------------------------------------------------------

export function drawGlow(ctx: Ctx, sx: number, sy: number, radius: number, alpha: number, colour = '255, 150, 70'): void {
  if (alpha <= 0) return;
  const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
  gradient.addColorStop(0, `rgba(${colour}, ${alpha})`);
  gradient.addColorStop(0.45, `rgba(${colour}, ${alpha * 0.35})`);
  gradient.addColorStop(1, `rgba(${colour}, 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.fill();
}

// ----- Sky ---------------------------------------------------------------------

export function drawMoon(ctx: Ctx, cx: number, cy: number, r: number, seconds: number, shadow: number): void {
  ctx.save();
  const gradient = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  gradient.addColorStop(0, '#f4f1e2');
  gradient.addColorStop(1, P.MOON_SHADE);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120, 115, 95, 0.25)';
  for (const [ox, oy, cr] of [[0.35, -0.2, 0.16], [-0.25, 0.35, 0.11], [0.1, 0.5, 0.07]]) {
    ctx.beginPath();
    ctx.arc(cx + r * ox, cy + r * oy, r * cr, 0, Math.PI * 2);
    ctx.fill();
  }
  // The face. Mostly asleep; it opens one eye now and then.
  const awake = Math.max(0, Math.sin(seconds / 37)) ** 6;
  ctx.strokeStyle = 'rgba(80, 75, 60, 0.7)';
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.lineCap = 'round';
  const eyeY = cy - r * 0.12;
  for (const side of [-1, 1]) {
    const ex = cx + side * r * 0.3;
    if (awake > 0.5 && side === -1) {
      ctx.fillStyle = 'rgba(80, 75, 60, 0.8)';
      ctx.beginPath();
      ctx.arc(ex, eyeY, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(ex, eyeY - r * 0.02, r * 0.1, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.25, r * 0.18, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
  if (shadow > 0) {
    // A thin figure crossing the moon.
    const px = cx - r * 1.4 + shadow * r * 2.8;
    ctx.fillStyle = '#0a0b10';
    ctx.beginPath();
    ctx.ellipse(px, cy - r * 0.1, r * 0.08, r * 0.3, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a0b10';
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath();
    for (let leg = 0; leg < 4; leg += 1) {
      ctx.moveTo(px, cy + r * 0.1);
      ctx.lineTo(px - r * 0.3 + leg * r * 0.2, cy + r * 0.95);
    }
    ctx.stroke();
  }
  ctx.restore();
}
