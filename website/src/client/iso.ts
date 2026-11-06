/**
 * Isometric projection for the diorama. World cell (x, y) sits on a diamond
 * tile; +x runs to the lower right and +y to the lower left of the screen.
 */
import type { Point } from '../shared/world.ts';

export const TILE_W = 48;
export const TILE_H = 24;
export const LEVEL_H = 26;

export interface ScreenPoint {
  sx: number;
  sy: number;
}

/** World-space (unscaled) screen coordinates of a cell's ground centre at height z. */
export function project(x: number, y: number, z = 0): ScreenPoint {
  return {
    sx: ((x - y) * TILE_W) / 2,
    sy: ((x + y) * TILE_H) / 2 - z * LEVEL_H,
  };
}

/** Fractional world cell under an unscaled screen point at ground level. */
export function unproject(sx: number, sy: number): { x: number; y: number } {
  const a = sx / (TILE_W / 2);
  const b = sy / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** The cell whose diamond contains the point. */
export function cellAt(sx: number, sy: number): Point {
  const fractional = unproject(sx, sy);
  return { x: Math.floor(fractional.x + 0.5), y: Math.floor(fractional.y + 0.5) };
}

/** Depth key for painter's ordering: further back first. */
export function depthOf(x: number, y: number, z = 0, layer = 0): number {
  return (x + y) * 100 + z * 10 + layer;
}

export interface Camera {
  /** World-space screen point shown at the canvas centre. */
  cx: number;
  cy: number;
  zoom: number;
}

export function worldToCanvas(camera: Camera, point: ScreenPoint, width: number, height: number): ScreenPoint {
  return {
    sx: (point.sx - camera.cx) * camera.zoom + width / 2,
    sy: (point.sy - camera.cy) * camera.zoom + height / 2,
  };
}

export function canvasToWorld(camera: Camera, point: ScreenPoint, width: number, height: number): ScreenPoint {
  return {
    sx: (point.sx - width / 2) / camera.zoom + camera.cx,
    sy: (point.sy - height / 2) / camera.zoom + camera.cy,
  };
}

/** Diamond outline of a ground cell in world-space screen coordinates. */
export function diamond(x: number, y: number, z = 0): ScreenPoint[] {
  const centre = project(x, y, z);
  return [
    { sx: centre.sx, sy: centre.sy - TILE_H / 2 },
    { sx: centre.sx + TILE_W / 2, sy: centre.sy },
    { sx: centre.sx, sy: centre.sy + TILE_H / 2 },
    { sx: centre.sx - TILE_W / 2, sy: centre.sy },
  ];
}

export function pointInPolygon(point: ScreenPoint, polygon: ScreenPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.sy > point.sy) !== (b.sy > point.sy)
      && point.sx < ((b.sx - a.sx) * (point.sy - a.sy)) / (b.sy - a.sy) + a.sx;
    if (crosses) inside = !inside;
  }
  return inside;
}
