import {waterVolume} from './water.js';

// Blocks. The animated model fits this envelope at every horizontal heading.
export const MONSTER_HALF_WIDTH = 11;
export const MONSTER_HALF_HEIGHT = 8;
export const MONSTER_RADIUS = 3;
export const MONSTER_BOB = .2;
export const MONSTER_SEARCH_BUDGET = 26000;

export function isMonsterPositionSafe(dimension, location, cache = new Map()) {
  return waterVolume(dimension, location, MONSTER_HALF_WIDTH, MONSTER_HALF_HEIGHT, cache);
}

export function findMonsterHabitat(dimension, player) {
  if (!Object.values(player.location).every(Number.isFinite)) return undefined;
  const base = player.location;
  const cache = new Map();
  // Check the usual depths at every location before spending the remaining
  // budget on intermediate heights. A 17-layer pool may have only one safe
  // vertical center; an obstructed column must not starve clear neighbors.
  const intermediate = [];
  for (let dy = -1; dy >= -24; dy--) if (dy % 8 !== 0) intermediate.push(dy);
  // Bound total block reads across all candidates, even in obstructed water.
  let reads = 0;
  const bounded = {
    heightRange: dimension.heightRange,
    getBlock(at) {
      if (reads >= MONSTER_SEARCH_BUDGET) throw new Error('Search budget exhausted');
      reads++;
      return dimension.getBlock(at);
    },
  };
  for (const heights of [[-8, -16, -24, 0], intermediate]) {
    for (const [dx, dz] of [[0, 0], [16, 0], [-16, 0], [0, 16], [0, -16],
      [16, 16], [-16, 16], [16, -16], [-16, -16]]) {
      for (const dy of heights) {
        if (reads >= MONSTER_SEARCH_BUDGET) return undefined;
        const habitat = {x: Math.floor(base.x) + dx + .5, y: Math.floor(base.y) + dy + .5,
          z: Math.floor(base.z) + dz + .5, radius: MONSTER_RADIUS};
        try {
          if (waterVolume(bounded, habitat, MONSTER_RADIUS + MONSTER_HALF_WIDTH,
            MONSTER_HALF_HEIGHT + MONSTER_BOB, cache)) return habitat;
        } catch { /* Missing chunks are never loaded; try another local candidate. */ }
      }
    }
  }
  return undefined;
}

export function monsterPositionAt(_species, habitat, seconds, phase = 0) {
  const angle = seconds * 2 * Math.PI / 40 + phase;
  return {
    location: {x: habitat.x + habitat.radius * Math.cos(angle),
      y: habitat.y + MONSTER_BOB * Math.sin(angle * 2),
      z: habitat.z + habitat.radius * Math.sin(angle)},
    rotation: {x: 0, y: angle * 180 / Math.PI},
  };
}

const species = Object.freeze(['deepmaw']);
export const SEA_MONSTER_CONFIG = Object.freeze({
  species, school: () => species, maxEntities: 1, maxGroups: 1, lifetime: 900,
  interestDistance: 64, groupDistance: 64, moveInterval: 5,
  // Active throughout the day; invalid world time still triggers cleanup.
  activityAt: time => Number.isFinite(time) ? 'all' : undefined,
  findHabitat: findMonsterHabitat, isPositionSafe: isMonsterPositionSafe,
  positionAt: monsterPositionAt, label: 'deepmaw',
});
