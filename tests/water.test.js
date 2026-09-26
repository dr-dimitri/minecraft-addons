import test from 'node:test';
import assert from 'node:assert/strict';
import {findWaterHabitat, isFishPositionSafe, isFullWater} from '../src/water.js';

const water = (typeId = 'minecraft:water', depth = 0) => ({typeId,
  permutation: {getState(name) { assert.equal(name, 'liquid_depth'); return depth; }}});

function pond() {
  const blocks = new Map();
  const dimension = {heightRange: {min: -64, max: 320}, reads: 0, unavailable: new Set(),
    getBlock({x, y, z}) {
      this.reads++;
      if (this.unavailable.has(x + ',' + z)) throw new Error('Unloaded');
      return blocks.get([x, y, z].join(',')) ?? {typeId: 'minecraft:air'};
    }};
  const fill = (x0, x1, y0, y1, z0, z1, block = water()) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      blocks.set([x, y, z].join(','), block);
    }
  };
  return {dimension, blocks, fill, player: {location: {x: .5, y: 64, z: .5}}};
}

test('only source water qualifies, never lava, waterlogged solids or thin flowing water', () => {
  assert.equal(isFullWater(water()), true);
  assert.equal(isFullWater(water('minecraft:flowing_water')), true);
  for (const block of [undefined, water('minecraft:lava'), water('minecraft:flowing_lava'),
    {typeId: 'minecraft:oak_stairs', isWaterlogged: true}, water('minecraft:water', 3),
    water('minecraft:flowing_water', 8), {typeId: 'minecraft:water', permutation: {getState: () => undefined}},
    {typeId: 'minecraft:kelp', isWaterlogged: true}]) assert.equal(isFullWater(block), false);
});

test('a two-block-deep clear pond supplies a complete submerged swimming route', () => {
  const f = pond(); f.fill(-2, 2, 62, 63, -2, 2);
  const habitat = findWaterHabitat(f.dimension, f.player);
  assert.deepEqual(habitat, {x: .5, y: 62.8, z: .5, radius: 1.5});
  for (let step = 0; step < 360; step++) {
    const angle = step * Math.PI / 180;
    assert.equal(isFishPositionSafe(f.dimension, {x: habitat.x + 1.5 * Math.cos(angle),
      y: habitat.y + .15 * Math.sin(angle * 2), z: habitat.z + 1.5 * Math.sin(angle)}), true);
  }
});

test('off-grid minimum ponds are found from every nearby player alignment', () => {
  for (const origin of [0, -20]) for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 4; dz++) {
    const f = pond(); f.fill(origin - 2, origin + 2, 62, 63, origin - 2, origin + 2);
    f.player.location = {x: origin + dx + .5, y: 64, z: origin + dz + .5};
    assert.deepEqual(findWaterHabitat(f.dimension, f.player),
      {x: origin + .5, y: 62.8, z: origin + .5, radius: 1.5}, `offset ${dx},${dz}`);
    // Refinement still needs the complete route, not just a water center.
    f.blocks.delete([origin, 62, origin].join(','));
    assert.equal(findWaterHabitat(f.dimension, f.player), undefined);
  }
});

test('refining obstructed water stays bounded and does not reuse water after a tick', () => {
  const f = pond(); f.fill(-14, 14, 62, 63, -14, 14);
  for (let x = -12; x <= 12; x += 4) for (let z = -12; z <= 12; z += 4) {
    f.blocks.set([x, 62, z].join(','), {typeId: 'minecraft:stone'});
  }
  assert.equal(findWaterHabitat(f.dimension, f.player), undefined);
  // Search centers stay within +/-12; the route adds two blocks at each edge.
  assert.ok(f.dimension.reads <= 29 * 29 * 10);
  f.fill(-2, 2, 62, 63, -2, 2);
  assert.ok(findWaterHabitat(f.dimension, f.player));
});

test('shallow puddles, narrow channels and interrupted routes cannot spawn fish', () => {
  for (const fill of [f => f.fill(-8, 8, 63, 63, -8, 8),
    f => f.fill(-1, 1, 60, 63, -12, 12),
    f => { f.fill(-2, 2, 62, 63, -2, 2); f.blocks.set('1,62,1', {typeId: 'minecraft:stone'}); }]) {
    const f = pond(); fill(f);
    assert.equal(findWaterHabitat(f.dimension, f.player), undefined);
  }
});

test('body edges cannot overlap a bank even when the center remains in water', () => {
  const f = pond(); f.fill(-2, 2, 62, 63, -2, 2);
  assert.equal(isFishPositionSafe(f.dimension, {x: 2.5, y: 62.8, z: .5}), false);
  assert.equal(isFishPositionSafe(f.dimension, {x: .5, y: 63.8, z: .5}), false);
  assert.equal(isFishPositionSafe(f.dimension, {x: .5, y: 61.8, z: .5}), false);
});

test('a missing search column does not prevent another nearby loaded pool', () => {
  const f = pond(); f.dimension.unavailable.add('0,0'); f.fill(2, 6, 62, 63, -2, 2);
  assert.equal(findWaterHabitat(f.dimension, f.player)?.x, 4.5);
});

test('underwater players and negative coordinates can find water without a surface query', () => {
  const f = pond(); f.player.location = {x: -10.3, y: -20, z: -10.3};
  f.fill(-13, -9, -24, -18, -13, -9);
  const habitat = findWaterHabitat(f.dimension, f.player);
  assert.ok(habitat); assert.equal(isFishPositionSafe(f.dimension, habitat), true);
});

test('water validation shares work within a tick and rechecks changed blocks next tick', () => {
  const f = pond(); f.fill(-2, 2, 62, 63, -2, 2);
  const at = {x: .5, y: 62.8, z: .5}, cache = new Map();
  assert.equal(isFishPositionSafe(f.dimension, at, cache), true);
  const reads = f.dimension.reads;
  assert.equal(isFishPositionSafe(f.dimension, at, cache), true); assert.equal(f.dimension.reads, reads);
  f.blocks.delete('0,62,0');
  assert.equal(isFishPositionSafe(f.dimension, at), false);
});

test('height limits, invalid locations and dry terrain fail safely with bounded work', () => {
  const f = pond();
  assert.equal(findWaterHabitat(f.dimension, f.player), undefined);
  assert.equal(f.dimension.reads, 49 * 9);
  for (const y of [NaN, Infinity, -65, 321]) {
    assert.equal(isFishPositionSafe(f.dimension, {x: 0, y, z: 0}), false);
  }
});
