import {activityAt, distanceSquared, seedFor} from './flight.js';
import {FISH_SPECIES, DAY_FISH, NIGHT_FISH, MAX_FISH, MAX_FISH_GROUPS,
  FISH_LIFETIME_TICKS, FISH_INTEREST_DISTANCE, FISH_GROUP_DISTANCE, fishPositionAt} from './fish.js';
import {findWaterHabitat, isFishPositionSafe} from './water.js';

const FISH_CONFIG = Object.freeze({
  species: FISH_SPECIES, school: activity => activity === 'night' ? NIGHT_FISH : DAY_FISH,
  maxEntities: MAX_FISH, maxGroups: MAX_FISH_GROUPS, lifetime: FISH_LIFETIME_TICKS,
  interestDistance: FISH_INTEREST_DISTANCE, groupDistance: FISH_GROUP_DISTANCE,
  activityAt, findHabitat: findWaterHabitat, isPositionSafe: isFishPositionSafe,
  positionAt: fishPositionAt, label: 'fish',
});

// Each manager has its own entity IDs, budget and water envelope.
// Fish use their own budget and exact entity IDs, independent of birds and vanilla mobs.
export class FishManager {
  constructor(world, report = () => {}, config = FISH_CONFIG) {
    this.config = config;
    this.world = world;
    this.report = report;
    this.swimmers = new Map();
    this.groups = new Map();
    this.nextGroup = 0;
    this.lastServedPlayerId = undefined;
    this.lastReconcile = -Infinity;
    this.lastWarning = -Infinity;
    this.activity = undefined;
  }

  warn(tick) {
    if (tick - this.lastWarning >= 1200) {
      this.report(`Lumen ${this.config.label}: a world operation failed; retrying safely.`);
      this.lastWarning = tick;
    }
  }

  retire(id) {
    const swimmer = this.swimmers.get(id);
    this.swimmers.delete(id);
    if (swimmer) {
      try { swimmer.entity.remove(); } catch { /* Unloaded/deleted: native timer and later sweep. */ }
    }
  }

  retireAll() {
    for (const id of this.swimmers.keys()) this.retire(id);
    this.groups.clear();
  }

  ownEntities(dimension) {
    return this.config.species.flatMap(species => dimension.getEntities({type: 'lumen_birds:' + species}));
  }

  sweep(dimension, activity) {
    for (const entity of this.ownEntities(dimension)) {
      if (!activity || !this.swimmers.has(entity.id)) {
        try { entity.remove(); } catch { /* Retry when the entity becomes available. */ }
      }
    }
  }

  move(dimension, entity, pose, waterCache) {
    // Check both ends: draining the pool must retire a fish instead of moving it
    // from air/lava back into the remaining water. The helper checks its whole body.
    if (entity.dimension.id !== dimension.id
      || !this.config.isPositionSafe(dimension, entity.location, waterCache)
      || !this.config.isPositionSafe(dimension, pose.location, waterCache)) return false;
    return entity.tryTeleport(pose.location, {
      rotation: pose.rotation, keepVelocity: false, checkForBlocks: true,
    });
  }

  spawnGroup(dimension, habitat, tick, playerId, activity) {
    const group = {id: ++this.nextGroup, habitat, born: tick, activity};
    const school = this.config.school(activity);
    const created = [];
    const waterCache = new Map();
    try {
      for (let i = 0; i < school.length; i++) {
        const species = school[i];
        const phase = (seedFor(playerId + ':' + tick) * Math.PI * 2
          + i * Math.PI * 2 / school.length) % (Math.PI * 2);
        const pose = this.config.positionAt(species, habitat, 0, phase);
        if (!this.config.isPositionSafe(dimension, pose.location, waterCache)) throw new Error('Water position unavailable');
        const entity = dimension.spawnEntity('lumen_birds:' + species, pose.location);
        // Register before another API call can fail, so every partial spawn rolls back.
        this.swimmers.set(entity.id, {entity, group, species, phase});
        created.push(entity.id);
        if (!this.move(dimension, entity, pose, waterCache)) throw new Error('Water position blocked');
      }
      this.groups.set(group.id, group);
      return true;
    } catch {
      for (const id of created) this.retire(id);
      this.warn(tick);
      return false;
    }
  }

  reconcile(dimension, activity, tick) {
    this.sweep(dimension, activity);
    if (!activity) return;
    const players = this.world.getPlayers()
      .filter(player => player.dimension.id === 'minecraft:overworld')
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const [id, group] of this.groups) {
      const nearby = players.some(player => distanceSquared(player.location, group.habitat)
        <= this.config.interestDistance ** 2);
      if (!nearby || tick - group.born >= this.config.lifetime) {
        for (const [entityId, swimmer] of this.swimmers) if (swimmer.group === group) this.retire(entityId);
        this.groups.delete(id);
      }
    }
    const nextPlayer = this.lastServedPlayerId === undefined ? 0
      : players.findIndex(player => player.id.localeCompare(this.lastServedPlayerId) > 0);
    const candidates = nextPlayer < 0 ? players
      : [...players.slice(nextPlayer), ...players.slice(0, nextPlayer)];
    const school = this.config.school(activity);
    const nearGroup = location => [...this.groups.values()].some(group =>
      distanceSquared(group.habitat, location) < this.config.groupDistance ** 2);
    for (const player of candidates) {
      if (this.groups.size >= this.config.maxGroups) break;
      // Failed removals can leave loaded orphans; count them before each attempt.
      if (this.config.maxEntities - this.ownEntities(dimension).length < school.length) break;
      if (nearGroup(player.location)) continue;
      try {
        const habitat = this.config.findHabitat(dimension, player);
        if (habitat && !nearGroup(habitat)
          && this.spawnGroup(dimension, habitat, tick, player.id, activity)) {
          this.lastServedPlayerId = player.id;
        }
      } catch { this.warn(tick); /* Unloaded water is retried without loading chunks. */ }
    }
  }

  tick(tick) {
    try {
      const activity = this.config.activityAt(this.world.getTimeOfDay());
      if (activity !== this.activity) {
        this.retireAll();
        this.activity = activity;
        this.lastReconcile = -Infinity;
      }
      if (!activity) this.retireAll();
      const dimension = this.world.getDimension('overworld');
      if (tick - this.lastReconcile >= 100) {
        this.lastReconcile = tick;
        this.reconcile(dimension, activity, tick);
      }
      if (!activity) return;
      if (tick % (this.config.moveInterval ?? 1) !== 0) return;
      // One synchronous tick may share block reads, but never reuse them after water changes.
      const waterCache = new Map();
      for (const [id, swimmer] of this.swimmers) {
        const age = tick - swimmer.group.born;
        if (age < 0 || age >= this.config.lifetime) { this.retire(id); continue; }
        try {
          const pose = this.config.positionAt(swimmer.species, swimmer.group.habitat, age / 20, swimmer.phase);
          if (!this.move(dimension, swimmer.entity, pose, waterCache)) this.retire(id);
        } catch { this.retire(id); }
      }
      for (const [id, group] of this.groups) {
        if (![...this.swimmers.values()].some(swimmer => swimmer.group === group)) this.groups.delete(id);
      }
    } catch {
      this.warn(tick);
      // Keep the scheduled callback alive; native despawn bounds simulated lifetime.
    }
  }
}
