import {SPECIES, FLOCK, NIGHT_FLOCK, MAX_BIRDS, MAX_GROUPS, LIFETIME_TICKS, INTEREST_DISTANCE,
  activityAt, distanceSquared, seedFor, positionAt, owlPositionAt} from './flight.js';
import {findPerches, validPerch} from './trees.js';

// API access is injected so daylight, failures, reloads and caps can be tested.
export class BirdManager {
  constructor(world, report = () => {}) {
    this.world = world;
    this.report = report;
    this.flights = new Map();
    this.groups = new Map();
    this.nextGroup = 0;
    this.lastServedPlayerId = undefined;
    this.lastReconcile = -Infinity;
    this.lastWarning = -Infinity;
    this.activity = undefined;
  }

  warn(tick) {
    if (tick - this.lastWarning >= 1200) {
      this.report('Lumen birds: a world operation failed; retrying safely.');
      this.lastWarning = tick;
    }
  }

  retire(id) {
    const flight = this.flights.get(id);
    this.flights.delete(id);
    if (flight) {
      try { flight.entity.remove(); } catch { /* Unloaded/deleted: native timer and later sweep. */ }
    }
  }

  retireAll() {
    for (const id of this.flights.keys()) this.retire(id);
    this.groups.clear();
  }

  ownEntities(dimension) {
    return SPECIES.flatMap(species => dimension.getEntities({type: 'lumen_birds:' + species}));
  }

  sweep(dimension, activity) {
    // Only our exact type IDs; never vanilla birds or another add-on.
    for (const entity of this.ownEntities(dimension)) {
      if (!activity || !this.flights.has(entity.id)) {
        try { entity.remove(); } catch { /* Skip unavailable entity. */ }
      }
    }
  }

  outdoorAnchor(dimension, player) {
    const at = player.location;
    const center = dimension.getTopmostBlock({x: Math.floor(at.x), z: Math.floor(at.z)});
    // Tolerate low ground cover, but reject a normal ceiling two blocks above the feet.
    if (!center || center.location.y > at.y + 1) return undefined;
    let ground = center.location.y;
    // Probe the route's vicinity, not just the player's column. Never load chunks.
    for (const x of [-30, 0, 30]) for (const z of [-30, 0, 30]) {
      const top = dimension.getTopmostBlock({x: Math.floor(at.x + x), z: Math.floor(at.z + z)});
      if (!top) return undefined;
      ground = Math.max(ground, top.location.y);
    }
    const y = Math.max(ground + 3, at.y);
    if (y + 37 >= dimension.heightRange.max || y < dimension.heightRange.min) return undefined;
    return {x: at.x, y, z: at.z};
  }

  spawnGroup(dimension, anchor, tick, playerId, activity = 'day', perches = []) {
    const id = ++this.nextGroup;
    const group = {id, anchor, born: tick, activity};
    const flock = activity === 'night' ? NIGHT_FLOCK : FLOCK;
    const created = [];
    try {
      for (let i = 0; i < flock.length; i++) {
        const species = flock[i];
        // Golden-angle spacing prevents consecutive hash inputs clustering birds.
        const phase = (seedFor(playerId + ':' + tick) * Math.PI * 2 + i * 2.399963229728653) % (Math.PI * 2);
        const perch = perches[i], offset = i * 20;
        const pose = perch ? owlPositionAt(species, perch, offset, phase)
          : positionAt(species, anchor, 0, phase);
        const block = dimension.getBlock({
          x: Math.floor(pose.location.x), y: Math.floor(pose.location.y), z: Math.floor(pose.location.z),
        });
        if (!block?.isAir) throw new Error('Sky location unavailable');
        const entity = dimension.spawnEntity('lumen_birds:' + species, pose.location);
        // Register before the next fallible call, so a failure cannot leak birds.
        const flight = {entity, group, species, phase, perch, offset, perched: pose.perched};
        this.flights.set(entity.id, flight);
        created.push(entity.id);
        if (perch) entity.setProperty('lumen_birds:perched', pose.perched);
        if (!entity.tryTeleport(pose.location, {rotation: pose.rotation, keepVelocity: false, checkForBlocks: true})) {
          throw new Error('Sky location blocked');
        }
      }
      this.groups.set(id, group);
      return true;
    } catch {
      for (const entityId of created) this.retire(entityId);
      this.warn(tick);
      return false;
    }
  }

  reconcile(dimension, activity, tick) {
    this.sweep(dimension, activity);
    if (!activity) return;
    const players = this.world.getPlayers()
      .filter(p => p.dimension.id === 'minecraft:overworld')
      .sort((a, b) => a.id.localeCompare(b.id));
    // Prune groups after disconnects, dimension changes, travel and expiry.
    for (const [id, group] of this.groups) {
      const nearby = players.some(p => distanceSquared(p.location, group.anchor) <= INTEREST_DISTANCE ** 2);
      if (!nearby || tick - group.born >= LIFETIME_TICKS) {
        for (const [entityId, flight] of this.flights) if (flight.group === group) this.retire(entityId);
        this.groups.delete(id);
      }
    }
    // Continue after the last successful allocation so distant players take turns
    // under the global cap. An ID cursor also survives that player's disconnect.
    const nextPlayer = this.lastServedPlayerId === undefined ? 0
      : players.findIndex(p => p.id.localeCompare(this.lastServedPlayerId) > 0);
    const candidates = nextPlayer < 0 ? players
      : [...players.slice(nextPlayer), ...players.slice(0, nextPlayer)];
    // Count actual loaded entities too; failed removal/reload may leave an orphan.
    for (const player of candidates) {
      if (this.groups.size >= MAX_GROUPS) break;
      // Recount after every attempt: even a failed rollback may leave an orphan.
      const room = MAX_BIRDS - this.ownEntities(dimension).length;
      if (room < (activity === 'night' ? NIGHT_FLOCK.length : FLOCK.length)) break;
      if ([...this.groups.values()].some(g => distanceSquared(g.anchor, player.location) < 80 ** 2)) continue;
      try {
        const perches = activity === 'night' ? findPerches(dimension, player) : [];
        const anchor = activity === 'night'
          ? (perches.length === NIGHT_FLOCK.length ? {...player.location} : undefined)
          : this.outdoorAnchor(dimension, player);
        if (anchor && this.spawnGroup(dimension, anchor, tick, player.id, activity, perches)) {
          this.lastServedPlayerId = player.id;
        }
      } catch { this.warn(tick); /* Unloaded terrain: try later without a ticking area. */ }
    }
  }

  tick(tick) {
    try {
      const activity = activityAt(this.world.getTimeOfDay());
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
      for (const [id, flight] of this.flights) {
        const age = tick - flight.group.born;
        if (age >= LIFETIME_TICKS || age < 0) { this.retire(id); continue; }
        try {
          const pose = flight.perch
            ? owlPositionAt(flight.species, flight.perch, age / 20 + flight.offset, flight.phase)
            : positionAt(flight.species, flight.group.anchor, age / 20, flight.phase);
          if (flight.perch) {
            if ((tick % 20 === 0 || pose.perched !== flight.perched) && !validPerch(dimension, flight.perch)) {
              this.retire(id); continue;
            }
            if (pose.perched !== flight.perched) {
              flight.entity.setProperty('lumen_birds:perched', pose.perched);
              flight.perched = pose.perched;
            }
          }
          // Small per-tick steps; interpolation must still be checked in Bedrock.
          if (!flight.entity.tryTeleport(pose.location, {rotation: pose.rotation, keepVelocity: false, checkForBlocks: true})) {
            this.retire(id);
          }
        } catch { this.retire(id); }
      }
      for (const [id, group] of this.groups) {
        if (![...this.flights.values()].some(f => f.group === group)) this.groups.delete(id);
      }
    } catch {
      this.warn(tick);
      // The scheduler remains alive; entity timers bound lifetime if API access fails.
    }
  }
}
