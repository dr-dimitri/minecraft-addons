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

// Test the otherwise tolerated block above the feet. A short collision ray
// catches low slab roofs without treating tall grass or vines as ceilings.
export function hasLowRoof(dimension, player) {
  const at = player.location;
  const hit = dimension.getBlockFromRay({x: at.x, y: Math.floor(at.y) + .999, z: at.z},
    {x: 0, y: 1, z: 0}, {maxDistance: 1, includePassableBlocks: false, includeLiquidBlocks: false});
  return Boolean(hit && !isLeaves(hit.block));
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
  if (!center || hasLowRoof(dimension, player)) return [];
  if (center.location.y > at.y + 1) {
    if (!isLeaves(center) || center.location.y > at.y + 24) return [];
    // Allow players under a canopy, but not in a cave/house below a tree.
    // The low headroom band is covered separately without rejecting plants.
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
  const reachable = perch => perch.y >= dimension.heightRange.min && highest + 8 - perch.y <= 24;
  function choosePerches() {
    const usable = candidates.filter(reachable);
    for (let i = 0; i < usable.length; i++) for (let j = i + 1; j < usable.length; j++) {
      if ((usable[i].x - usable[j].x) ** 2 + (usable[i].z - usable[j].z) ** 2 >= 4) {
        return [usable[i], usable[j]];
      }
    }
    return [];
  }
  // Small crowns can fall entirely between coarse samples. Inspect the missing
  // columns when no pair was found, with at most 25x25 columns in the same area.
  // Select a separated pair: the nearest leaf may sit between both usable seats.
  if (choosePerches().length === 0) {
    const fine = [];
    for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) fine.push({x, z});
    fine.sort((a, b) => a.x * a.x + a.z * a.z - b.x * b.x - b.z * b.z);
    for (const offset of fine) inspect(Math.floor(at.x) + offset.x, Math.floor(at.z) + offset.z);
  }
  const cruiseY = highest + 8;
  if (cruiseY + 2 >= dimension.heightRange.max) return [];
  // Fine probes can reveal higher terrain; recheck every perch afterward.
  return choosePerches().map(p => ({...p, cruiseY}));
}
