// Deliberately recognize leaf blocks, not arbitrary solid rooftops. No block
// mutation, ray commands or chunk loading is needed for a perch.
const LEAVES = new Set([
  'oak_leaves', 'spruce_leaves', 'birch_leaves', 'jungle_leaves', 'acacia_leaves',
  'dark_oak_leaves', 'mangrove_leaves', 'cherry_leaves', 'pale_oak_leaves',
  'azalea_leaves', 'azalea_leaves_flowered', 'leaves', 'leaves2',
].map(name => 'minecraft:' + name));

export function isLeaves(block) {
  return LEAVES.has(block?.typeId);
}

export function validPerch(dimension, perch) {
  return isLeaves(dimension.getBlock(perch.support))
    && [1, 2].every(dy => dimension.getBlock({
      x: perch.support.x, y: perch.support.y + dy, z: perch.support.z,
    })?.isAir);
}

export function findPerches(dimension, player) {
  const at = player.location;
  const center = dimension.getTopmostBlock({x: Math.floor(at.x), z: Math.floor(at.z)});
  if (!center) return [];
  if (center.location.y > at.y + 1) {
    if (!isLeaves(center) || center.location.y > at.y + 24) return [];
    // Allow players under a canopy, but not in a cave/house below a tree.
    for (let y = Math.floor(at.y) + 2; y < center.location.y; y++) {
      const block = dimension.getBlock({x: Math.floor(at.x), y, z: Math.floor(at.z)});
      if (!block || (!block.isAir && !isLeaves(block))) return [];
    }
  }
  const offsets = [];
  for (let x = -12; x <= 12; x += 4) for (let z = -12; z <= 12; z += 4) offsets.push({x, z});
  offsets.sort((a, b) => a.x * a.x + a.z * a.z - b.x * b.x - b.z * b.z);
  const candidates = [];
  const visited = new Set();
  let highest = at.y;
  function inspect(x, z) {
    const key = x + ',' + z;
    if (visited.has(key)) return;
    visited.add(key);
    try {
      const top = dimension.getTopmostBlock({x, z});
      if (!top) return;
      highest = Math.max(highest, top.location.y + 1);
      if (!isLeaves(top)) return;
      const support = {x, y: top.location.y, z};
      const perch = {x: x + .5, y: top.location.y + 1.02, z: z + .5, support};
      if (validPerch(dimension, perch)) candidates.push(perch);
    } catch { /* Unloaded columns are skipped; never force their chunks to load. */ }
  }
  for (const offset of offsets) inspect(Math.floor(at.x) + offset.x, Math.floor(at.z) + offset.z);
  // A small tree crown may intersect the coarse grid only once. Search its
  // immediate leaves too, rather than require a second separate tree.
  if (candidates.length === 1) {
    const {x, z} = candidates[0].support;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (dx * dx + dz * dz >= 4) inspect(x + dx, z + dz);
    }
  }
  const cruiseY = highest + 8;
  if (cruiseY + 2 >= dimension.heightRange.max) return [];
  return candidates.filter(p => p.y >= dimension.heightRange.min && cruiseY - p.y <= 24)
    .slice(0, 2).map(p => ({...p, cruiseY}));
}
