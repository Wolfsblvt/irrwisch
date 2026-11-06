/**
 * The night palette. One warm colour against quiet blues and plums.
 */
import type { RoomHue } from '../shared/world.ts';

export const SKY_TOP = '#07080f';
export const SKY_BOTTOM = '#141a2c';
export const HORIZON = '#1a2238';

export const GROUND = '#203431';
export const GROUND_EDGE = '#172222';
export const GROUND_WORN = '#4a4134';
export const FOREST_FLOOR = '#0f1818';

export const TREE_DARK = '#0b1414';
export const TREE_MID = '#122020';
export const TREE_LIGHT = '#1a2d2a';
export const TRUNK = '#1d1710';

export const STONE = '#6a7078';
export const STONE_DARK = '#454a52';
export const WOOD = '#4a3626';
export const WOOD_DARK = '#2e2118';

export const EMBER = '#ff8a3d';
export const EMBER_DEEP = '#ff6a1a';
export const LANTERN = '#ffb067';
export const CHALK = '#f3eee4';
export const PALE = '#e9dcc8';
export const SLATE = '#2a2e38';
export const SLATE_EDGE = '#3c4150';

export const CREATURE = '#3a2744';
export const CREATURE_RIM = '#5c3f6c';
export const EYE = '#fbf6ee';
export const PUPIL = '#0a0a12';

export const FOG = 'rgba(165, 180, 205, 1)';
export const MOON = '#e8e4d2';
export const MOON_SHADE = '#cdc7ae';

interface Faces {
  top: string;
  left: string;
  right: string;
  roof: string;
  roofShade: string;
}

/** Each hue is a quiet, slightly desaturated block colour with a warmer roof. */
export const ROOM_FACES: Record<RoomHue, Faces> = {
  ochre: { top: '#9a7c4e', left: '#6b5233', right: '#80633f', roof: '#7a3d2a', roofShade: '#56291c' },
  moss: { top: '#6f8a60', left: '#45593c', right: '#556d49', roof: '#4a5a3a', roofShade: '#303c26' },
  dusk: { top: '#6a7ba0', left: '#404c67', right: '#505f80', roof: '#3e4b6a', roofShade: '#2a3349' },
  plum: { top: '#8a6586', left: '#573f55', right: '#6c4f69', roof: '#5a3453', roofShade: '#3b2237' },
};

export const MUSHROOM = '#c7524f';
export const MUSHROOM_STEM = '#d9cdb5';
export const PUMPKIN = '#d9772f';
export const PUMPKIN_DARK = '#9b4f1c';
export const BONE = '#ddd6c4';
export const LEAF = '#3f6b45';
export const LEAF_DARK = '#2c4b31';
