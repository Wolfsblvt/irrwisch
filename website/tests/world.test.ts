import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRandom } from '../src/shared/rng.ts';
import {
  CHALK_EMBER,
  CHALK_WHITE,
  FRESH_BUDGETS,
  MAX_HEIGHT,
  SIGN_CELLS,
  World,
  buildSpots,
  canBuild,
  canChalk,
  canPlace,
  dealHand,
  doorstep,
  entryPoint,
  findPath,
  growthStage,
  isClearing,
  nudgeTarget,
  placeSpots,
  seedSnapshot,
  windowGlow,
} from '../src/shared/world.ts';

const NOW = Date.UTC(2026, 10, 6, 12, 0, 0);

function seeded(): World {
  return new World(seedSnapshot(NOW));
}

test('the clearing is a connected blob around the centre inside the grid', () => {
  assert.equal(isClearing(20, 20), true);
  assert.equal(isClearing(0, 0), false);
  assert.equal(isClearing(-1, 20), false);
  assert.equal(isClearing(39, 39), false);
  let cells = 0;
  for (let x = 0; x < 40; x += 1) for (let y = 0; y < 40; y += 1) if (isClearing(x, y)) cells += 1;
  assert.ok(cells > 300 && cells < 800, `clearing has ${cells} cells`);
});

test('the entry point is on the clearing and a path reaches every seeded doorstep', () => {
  const world = seeded();
  const entry = entryPoint();
  assert.equal(isClearing(entry.x, entry.y), true);
  for (const room of world.rooms.values()) {
    const step = doorstep(world, room);
    assert.ok(step, `room ${room.id} has a doorstep`);
    const path = findPath(world, entry, step as { x: number; y: number });
    assert.ok(path.length > 1, `room ${room.id} is reachable`);
    assert.deepEqual(path[0], entry);
    assert.deepEqual(path.at(-1), step);
  }
});

test('building needs connection to the settlement and respects the height cap', () => {
  const world = seeded();
  assert.equal(canBuild(world, 20, 20).ok, false, 'the well is reserved');
  assert.equal(canBuild(world, 5, 5).ok, false, 'the forest is outside');
  const detached = canBuild(world, 25, 25);
  assert.equal(detached.ok, false);
  assert.equal(detached.ok ? '' : detached.reason, 'detached');
  const beside = canBuild(world, 22, 18);
  assert.deepEqual(beside, { ok: true, z: 0 });
  const stacked = canBuild(world, 20, 18);
  assert.deepEqual(stacked, { ok: true, z: 2 });
  for (let z = 2; z <= MAX_HEIGHT; z += 1) {
    world.addRoom({ id: 100 + z, x: 20, y: 18, z, hue: 'ochre', roof: 'flat', litAt: 0, lights: 0, sign: new Array(SIGN_CELLS).fill(0) });
  }
  const capped = canBuild(world, 20, 18);
  assert.equal(capped.ok, false);
  assert.equal(capped.ok ? '' : capped.reason, 'too-high');
  assert.ok(buildSpots(world).length > 0);
  assert.ok(buildSpots(world).every((spot) => canBuild(world, spot.x, spot.y).ok));
});

test('things sit on free ground near rooms and never on the well', () => {
  const world = seeded();
  assert.equal(canPlace(world, 'lantern', 20, 20).ok, false);
  assert.equal(canPlace(world, 'lantern', 21, 21).ok, false, 'already a lantern there');
  assert.equal(canPlace(world, 'lantern', 19, 19).ok, true);
  const far = canPlace(world, 'lantern', 28, 20);
  assert.equal(far.ok, false);
  assert.equal(far.ok ? '' : far.reason, 'far');
  assert.equal(canPlace(world, 'dragon', 19, 19).ok, false);
  const spots = placeSpots(world, 'stone');
  assert.ok(spots.length > 10);
  assert.ok(spots.every((spot) => canPlace(world, 'stone', spot.x, spot.y).ok));
});

test('chalk only adds colour to bare cells within budget', () => {
  const world = seeded();
  const good = canChalk(world, 1, [[0, CHALK_WHITE], [63, CHALK_EMBER]], FRESH_BUDGETS.chalk);
  assert.equal(good.ok, true);
  assert.equal(canChalk(world, 999, [[0, CHALK_WHITE]], 12).ok, false);
  assert.equal(canChalk(world, 1, [], 12).ok, false);
  assert.equal(canChalk(world, 1, [[0, 0]], 12).ok, false, 'bare is not a colour');
  assert.equal(canChalk(world, 1, [[64, CHALK_WHITE]], 12).ok, false, 'cell out of range');
  assert.equal(canChalk(world, 1, [[0, CHALK_WHITE], [0, CHALK_EMBER]], 12).ok, false, 'duplicate cell');
  const tooMany = Array.from({ length: 13 }, (_, index) => [index, CHALK_WHITE]);
  assert.equal(canChalk(world, 1, tooMany, 12).ok, false);
  const room = world.rooms.get(1);
  assert.ok(room);
  room.sign[5] = CHALK_WHITE;
  const taken = canChalk(world, 1, [[5, CHALK_EMBER]], 12);
  assert.equal(taken.ok, false);
  assert.equal(taken.ok ? '' : taken.reason, 'taken');
});

test('nudging moves a creature one free step, preferring away from the pusher', () => {
  const world = seeded();
  const creature = world.creatures.get(1);
  assert.ok(creature);
  const random = createRandom(7);
  const to = nudgeTarget(world, creature, { x: creature.x - 1, y: creature.y }, random);
  assert.ok(to);
  const distance = Math.abs(to.x - creature.x) + Math.abs(to.y - creature.y);
  assert.equal(distance, 1);
  assert.ok(to.x >= creature.x, 'hops away from a pusher standing to the -x side');
});

test('windows fade to an ember but never go dark once lit', () => {
  const room = { id: 1, x: 0, y: 0, z: 0, hue: 'ochre' as const, roof: 'flat' as const, litAt: NOW, lights: 1, sign: [] };
  assert.equal(windowGlow(room, NOW), 1);
  assert.equal(windowGlow(room, NOW + 30 * 60 * 1000), 1);
  const later = windowGlow(room, NOW + 3 * 24 * 60 * 60 * 1000);
  assert.ok(later < 1 && later > 0.18);
  const ancient = windowGlow(room, NOW + 400 * 24 * 60 * 60 * 1000);
  assert.ok(Math.abs(ancient - 0.18) < 1e-9);
  assert.equal(windowGlow({ ...room, lights: 0, litAt: 0 }, NOW), 0);
});

test('saplings grow by age; a hand holds three distinct kinds', () => {
  const sapling = { id: 1, kind: 'sapling' as const, x: 0, y: 0, placedAt: NOW };
  assert.equal(growthStage(sapling, NOW), 0);
  assert.equal(growthStage(sapling, NOW + 1.5 * 24 * 60 * 60 * 1000), 1);
  assert.equal(growthStage(sapling, NOW + 8 * 24 * 60 * 60 * 1000), 3);
  assert.equal(growthStage({ ...sapling, kind: 'stone' }, NOW + 8 * 24 * 60 * 60 * 1000), 0);
  const hand = dealHand(createRandom(3));
  assert.equal(hand.length, 3);
  assert.equal(new Set(hand).size, 3);
});
