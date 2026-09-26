import {submarinePathIsWater} from './diving.js';

// The normal add-on never calls activate(). Only the separately marked ocean
// adventure world opts in to this finite, resumable initial construction.
export const VILLAGE_PROPERTY = 'lumen_birds:ocean_village_v1';
export const ARRIVAL_PROPERTY = 'lumen_birds:ocean_arrival_v1';
export const VILLAGE_BATCH_SIZE = 96;
export const VILLAGE_SPAWN = Object.freeze({x: .5, y: 64, z: .5});
export const VILLAGE_SITES = Object.freeze([
  {id: 'harborlight', name: 'Hafenlicht', x: 0, z: 0},
  {id: 'eastwatch', name: 'Ostwacht', x: 192, z: 0},
  {id: 'fogharbor', name: 'Nebelhafen', x: -160, z: 144},
  {id: 'farpier', name: 'Fernsteg', x: 64, z: -192},
].map(site => Object.freeze({...site, spawn: Object.freeze({x: site.x+.5, y: 64, z: site.z+.5})})));
export const EQUIPMENT_CHEST = Object.freeze({x: -13, y: 64, z: -1});
export const DIVING_ITEMS = Object.freeze([
  'lumen_birds:diving_helmet', 'lumen_birds:diving_chestplate',
  'lumen_birds:diving_leggings', 'lumen_birds:diving_boots',
]);
export const VILLAGE_SUPPLIES = Object.freeze([
  ...DIVING_ITEMS.map(type => ({type, amount: 1})),
  {type: 'minecraft:bread', amount: 16}, {type: 'minecraft:stone_sword', amount: 1},
]);
export const VILLAGE_ENTITIES = Object.freeze([
  {type: 'lumen_birds:submarine', tag: 'lumen_ocean_submarine', location: {x: 13.5, y: 59.5, z: 22.5}},
  {type: 'minecraft:villager', tag: 'lumen_ocean_resident_1', location: {x: -11.5, y: 64, z: 1.5}},
  {type: 'minecraft:villager', tag: 'lumen_ocean_resident_2', location: {x: 12.5, y: 64, z: 1.5}},
]);
const REPLACEABLE = new Set(['minecraft:air', 'minecraft:water', 'minecraft:flowing_water',
  'minecraft:seagrass', 'minecraft:tall_seagrass', 'minecraft:kelp']);

function resolveSite(site = VILLAGE_SITES[0]) {
  const id = typeof site === 'string' ? site : site?.id;
  const configured = VILLAGE_SITES.find(value => value.id === id);
  if (!configured) throw new Error('Unknown ocean village: ' + id);
  return configured;
}

function offsetLocation(location, site) {
  return {...location, x: location.x+site.x, z: location.z+site.z};
}

export function villageProperty(site = VILLAGE_SITES[0]) {
  site = resolveSite(site);
  // Reuse the published origin checkpoint without resetting blocks or loot.
  return site.id === VILLAGE_SITES[0].id ? VILLAGE_PROPERTY : VILLAGE_PROPERTY + '_' + site.id;
}

export function villageEntities(site = VILLAGE_SITES[0]) {
  site = resolveSite(site);
  return VILLAGE_ENTITIES.map(job => ({...job, location: offsetLocation(job.location, site),
    tag: job.tag + (site.id === VILLAGE_SITES[0].id ? '' : '_' + site.id)}));
}

export function villageBlocks(site = VILLAGE_SITES[0]) {
  site = resolveSite(site);
  const blocks = new Map();
  const put = (x, y, z, type) => blocks.set(`${x},${y},${z}`, {
    location: {x, y, z}, type: 'minecraft:' + type,
  });
  const deck = (x0, x1, z0, z1) => {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) put(x, 63, z, 'spruce_planks');
  };
  // The spawn floor is first, before distant houses, walls, or decoration.
  deck(-3, 3, -3, 3);
  deck(-2, 2, -9, 27);
  deck(-8, 8, -2, 2);
  deck(3, 9, 20, 24);
  const houses = [{x: -12, z: 0, door: 'east'}, {x: 12, z: 0, door: 'west'},
    {x: 0, z: -13, door: 'south'}];
  for (const h of houses) deck(h.x-4, h.x+4, h.z-4, h.z+4);
  // Wooden float beams sit immediately below the deck; nothing reaches seabed.
  for (const h of houses) {
    for (const x of [-3, 3]) for (let z = -4; z <= 4; z++) put(h.x+x, 62, h.z+z, 'stripped_spruce_log');
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
      if (Math.abs(x) !== 3 && Math.abs(z) !== 3) continue;
      const doorway = (h.door === 'east' && x === 3 && z === 0)
        || (h.door === 'west' && x === -3 && z === 0)
        || (h.door === 'south' && z === 3 && x === 0);
      for (let y = 64; y <= 66; y++) {
        if (doorway && y < 66) continue;
        const corner = Math.abs(x) === 3 && Math.abs(z) === 3;
        const window = y === 65 && !corner && !doorway && (Math.abs(x) <= 1 || Math.abs(z) <= 1);
        put(h.x+x, y, h.z+z, corner ? 'stripped_spruce_log' : window ? 'glass' : 'oak_planks');
      }
      if (doorway) put(h.x+x, 64, h.z+z, 'spruce_fence_gate');
    }
    // Stepped pitched roofs with a one-block eave and a bright ridge ornament.
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
      put(h.x+x, 67+Math.max(0, 3-Math.abs(x)), h.z+z, 'dark_oak_planks');
    }
    put(h.x, 71, h.z, 'sea_lantern');
    put(h.x+1, 64, h.z-1, 'crafting_table');
    put(h.x-1, 64, h.z+1, 'barrel');
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
      if (Math.abs(x) !== 4 && Math.abs(z) !== 4) continue;
      const opening = (h.door === 'east' && x === 4 && Math.abs(z) <= 1)
        || (h.door === 'west' && x === -4 && Math.abs(z) <= 1)
        || (h.door === 'south' && z === 4 && Math.abs(x) <= 1);
      if (!opening) put(h.x+x, 64, h.z+z, 'spruce_fence');
    }
  }
  for (let z = -9; z <= 27; z++) for (const x of [-2, 2]) {
    if (Math.abs(z) <= 2 || (x === 2 && z >= 20 && z <= 24)) continue;
    put(x, 64, z, 'spruce_fence');
  }
  for (let x = -8; x <= 8; x++) for (const z of [-2, 2]) {
    if (Math.abs(x) <= 2) continue;
    put(x, 64, z, 'spruce_fence');
  }
  for (let x = -2; x <= 2; x++) put(x, 64, 27, 'spruce_fence');
  for (let x = 3; x <= 9; x++) for (const z of [20, 24]) put(x, 64, z, 'spruce_fence');
  for (let z = 20; z <= 24; z++) if (z !== 22) put(9, 64, z, 'spruce_fence');
  for (const [x, z] of [[-3, -3], [3, 3], [-2, 9], [2, 16], [9, 20], [9, 24]]) {
    put(x, 64, z, 'stripped_spruce_log');
    put(x, 65, z, 'spruce_fence');
    put(x, 66, z, 'sea_lantern');
  }
  put(EQUIPMENT_CHEST.x, EQUIPMENT_CHEST.y, EQUIPMENT_CHEST.z, 'chest');
  return [...blocks.values()].map(block => ({...block,
    // Hafenlicht's central rescue platform and its lamps survive a feeding.
    protected: site.id === VILLAGE_SITES[0].id
      && Math.abs(block.location.x) <= 3 && Math.abs(block.location.z) <= 3,
    location: offsetLocation(block.location, site),
  }));
}

function initialState() {
  return {version: 1, next: 0, equipment: 0, entity: 0, failures: 0,
    skippedResidents: 0, spawn: false, complete: false, consumed: false};
}

function parseState(value, count) {
  if (typeof value !== 'string') return undefined;
  try {
    const state = JSON.parse(value);
    if (state && state.consumed === undefined) state.consumed = false;
    return state?.version === 1 && Number.isInteger(state.next) && state.next >= 0 && state.next <= count
      && Number.isInteger(state.equipment) && state.equipment >= 0 && state.equipment <= VILLAGE_SUPPLIES.length
      && Number.isInteger(state.entity) && state.entity >= 0 && state.entity <= VILLAGE_ENTITIES.length
      && Number.isInteger(state.failures) && state.failures >= 0 && state.failures < 3
      && Number.isInteger(state.skippedResidents) && state.skippedResidents >= 0 && state.skippedResidents <= 2
      && typeof state.spawn === 'boolean' && typeof state.complete === 'boolean'
      && typeof state.consumed === 'boolean' ? state : undefined;
  } catch { return undefined; }
}

function nearVillage(player, site = VILLAGE_SITES[0]) {
  return player.dimension.id === 'minecraft:overworld'
    && Math.hypot(player.location.x-site.x, player.location.z-site.z) <= 48;
}

function occupies(player, {x, y, z}) {
  const at = player.location;
  return player.dimension.id === 'minecraft:overworld' && at.x+.3 > x && at.x-.3 < x+1
    && at.z+.3 > z && at.z-.3 < z+1 && at.y+1.8 > y && at.y < y+1;
}

export class OceanVillage {
  constructor(world, {makeItemStack, report = () => {}} = {}) {
    this.world = world;
    this.makeItemStack = makeItemStack;
    this.report = report;
    this.plans = new Map(VILLAGE_SITES.map(site => [site.id, villageBlocks(site)]));
    this.blocks = this.plans.get(VILLAGE_SITES[0].id);
    const futureObstacles = new Set(this.blocks.filter(job => job.location.y === 64 || job.location.y === 65)
      .map(job => `${job.location.x},${job.location.z}`));
    this.landingCells = this.blocks.slice(0, 49)
      .filter(job => !futureObstacles.has(`${job.location.x},${job.location.z}`))
      .sort((a, b) => Math.hypot(a.location.x, a.location.z)-Math.hypot(b.location.x, b.location.z));
    this.states = new Map();
    this.active = false;
    this.started = false;
    this.cursor = 0;
    this.lastWarning = -Infinity;
  }

  activate() {
    // Safe even during module early execution: world access starts in tick().
    this.active = true;
    return true;
  }

  warn(tick, message) {
    if (tick-this.lastWarning < 200) return;
    this.lastWarning = tick;
    this.report('Lumen ocean village: ' + message);
  }

  get complete() {
    return VILLAGE_SITES.every(site => this.states.get(site.id)?.complete || this.states.get(site.id)?.consumed);
  }

  save(state, site = VILLAGE_SITES[0]) {
    this.world.setDynamicProperty(villageProperty(site), JSON.stringify(state));
    this.states.set(site.id, {...state});
  }

  attackableVillages() {
    if (!this.active || !this.started) return [];
    return VILLAGE_SITES.filter(site => {
      const state = this.states.get(site.id);
      return state?.complete && !state.consumed;
    }).map(site => ({site, blocks: this.plans.get(site.id),
      residentTags: villageEntities(site).filter(job => job.type === 'minecraft:villager').map(job => job.tag)}));
  }

  markConsumed(siteId) {
    if (!this.active || !this.started) return false;
    try {
      const site = resolveSite(siteId);
      const state = this.states.get(site.id);
      if (!state?.complete) return false;
      if (state.consumed) return true;
      // Commit the consumed marker before the feeding controller removes blocks.
      this.save({...state, consumed: true}, site);
      return true;
    } catch { return false; }
  }

  protect(player) {
    for (const [type, amplifier] of [['water_breathing', 0], ['resistance', 4]]) {
      const old = player.getEffect(type);
      // Never turn an existing weaker, long-lived potion into long resistance V.
      // Water breathing and the initial dry landing remain available instead.
      if (type === 'resistance' && old && old.amplifier < amplifier) continue;
      if (!old || old.duration < 80 || old.amplifier < amplifier) {
        player.addEffect(type, Math.max(120, old?.duration ?? 0), {
          amplifier: Math.max(amplifier, old?.amplifier ?? 0), showParticles: false,
        });
      }
    }
  }

  rescueArrival(player, dimension) {
    if (player.getDynamicProperty(ARRIVAL_PROPERTY) === true || player.location.y >= 64) return;
    // Several spawn-floor cells are already built before reaching (0,63,0).
    // A player who fell into the water can land there without blocking the
    // remaining platform with their body or waiting for the central cell.
    for (const cell of this.landingCells) {
      const {x, z} = cell.location;
      if (dimension.getBlock(cell.location)?.typeId !== 'minecraft:spruce_planks'
        || !dimension.getBlock({x, y: 64, z})?.isAir || !dimension.getBlock({x, y: 65, z})?.isAir) continue;
      if (player.tryTeleport({x: x+.5, y: 64, z: z+.5}, {checkForBlocks: true, keepVelocity: false})) {
        player.setDynamicProperty(ARRIVAL_PROPERTY, true);
        return;
      }
    }
  }

  prepareInitialLanding(dimension, players, budget) {
    // If a swimmer occupies even the first floor cell, no earlier plank exists
    // yet. Place one other planned floor cell, charging the same global budget;
    // the normal checkpoint walk will later encounter and accept that plank.
    for (const cell of this.landingCells) {
      if (budget.remaining <= 0) return;
      if (players.some(player => occupies(player, cell.location))) continue;
      budget.remaining--;
      const {x, z} = cell.location, floor = dimension.getBlock(cell.location);
      if (!floor || (floor.typeId !== cell.type && !REPLACEABLE.has(floor.typeId))) continue;
      if (!dimension.getBlock({x, y: 64, z})?.isAir || !dimension.getBlock({x, y: 65, z})?.isAir) continue;
      if (floor.typeId !== cell.type) floor.setType(cell.type);
      return;
    }
  }

  welcome(players, dimension, state) {
    const floor = dimension.getBlock({x: 0, y: 63, z: 0});
    const feet = dimension.getBlock({x: 0, y: 64, z: 0});
    const head = dimension.getBlock({x: 0, y: 65, z: 0});
    if (floor?.typeId !== 'minecraft:spruce_planks' || !feet?.isAir || !head?.isAir) return;
    if (!state.spawn) {
      this.world.setDefaultSpawnLocation(VILLAGE_SPAWN);
      state.spawn = true;
      this.save(state);
    }
    for (const player of players) {
      if (!nearVillage(player) || player.getDynamicProperty(ARRIVAL_PROPERTY) === true) continue;
      if (player.location.y < 64 && !player.tryTeleport(VILLAGE_SPAWN, {checkForBlocks: true, keepVelocity: false})) continue;
      player.setDynamicProperty(ARRIVAL_PROPERTY, true);
    }
  }

  equip(dimension, state, site = VILLAGE_SITES[0]) {
    if (state.equipment === VILLAGE_SUPPLIES.length) return true;
    const chest = dimension.getBlock(offsetLocation(EQUIPMENT_CHEST, site));
    if (chest?.typeId !== 'minecraft:chest') return false;
    const inventory = chest.getComponent('minecraft:inventory')?.container;
    if (!inventory) return false;
    const slot = state.equipment, {type, amount} = VILLAGE_SUPPLIES[slot], existing = inventory.getItem(slot);
    // Preserve items a player has put in the chest while construction was paused.
    if (existing && existing.typeId !== type) return false;
    if (!existing) inventory.setItem(slot, this.makeItemStack(type, amount));
    state.equipment++;
    this.save(state, site);
    return state.equipment === VILLAGE_SUPPLIES.length;
  }

  populate(dimension, state, tick, site = VILLAGE_SITES[0]) {
    if (state.entity === VILLAGE_ENTITIES.length) return true;
    if (tick % 20 !== 0) return false;
    const job = villageEntities(site)[state.entity];
    const submarine = job.type === 'lumen_birds:submarine';
    try {
      if (submarine) {
        // Use the exact steering envelope, including the pilot and periscope.
        if (!submarinePathIsWater(dimension, job.location, {x: 0, y: 0, z: 0})) return false;
      } else {
        const feet = dimension.getBlock(job.location);
        const head = dimension.getBlock({...job.location, y: job.location.y+1});
        const floor = dimension.getBlock({...job.location, y: job.location.y-1});
        if (!feet?.isAir || !head?.isAir || floor?.typeId !== 'minecraft:spruce_planks') throw new Error('Resident home unavailable');
      }
      // Vanilla villager can transform into villager_v2 immediately after spawn.
      // Find either form when recovering a checkpoint after that transformation.
      const types = submarine ? [job.type] : ['minecraft:villager', 'minecraft:villager_v2'];
      let entity;
      for (const type of types) entity ??= dimension.getEntities({type, tags: [job.tag]})[0];
      for (const type of types) entity ??= dimension.getEntities({type, location: job.location, maxDistance: 2})[0];
      entity ??= dimension.spawnEntity(job.type, job.location);
      entity.addTag(job.tag);
    } catch (error) {
      if (submarine) throw error; // The requested submarine must actually exist.
      state.failures++;
      if (state.failures >= 3) {
        state.entity++;
        state.failures = 0;
        state.skippedResidents++;
        this.report('Lumen ocean village: resident could not be spawned after three attempts; house remains empty.');
      }
      this.save(state, site);
      return false;
    }
    state.failures = 0;
    state.entity++;
    this.save(state, site);
    return state.entity === VILLAGE_ENTITIES.length;
  }

  buildSite(site, state, dimension, players, budget, tick) {
    const blocks = this.plans.get(site.id);
    const atStart = site.id === VILLAGE_SITES[0].id;
    const nearby = players.filter(player => nearVillage(player, site));
    if (atStart && state.next < blocks.length) for (const player of nearby) this.protect(player);
    const start = state.next;
    while (state.next < blocks.length && budget.remaining > 0) {
      // Budget inspected jobs too, so replaying an interrupted batch cannot
      // turn into an unbounded scan or give each village its own 96 writes.
      budget.remaining--;
      const job = blocks[state.next], block = dimension.getBlock(job.location);
      if (!block) break;
      if (block.typeId !== job.type) {
        if (!REPLACEABLE.has(block.typeId)) {
          this.warn(tick, site.name + ': occupied building position; existing blocks are preserved');
          break;
        }
        if (atStart) for (const player of nearby) {
          if (!occupies(player, job.location)) continue;
          this.rescueArrival(player, dimension);
          if (state.next < 49 && occupies(player, job.location)
            && player.getDynamicProperty(ARRIVAL_PROPERTY) !== true && player.location.y < 64) {
            this.prepareInitialLanding(dimension, players, budget);
            this.rescueArrival(player, dimension);
          }
        }
        // Away from the initial spawn, a swimmer simply delays the affected
        // block. Exploration must never teleport them back to Hafenlicht.
        if (players.some(player => occupies(player, job.location))) break;
        block.setType(job.type);
      }
      state.next++;
    }
    if (state.next !== start) this.save(state, site);
    if (atStart) this.welcome(nearby, dimension, state);
    if (state.next !== blocks.length || (atStart && !state.spawn)
      || !this.equip(dimension, state, site) || !this.populate(dimension, state, tick, site)) {
      if (tick % 40 === 0) for (const player of nearby) {
        player.onScreenDisplay.setActionBar(site.name + ' entsteht. Stege und Häuser werden vorbereitet.');
      }
      return;
    }
    state.complete = true;
    this.save(state, site);
    for (const player of nearby) {
      player.onScreenDisplay.setActionBar(site.name + ': Tauchanzug in der westlichen Truhe, U-Boot am Südoststeg.'
        + (state.skippedResidents ? ' Dorfbewohner konnten nicht gesetzt werden.' : ''));
    }
  }

  tick(tick) {
    if (!this.active) return;
    this.started = true;
    let players;
    try { players = this.world.getPlayers(); } catch { this.warn(tick, 'waiting for players'); return; }
    const budget = {remaining: VILLAGE_BATCH_SIZE};
    let dimension;
    // Round-robin order shares progress when different players visit several
    // sites at once. One unavailable village cannot stall all other sites.
    for (let offset = 0; offset < VILLAGE_SITES.length; offset++) {
      const site = VILLAGE_SITES[(this.cursor+offset) % VILLAGE_SITES.length];
      try {
        const saved = this.world.getDynamicProperty(villageProperty(site));
        let state;
        if (saved === undefined) {
          this.states.delete(site.id);
          if (!players.some(player => nearVillage(player, site))) continue;
          state = initialState();
          this.save(state, site);
        } else {
          state = parseState(saved, this.plans.get(site.id).length);
          if (!state) {
            this.states.delete(site.id);
            this.warn(tick, site.name + ': invalid checkpoint; this village is paused');
            continue;
          }
          this.states.set(site.id, {...state});
        }
        if (state.complete || state.consumed || !players.some(player => nearVillage(player, site))) continue;
        if (state.next < this.plans.get(site.id).length && budget.remaining === 0) continue;
        dimension ??= this.world.getDimension('overworld');
        this.buildSite(site, state, dimension, players, budget, tick);
      } catch {
        // No chunk loading is requested. The durable checkpoint remains intact.
        this.warn(tick, site.name + ': waiting for loaded blocks or a successful world update');
      }
    }
    this.cursor = (this.cursor+1) % VILLAGE_SITES.length;
  }
}
