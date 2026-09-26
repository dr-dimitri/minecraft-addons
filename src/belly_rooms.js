import {VILLAGE_SITES, villageBlocks} from './ocean_village.js';

// A permanent chamber represents the belly belonging to one swallowed village.
// It stays below that village's already loaded chunks; it never follows an entity.
export const BELLY_BATCH_SIZE = 128;
export const BELLY_Y_OFFSET = -121;
export const BELLY_BOUNDS = Object.freeze({minX: -21, maxX: 21, minZ: -22, maxZ: 32,
  minY: -60, maxY: -42});
export const BELLY_BLOCK_COUNT = 43 * 55 * 19;
const NATURAL = new Set(['minecraft:deepslate', 'minecraft:gravel']);
const SHARD_SIZE = 64;
const key = at => `${at.x},${at.y},${at.z}`;
const signature = block => JSON.stringify(Object.entries(block.permutation.getAllStates())
  .sort(([a], [b]) => a.localeCompare(b)));

export const bellyProperty = siteId => 'lumen_birds:belly_room_v1_' + siteId;
export const bellyStoreProperty = (siteId, shard) => 'lumen_birds:belly_store_v1_' + siteId + '_' + shard;

function roomType(x, y, z) {
  if (y === -60 || y === -42 || x === -21 || x === 21 || z === -22 || z === 32) {
    return 'minecraft:red_terracotta';
  }
  if (y === -59) return Math.abs(x) <= 2 && z <= -18 ? 'minecraft:sea_lantern' : 'minecraft:pink_terracotta';
  // The northern mouth and its glowing floor remain clear of the copied houses.
  if (z === -21 && ((Math.abs(x) === 3 && y <= -54) || (Math.abs(x) <= 3 && y === -54))) {
    return 'minecraft:bone_block';
  }
  if ((z + 20) % 8 === 0) {
    if (Math.abs(x) === 20 && y === -51) return 'minecraft:shroomlight';
    if ((Math.abs(x) >= 19 && y <= -44) || y === -43) return 'minecraft:bone_block';
  }
  return 'minecraft:air';
}

export function bellyBlock(site, index) {
  const x = index % 43 - 21, z = Math.floor(index / 43) % 55 - 22, y = Math.floor(index / (43 * 55)) - 60;
  return {location: {x: site.x + x, y, z: site.z + z}, type: roomType(x, y, z)};
}

function parseState(raw) {
  if (typeof raw !== 'string') return undefined;
  try {
    const state = JSON.parse(raw), p = state?.pending;
    if (state?.version !== 1 || !Number.isInteger(state.next) || state.next < 0 || state.next > BELLY_BLOCK_COUNT
      || typeof state.ready !== 'boolean' || state.ready !== (state.next === BELLY_BLOCK_COUNT && p === null)) return undefined;
    if (p !== null && (!Number.isInteger(p?.start) || p.start < 0 || p.start > state.next
      || !Array.isArray(p.originals) || p.originals.length < 1 || p.originals.length > BELLY_BATCH_SIZE
      || state.next >= p.start + p.originals.length || p.start + p.originals.length > BELLY_BLOCK_COUNT
      || !p.originals.every(type => NATURAL.has(type)))) return undefined;
    return state;
  } catch { return undefined; }
}

function parseShard(raw) {
  if (raw === undefined) return {};
  if (typeof raw !== 'string') return undefined;
  try {
    const entries = JSON.parse(raw);
    if (!entries || Array.isArray(entries) || typeof entries !== 'object') return undefined;
    for (const [index, value] of Object.entries(entries)) {
      if (!/^\d+$/.test(index) || Number(index) >= SHARD_SIZE || typeof value?.signature !== 'string'
        || !['pending', 'done'].includes(value.status)) return undefined;
    }
    return entries;
  } catch { return undefined; }
}

function occupies(player, at) {
  const p = player.location;
  return player.dimension.id === 'minecraft:overworld' && p.x+.3 > at.x && p.x-.3 < at.x+1
    && p.z+.3 > at.z && p.z-.3 < at.z+1 && p.y+1.8 > at.y && p.y < at.y+1;
}

function near(player, site, distance = 48) {
  return player.dimension.id === 'minecraft:overworld'
    && Math.hypot(player.location.x-site.x, player.location.z-site.z) <= distance;
}

function emptyContainer(block) {
  const inventory = block.getComponent('minecraft:inventory')?.container;
  if (!inventory) return true;
  for (let slot = 0; slot < inventory.size; slot++) if (inventory.getItem(slot)) return false;
  return true;
}

export class BellyRooms {
  constructor(world, {report = () => {}} = {}) {
    this.world = world;
    this.report = report;
    this.requested = new Set();
    this.plans = new Map(VILLAGE_SITES.map(site => [site.id, villageBlocks(site)]));
    this.indices = new Map([...this.plans].map(([id, plan]) => [id, new Map(plan.map((job, i) => [key(job.location), i]))]));
    this.active = false;
    this.writes = 0;
    this.lastTick = undefined;
    this.cursor = 0;
    this.lastWarning = -Infinity;
  }

  prepare(site) {
    const configured = VILLAGE_SITES.find(value => value.id === (typeof site === 'string' ? site : site?.id));
    if (!configured || (typeof site === 'object' && (site.x !== configured.x || site.z !== configured.z))) return false;
    this.requested.add(configured.id);
    return true;
  }

  state(siteId) { return parseState(this.world.getDynamicProperty(bellyProperty(siteId))); }
  save(siteId, state) { this.world.setDynamicProperty(bellyProperty(siteId), JSON.stringify(state)); }

  warn(tick) {
    if (tick-this.lastWarning < 200) return;
    this.lastWarning = tick;
    this.report('Lumen Bauchraum: Warte auf freie, geladene Blöcke und einen speicherbaren Baufortschritt.');
  }

  isReady(siteId) {
    if (!this.active || !this.plans.has(siteId)) return false;
    try { return this.state(siteId)?.ready === true; } catch { return false; }
  }

  build(site, state, dimension, players) {
    if (!state.pending) {
      const originals = [], limit = Math.min(BELLY_BATCH_SIZE-this.writes, BELLY_BLOCK_COUNT-state.next);
      if (limit <= 0) return;
      // Validate the complete batch before recording intent. Existing caves,
      // player builds and bedrock are never claimed merely because they look
      // like a desired room block. Only the flat world's stone is replaceable.
      for (let i = 0; i < limit; i++) {
        const job = bellyBlock(site, state.next+i), block = dimension.getBlock(job.location);
        if (!block || !NATURAL.has(block.typeId) || players.some(p => occupies(p, job.location))) return;
        originals.push(block.typeId);
      }
      state.pending = {start: state.next, originals};
      this.save(site.id, state);
    }
    const pending = state.pending;
    while (state.next < pending.start+pending.originals.length) {
      const job = bellyBlock(site, state.next), block = dimension.getBlock(job.location);
      if (!block || players.some(p => occupies(p, job.location))) break;
      if (block.typeId !== job.type) {
        if (block.typeId !== pending.originals[state.next-pending.start] || this.writes >= BELLY_BATCH_SIZE) break;
        this.writes++;
        block.setType(job.type);
        if (dimension.getBlock(job.location)?.typeId !== job.type) break;
      }
      state.next++;
    }
    if (state.next === pending.start+pending.originals.length) state.pending = null;
    state.ready = state.next === BELLY_BLOCK_COUNT && state.pending === null;
    this.save(site.id, state);
  }

  tick(tick, active = false) {
    this.active = active;
    if (tick !== this.lastTick) { this.writes = 0; this.lastTick = tick; }
    if (!active) return;
    try {
      const players = this.world.getPlayers();
      for (let offset = 0; offset < VILLAGE_SITES.length && this.writes < BELLY_BATCH_SIZE; offset++) {
        const site = VILLAGE_SITES[(this.cursor+offset) % VILLAGE_SITES.length];
        if (!players.some(player => near(player, site, 64))) continue;
        try {
          const raw = this.world.getDynamicProperty(bellyProperty(site.id));
          let state = parseState(raw);
          if (raw === undefined && this.requested.has(site.id)) {
            state = {version: 1, next: 0, pending: null, ready: false};
            this.save(site.id, state);
          }
          if (!state || state.ready) continue;
          this.build(site, state, this.world.getDimension('overworld'), players);
        } catch { this.warn(tick); }
      }
    } catch { this.warn(tick); }
    finally { this.cursor = (this.cursor+1) % VILLAGE_SITES.length; }
  }

  copyContext(siteId, job) {
    if (!this.isReady(siteId)) return undefined;
    const site = VILLAGE_SITES.find(value => value.id === siteId);
    const index = this.indices.get(siteId).get(key(job.location)), original = this.plans.get(siteId)[index];
    if (!original || original.protected || original.type !== job.type
      || !['x', 'y', 'z'].every(axis => original.location[axis] === job.location[axis])) return undefined;
    const dimension = this.world.getDimension('overworld'), source = dimension.getBlock(original.location);
    if (!source || source.typeId !== original.type || !emptyContainer(source)) return undefined;
    const sourceSignature = signature(source), at = {...original.location, y: original.location.y+BELLY_Y_OFFSET};
    const target = dimension.getBlock(at);
    if (!target) return undefined;
    const property = bellyStoreProperty(siteId, Math.floor(index/SHARD_SIZE));
    const shard = parseShard(this.world.getDynamicProperty(property)), slot = index % SHARD_SIZE;
    if (!shard) return undefined;
    const previous = shard[slot];
    if (previous && previous.signature !== sourceSignature) return undefined;
    const matches = block => block?.typeId === original.type && signature(block) === sourceSignature;
    const matchesTarget = matches(target);
    if (previous?.status === 'done' && !matchesTarget) return undefined;
    const needsWrite = !previous || !matchesTarget;
    if (needsWrite && target.typeId !== roomType(at.x-site.x, at.y, at.z-site.z)) return undefined;
    return {dimension, source, sourceSignature, at, target, property, shard, slot, previous, matches, needsWrite};
  }

  storeDeferred(siteId, job) {
    try {
      // Validate permanent conflicts first: a mined copy or changed source must
      // not be hidden behind a temporary exhausted budget or occupied cell.
      const copy = this.copyContext(siteId, job);
      return !!copy?.needsWrite && (this.writes >= BELLY_BATCH_SIZE
        || this.world.getPlayers().some(player => occupies(player, copy.at)));
    } catch { return false; }
  }

  storeBlock(siteId, job) {
    try {
      const copy = this.copyContext(siteId, job);
      if (!copy) return false;
      const {dimension, source, sourceSignature, at, target, property, shard, slot, previous, matches, needsWrite} = copy;
      if (previous?.status === 'done') return true;
      if (needsWrite) {
        if (this.world.getPlayers().some(player => occupies(player, at)) || this.writes >= BELLY_BATCH_SIZE) return false;
        // Intent survives a failed write/checkpoint. The caller must keep the
        // source until both its physical copy and this mapping are confirmed.
        if (!previous) {
          shard[slot] = {signature: sourceSignature, status: 'pending'};
          this.world.setDynamicProperty(property, JSON.stringify(shard));
        }
        this.writes++;
        target.setPermutation(source.permutation);
      }
      if (!matches(dimension.getBlock(at))) return false;
      shard[slot] = {signature: sourceSignature, status: 'done'};
      this.world.setDynamicProperty(property, JSON.stringify(shard));
      return true;
    } catch { return false; }
  }

  contains(player, siteId) {
    const site = VILLAGE_SITES.find(value => value.id === siteId), p = player.location;
    return !!site && player.dimension.id === 'minecraft:overworld'
      && p.x-.3 >= site.x-20 && p.x+.3 <= site.x+21 && p.z-.3 >= site.z-21 && p.z+.3 <= site.z+32
      && p.y >= -59 && p.y+1.8 < -42;
  }

  hasStoredBlock(site, dimension) {
    const plan = this.plans.get(site.id);
    for (let start = 0; start < plan.length; start += SHARD_SIZE) {
      const entries = parseShard(this.world.getDynamicProperty(bellyStoreProperty(site.id, start/SHARD_SIZE)));
      if (!entries) return false;
      for (const [slot, entry] of Object.entries(entries)) {
        if (entry.status !== 'done') continue;
        const job = plan[start+Number(slot)];
        if (!job) return false;
        const block = dimension.getBlock({...job.location, y: job.location.y+BELLY_Y_OFFSET});
        if (block?.typeId === job.type && signature(block) === entry.signature) return true;
      }
    }
    return false;
  }

  landingFor(siteId) {
    const site = VILLAGE_SITES.find(value => value.id === siteId);
    if (!site || !this.isReady(siteId)) return undefined;
    try {
      const dimension = this.world.getDimension('overworld');
      // Check a generous landing column and the marked mouth before arrival.
      // NPC evacuation needs this landing before the first block is swallowed.
      for (const z of [-21, -20, -19]) for (const x of [-1, 0, 1]) {
        if (dimension.getBlock({x: site.x+x, y: -59, z: site.z+z})?.typeId !== 'minecraft:sea_lantern') return undefined;
        for (const y of [-58, -57, -56]) if (!dimension.getBlock({x: site.x+x, y, z: site.z+z})?.isAir) return undefined;
      }
      return {siteId: site.id, location: {x: site.x+.5, y: -58, z: site.z-18.5}};
    } catch { return undefined; }
  }

  entryFor(player, siteId) {
    if (!this.active) return undefined;
    for (const site of VILLAGE_SITES.filter(value => (!siteId || value.id === siteId) && near(player, value)).sort((a, b) =>
      Math.hypot(player.location.x-a.x, player.location.z-a.z)-Math.hypot(player.location.x-b.x, player.location.z-b.z))) {
      try {
        const landing = this.landingFor(site.id);
        if (landing && this.hasStoredBlock(site, this.world.getDimension('overworld'))) return landing;
      } catch { /* Missing chunks, edited landings and bad checkpoints cannot be entered. */ }
    }
    return undefined;
  }

  isExit(player, siteId) {
    if (!this.contains(player, siteId)) return false;
    const site = VILLAGE_SITES.find(value => value.id === siteId), p = player.location;
    return Math.abs(p.x-(site.x+.5)) <= 2 && p.z <= site.z-19.5 && p.y >= -58 && p.y < -54;
  }
}
