// Conservative water volumes keep the complete animated fish below the surface
// and away from banks. No block mutation or chunk loading is used.
export const SWIM_RADIUS = 1.5;
export const FISH_HALF_WIDTH = .8;
export const FISH_HALF_HEIGHT = .45;
export const SWIM_BOB = .15;

export function isFullWater(block) {
  return (block?.typeId === 'minecraft:water' || block?.typeId === 'minecraft:flowing_water')
    && block.permutation.getState('liquid_depth') === 0;
}

function waterAt(dimension, x, y, z, cache) {
  const key = x + ',' + y + ',' + z;
  if (!cache.has(key)) cache.set(key, isFullWater(dimension.getBlock({x, y, z})));
  return cache.get(key);
}

function waterVolume(dimension, center, horizontal, vertical, cache) {
  if (![center.x, center.y, center.z].every(Number.isFinite)) return false;
  const minY = Math.floor(center.y - vertical), maxY = Math.floor(center.y + vertical);
  if (minY < dimension.heightRange.min || maxY >= dimension.heightRange.max) return false;
  for (let x = Math.floor(center.x - horizontal); x <= Math.floor(center.x + horizontal); x++) {
    for (let z = Math.floor(center.z - horizontal); z <= Math.floor(center.z + horizontal); z++) {
      for (let y = minY; y <= maxY; y++) if (!waterAt(dimension, x, y, z, cache)) return false;
    }
  }
  return true;
}

// Callers may share a cache within one synchronous tick, never across ticks.
export function isFishPositionSafe(dimension, location, cache = new Map()) {
  return waterVolume(dimension, location, FISH_HALF_WIDTH, FISH_HALF_HEIGHT, cache);
}

export function findWaterHabitat(dimension, player) {
  const at = player.location;
  if (![at.x, at.y, at.z].every(Number.isFinite)) return undefined;
  const base = {x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z)};
  const offsets = [];
  for (let x = -12; x <= 12; x += 4) for (let z = -12; z <= 12; z += 4) offsets.push({x, z});
  offsets.sort((a, b) => a.x * a.x + a.z * a.z - b.x * b.x - b.z * b.z);
  const cache = new Map();
  // Search near the player's height, including underwater players. This avoids
  // scanning whole world columns or depending on an exposed water surface.
  for (const offset of offsets) for (const dy of [-1, 0, -2, 1, -3, 2, -4, -5, -6]) {
    const x = base.x + offset.x, y = base.y + dy, z = base.z + offset.z;
    if (y - 1 < dimension.heightRange.min || y >= dimension.heightRange.max) continue;
    try {
      if (!waterAt(dimension, x, y, z, cache)) continue;
      const habitat = {x: x + .5, y: y - .2, z: z + .5, radius: SWIM_RADIUS};
      if (waterVolume(dimension, habitat, SWIM_RADIUS + FISH_HALF_WIDTH,
        FISH_HALF_HEIGHT + SWIM_BOB, cache)) return habitat;
    } catch { /* A missing column cannot hide a loaded pool elsewhere nearby. */ }
  }
  return undefined;
}
