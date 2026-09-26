import {isSubmarinePassenger} from './diving.js';

export const FEAST_PROPERTY = 'lumen_birds:village_feast_v1';
export const FEAST_WARNING = 160;
export const FEAST_APPROACH = 120;
export const FEAST_FEEDING_LIMIT = 1800;
export const FEAST_DEPARTURE = 100;
export const FEAST_COOLDOWN = 3600;
export const FEAST_BATCH_SIZE = 6; // Six archive writes plus six source removals.
export const FEAST_SCALE = 3.5;
export const FEAST_SPEED = .3;
export const FEAST_MOUTH_FORWARD = 28;
const ORIGIN_Y = 67;
const APPROACH_DISTANCE = 8;
const PHASES = new Set(['idle', 'warning', 'approach', 'feeding', 'departure', 'cooldown']);
const isAdventurePlayer = player => player.dimension.id === 'minecraft:overworld'
  && ['Survival', 'Adventure'].includes(player.getGameMode());

function nearSite(player, site) {
  return isAdventurePlayer(player) && Math.abs(player.location.y - site.spawn.y) <= 16
    && Math.hypot(player.location.x-site.x, player.location.z-site.z) <= 48;
}

function bitset(count, values) {
  const bytes = new Uint8Array(Math.ceil(count / 8));
  for (const index of values) bytes[index >> 3] |= 1 << (index & 7);
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function mouthContains(job, mouth) {
  // Whole source blocks must be inside the open mouth, not only their centers.
  // Feeding runs point toward +Z. The closed transit segments never eat.
  const {x, y, z} = job.location;
  return Math.abs(x+.5-mouth.x)+.5 <= 9 + 1e-8
    && Math.abs(z+.5-mouth.z)+.5 <= 1.5 + 1e-8
    && y >= ORIGIN_Y-7 && y+1 <= ORIGIN_Y+7;
}

export function feastRoute(entry) {
  const {site, blocks} = entry;
  const owned = blocks.filter(job => !job.protected);
  if (!owned.length) return [];
  const z0 = Math.min(...owned.map(job => job.location.z))-2;
  const z1 = Math.max(...owned.map(job => job.location.z))+3;
  const left = site.x-8, right = site.x+8;
  for (const job of owned) {
    if (!mouthContains(job, {x: left, z: job.location.z+.5})
      && !mouthContains(job, {x: right, z: job.location.z+.5})) {
      throw new Error('Village plan exceeds the verified mouth lanes');
    }
  }
  const route = [
    [{x: left, z: z0}, {x: left, z: z1}, true],
    [{x: left, z: z1}, {x: left, z: z1+4}, false],
    [{x: left, z: z1+4}, {x: site.x+40, z: z1+4}, false],
    [{x: site.x+40, z: z1+4}, {x: site.x+40, z: z0-4}, false],
    [{x: site.x+40, z: z0-4}, {x: right, z: z0-4}, false],
    [{x: right, z: z0-4}, {x: right, z: z0}, false],
    [{x: right, z: z0}, {x: right, z: z1}, true],
  ];
  return route.map(([from, to, eating]) => ({from, to, eating}));
}

export class VillageFeast {
  constructor(world, villages, monster, belly, {report = () => {}} = {}) {
    this.world = world;
    this.villages = villages;
    this.monster = monster;
    this.belly = belly;
    this.report = report;
    this.initialized = false;
    this.failed = false;
    this.state = {version: 1, phase: 'idle', cooldownUntil: 0};
    this.entry = undefined;
    this.entity = undefined;
  }

  save() {
    this.world.setDynamicProperty(FEAST_PROPERTY, JSON.stringify(this.state));
  }

  finish(now, outcome) {
    const hadMonster = !!this.entity || ['approach', 'feeding', 'departure'].includes(this.state.phase);
    this.entity = undefined;
    this.entry = undefined;
    if (hadMonster) try { this.monster.releaseVillageMonster(); } catch { /* Controller owns final cleanup. */ }
    this.state = {...this.state, phase: 'cooldown', cooldownUntil: now+FEAST_COOLDOWN,
      finishedAt: now, outcome, pending: outcome === 'complete' ? [] : (this.state.pending ?? [])};
    try { this.save(); } catch { this.failed = true; }
  }

  initialize(now) {
    const saved = this.world.getDynamicProperty(FEAST_PROPERTY);
    if (saved !== undefined) {
      const value = typeof saved === 'string' ? JSON.parse(saved) : undefined;
      if (!value || value.version !== 1 || !PHASES.has(value.phase)
        || !Number.isFinite(value.cooldownUntil)) throw new Error('Invalid village feast checkpoint');
      this.state = value;
      if (!['idle', 'cooldown'].includes(value.phase)) {
        // Never replay saved block work after reload. The consumed village and
        // its already archived pieces remain; only the live animation aborts.
        this.finish(now, 'reload');
      }
    }
    this.initialized = true;
  }

  notify(players, text) {
    for (const player of players) {
      try { if (nearSite(player, this.entry.site)) player.onScreenDisplay.setActionBar(text); } catch { /* Disconnected. */ }
    }
  }

  start(entry, now, players) {
    const route = feastRoute(entry);
    if (!route.length) return;
    this.entry = entry;
    this.route = route;
    this.segment = 0;
    this.mouth = {...route[0].from};
    this.yaw = 0;
    this.removed = new Set();
    this.kept = new Set();
    this.state = {version: 1, phase: 'warning', siteId: entry.site.id,
      cooldownUntil: 0, startedAt: now, phaseStartedAt: now, phaseEndsAt: now+FEAST_WARNING,
      count: entry.blocks.length, removed: bitset(entry.blocks.length, this.removed),
      kept: bitset(entry.blocks.length, this.kept), pending: [], consumed: false};
    this.save();
    this.notify(players, 'Tiefenmaul nähert sich ' + entry.site.name + '!');
  }

  pose(mouth = this.mouth, yaw = this.yaw) {
    const angle = yaw*Math.PI/180;
    return {location: {x: mouth.x+Math.sin(angle)*FEAST_MOUTH_FORWARD, y: ORIGIN_Y,
      z: mouth.z-Math.cos(angle)*FEAST_MOUTH_FORWARD}, rotation: {x: 0, y: yaw}};
  }

  update(openness) {
    if (!this.monster.updateVillageMonster(this.entity, this.pose(), openness, FEAST_SCALE)) {
      throw new Error('Village monster pose unavailable');
    }
  }

  rescueResidents(dimension) {
    for (const tag of this.entry.residentTags ?? []) {
      for (const resident of dimension.getEntities({tags: [tag]})) {
        if (!['minecraft:villager', 'minecraft:villager_v2'].includes(resident.typeId)) continue;
        // The site's ready chamber shares its loaded X/Z columns. A distant
        // surface spawn may be unloaded while somebody visits a remote village.
        const landing = this.belly.landingFor(this.entry.site.id);
        if (!landing || landing.siteId !== this.entry.site.id
          || !resident.tryTeleport({...landing.location}, {checkForBlocks: true, keepVelocity: false})) {
          throw new Error('Resident rescue unavailable');
        }
      }
    }
  }

  evacuateSupportedPlayers(job, players) {
    const {x, y, z} = job.location;
    for (const player of players) {
      if (!isAdventurePlayer(player) || isSubmarinePassenger(player)) continue;
      const at = player.location;
      const above = at.y >= y+.5 && at.y-y <= 3;
      const overlaps = at.x+.3 > x && at.x-.3 < x+1 && at.z+.3 > z && at.z-.3 < z+1;
      if (above && overlaps && this.monster.evacuateVillagePlayer(player, this.entry.site) !== true) {
        throw new Error('Player rescue unavailable');
      }
    }
  }

  recordProgress() {
    this.state.removed = bitset(this.entry.blocks.length, this.removed);
    this.state.kept = bitset(this.entry.blocks.length, this.kept);
    this.state.pending = [];
    this.save();
  }

  consume(dimension, players) {
    const candidates = [];
    for (const [index, job] of this.entry.blocks.entries()) {
      if (!job.protected && !this.removed.has(index) && !this.kept.has(index) && mouthContains(job, this.mouth)) {
        candidates.push({index, job});
      }
    }
    // Chew upper pieces first, then support blocks. Do not advance the mouth
    // while any intersecting plan work remains, including read-only checks.
    candidates.sort((a, b) => b.job.location.y-a.job.location.y);
    for (const {index, job} of candidates.slice(0, FEAST_BATCH_SIZE)) {
      const block = dimension.getBlock(job.location);
      if (!block) throw new Error('Village source chunk unavailable');
      if (block.typeId !== job.type) { this.kept.add(index); continue; }
      const container = block.getComponent('minecraft:inventory')?.container;
      if (container && container.emptySlotsCount !== container.size) {
        this.kept.add(index); continue;
      }
      // A visiting player or another room's construction can temporarily occupy
      // the copy destination/budget. Keep this job pending in the open mouth;
      // persistent archive conflicts still fail in storeBlock below.
      if (this.belly.storeDeferred(this.entry.site.id, job)) continue;
      if (!this.state.consumed) {
        if (this.villages.markConsumed(this.entry.site.id) !== true) throw new Error('Consumed village checkpoint unavailable');
        this.state.consumed = true;
      }
      // Persist intent before either copy or removal. The belly archive itself
      // persists its copy mapping before allowing the original to disappear.
      this.state.pending = [index];
      this.save();
      if (!this.belly.storeBlock(this.entry.site.id, job)) throw new Error('Village archive unavailable');
      const current = dimension.getBlock(job.location);
      if (!current) throw new Error('Village source chunk unloaded');
      if (current.typeId !== job.type) { this.kept.add(index); this.recordProgress(); continue; }
      const currentContainer = current.getComponent('minecraft:inventory')?.container;
      if (currentContainer && currentContainer.emptySlotsCount !== currentContainer.size) {
        this.kept.add(index); this.recordProgress(); continue;
      }
      // The first copied piece makes the chamber a valid swallowed-village
      // entrance. Rescue still happens before the supporting source disappears.
      this.evacuateSupportedPlayers(job, players);
      current.setType('minecraft:air');
      this.removed.add(index);
      this.recordProgress();
    }
    if (candidates.length) this.recordProgress();
    return candidates.length > 0;
  }

  advance() {
    const segment = this.route[this.segment];
    const dx = segment.to.x-this.mouth.x, dz = segment.to.z-this.mouth.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 1e-7) { this.segment++; return; }
    const step = Math.min(FEAST_SPEED, distance);
    this.mouth = {x: this.mouth.x+dx/distance*step, z: this.mouth.z+dz/distance*step};
    const desired = segment.eating ? 0 : Math.atan2(-dx, dz)*180/Math.PI;
    const difference = ((desired-this.yaw+540)%360)-180;
    this.yaw += Math.max(-3, Math.min(3, difference));
  }

  tick(_tick, active = false) {
    if (this.failed) return;
    let now;
    try {
      now = this.world.getAbsoluteTime();
      if (!Number.isFinite(now)) return;
      if (!this.initialized) this.initialize(now);
      if (!active) {
        if (!['idle', 'cooldown'].includes(this.state.phase)) this.finish(now, 'disabled');
        return;
      }
      const players = this.world.getPlayers();
      if (['idle', 'cooldown'].includes(this.state.phase)) {
        if (now < this.state.cooldownUntil || !this.monster.canStartVillageFeast()) return;
        const entry = this.villages.attackableVillages().find(candidate => players.some(player => nearSite(player, candidate.site)));
        if (!entry) return;
        this.belly.prepare(entry.site);
        if (!this.belly.isReady(entry.site.id)) return;
        this.start(entry, now, players);
        return;
      }
      if (!players.some(player => player.dimension.id === 'minecraft:overworld')) {
        this.finish(now, 'no_players'); return;
      }
      if (now < this.state.phaseStartedAt) { this.finish(now, 'clock_changed'); return; }
      if (this.state.phase === 'warning') {
        if (!players.some(player => nearSite(player, this.entry.site))) { this.finish(now, 'warning_cancelled'); return; }
        if (now < this.state.phaseEndsAt) return;
        if (!this.monster.canStartVillageFeast()) { this.finish(now, 'monster_busy'); return; }
        this.mouth = {...this.route[0].from, z: this.route[0].from.z-APPROACH_DISTANCE};
        const pose = this.pose();
        this.entity = this.monster.acquireVillageMonster(pose.location, pose.rotation);
        if (!this.entity) { this.finish(now, 'spawn_unavailable'); return; }
        this.state.phase = 'approach'; this.state.phaseStartedAt = now; this.state.phaseEndsAt = now+FEAST_APPROACH;
        this.save(); this.update(0);
        return;
      }
      if (this.state.phase === 'approach') {
        const progress = Math.min(1, (now-this.state.phaseStartedAt)/FEAST_APPROACH);
        this.mouth = {...this.route[0].from, z: this.route[0].from.z-APPROACH_DISTANCE*(1-progress)};
        this.update(progress);
        if (progress < 1) return;
        this.rescueResidents(this.world.getDimension('overworld'));
        this.state.phase = 'feeding'; this.state.phaseStartedAt = now; this.state.phaseEndsAt = now+FEAST_FEEDING_LIMIT;
        this.save(); return;
      }
      if (this.state.phase === 'feeding') {
        if (now >= this.state.phaseEndsAt) { this.finish(now, 'feeding_timeout'); return; }
        const segment = this.route[this.segment];
        if (!segment) {
          const unaccounted = this.entry.blocks.some((job, index) => !job.protected
            && !this.removed.has(index) && !this.kept.has(index));
          if (unaccounted) throw new Error('Incomplete village mouth coverage');
          this.departureStart = {...this.mouth};
          this.state.phase = 'departure'; this.state.phaseStartedAt = now; this.state.phaseEndsAt = now+FEAST_DEPARTURE;
          this.save(); return;
        }
        // Face +Z completely before opening for the second pass. Closed turns
        // never consume plan blocks, even when the model overlaps the village.
        if (segment.eating && Math.abs(this.yaw % 360) > .01) {
          const difference = ((-this.yaw+540)%360)-180;
          this.yaw += Math.max(-3, Math.min(3, difference));
          if (Math.abs(difference) <= 3) this.yaw = 0;
          this.update(0); return;
        }
        this.update(segment.eating ? .9+.1*Math.sin(now*.15) : 0);
        if (segment.eating && this.consume(this.world.getDimension('overworld'), players)) return;
        this.advance(); return;
      }
      if (this.state.phase === 'departure') {
        const progress = Math.min(1, (now-this.state.phaseStartedAt)/FEAST_DEPARTURE);
        this.yaw = 0;
        this.mouth = {...this.departureStart, z: this.departureStart.z+30*progress};
        this.update(1-progress);
        if (progress >= 1) this.finish(now, 'complete');
      }
    } catch (error) {
      this.report('Lumen Dorfszene unterbrochen: ' + String(error));
      if (Number.isFinite(now)) this.finish(now, 'unavailable');
      else this.failed = true;
    }
  }
}
