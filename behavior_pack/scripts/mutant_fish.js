import {isFullWater, waterVolume} from './water.js';
import {isSubmarinePassenger} from './diving.js';

export const MUTANT_SPECIES = Object.freeze({
  abyss_biter: {speed: .12, damage: 2, cooldown: 40},
  lantern_maw: {speed: .075, damage: 3, cooldown: 60},
});
export const MAX_MUTANTS = 6;
export const MUTANT_HALF_WIDTH = 1.3;
export const MUTANT_HALF_HEIGHT = 1.1;
export const MUTANT_LIFETIME = 1200;
const TYPES = Object.keys(MUTANT_SPECIES).map(name => 'lumen_birds:' + name);
const squaredDistance = (a, b) => (a.x-b.x) ** 2 + (a.y-b.y) ** 2 + (a.z-b.z) ** 2;

export function isDeepSwimmer(player, dimension) {
  if (player.dimension.id !== 'minecraft:overworld' || player.location.y > 20) return false;
  if (!['Survival', 'Adventure'].includes(player.getGameMode())) return false;
  const at = player.location;
  return [0, 1.6].every(dy => isFullWater(dimension.getBlock({
    x: Math.floor(at.x), y: Math.floor(at.y + dy), z: Math.floor(at.z),
  })));
}

export function mutantWaterPath(dimension, from, to, cache = new Map()) {
  const dx = to.x-from.x, dy = to.y-from.y, dz = to.z-from.z;
  const center = {x: (from.x+to.x)/2, y: (from.y+to.y)/2, z: (from.z+to.z)/2};
  return waterVolume(dimension, center, MUTANT_HALF_WIDTH + Math.max(Math.abs(dx), Math.abs(dz))/2,
    MUTANT_HALF_HEIGHT + Math.abs(dy)/2, cache);
}

export class MutantFishManager {
  constructor(world, warn = () => {}) {
    this.world = world;
    this.report = warn;
    this.fish = new Map();
    this.lastReconcile = -Infinity;
    this.lastWarning = -Infinity;
    this.lastHits = new Map();
  }

  ownEntities(dimension) {
    return TYPES.flatMap(type => dimension.getEntities({type}));
  }

  retire(id) {
    const record = this.fish.get(id);
    this.fish.delete(id);
    if (record) try { record.entity.remove(); } catch { /* Native timer and later sweep remain. */ }
  }

  sweep(dimension, active) {
    for (const entity of this.ownEntities(dimension)) {
      if (!active || !this.fish.has(entity.id)) {
        try { entity.remove(); } catch { /* Failed removals still count toward the cap. */ }
      }
    }
  }

  spawn(dimension, players, tick) {
    const cache = new Map();
    for (const player of players) {
      for (const [x, z, y] of [[9, 0, -2], [-9, 0, 0], [0, 10, 2], [0, -10, -3], [8, 8, -1], [-8, -8, 1]]) {
        const loaded = this.ownEntities(dimension);
        if (loaded.length >= MAX_MUTANTS) return;
        const at = {x: Math.floor(player.location.x) + x + .5,
          y: Math.min(18, Math.floor(player.location.y) + y), z: Math.floor(player.location.z) + z + .5};
        if ([...this.fish.values()].some(record => squaredDistance(record.entity.location, at) < 9)) continue;
        if (!mutantWaterPath(dimension, at, at, cache)) continue;
        const species = Object.keys(MUTANT_SPECIES)[loaded.length % 2];
        const entity = dimension.spawnEntity('lumen_birds:' + species, at);
        this.fish.set(entity.id, {entity, species, born: tick, lastAttack: -Infinity});
      }
    }
  }

  tick(tick, active = false) {
    try {
      const dimension = this.world.getDimension('overworld');
      active = active && this.world.getDifficulty() !== 'Peaceful';
      if (!active) {
        for (const id of this.fish.keys()) this.retire(id);
        this.sweep(dimension, false);
        this.lastHits.clear();
        this.lastReconcile = -Infinity;
        return;
      }
      const players = this.world.getPlayers();
      const swimmers = players.filter(player => {
        try { return isDeepSwimmer(player, dimension); } catch { return false; }
      });
      const prey = swimmers.filter(player => {
        try { return !isSubmarinePassenger(player); } catch { return false; }
      });
      for (const [playerId, last] of this.lastHits) {
        if (!players.some(player => player.id === playerId) || tick-last > 100) this.lastHits.delete(playerId);
      }
      if (tick-this.lastReconcile >= 100) {
        this.lastReconcile = tick;
        this.sweep(dimension, true);
        this.spawn(dimension, swimmers, tick);
      }
      if (tick % 5 !== 0) return;
      const cache = new Map();
      for (const [id, record] of this.fish) {
        try {
          const entity = record.entity, at = entity.location;
          if (entity.dimension.id !== dimension.id || tick-record.born < 0 || tick-record.born >= MUTANT_LIFETIME
            || entity.getComponent('minecraft:health').currentValue <= 0
            || !swimmers.some(player => squaredDistance(player.location, at) <= 40 ** 2)) {
            this.retire(id); continue;
          }
          const target = prey.filter(player => squaredDistance(player.location, at) <= 24 ** 2)
            .sort((a, b) => squaredDistance(a.location, at)-squaredDistance(b.location, at))[0];
          const config = MUTANT_SPECIES[record.species];
          const desired = target ? {x: target.location.x, y: Math.min(20, target.location.y + .8), z: target.location.z}
            : {x: at.x + Math.cos(tick/60 + record.born), y: at.y, z: at.z + Math.sin(tick/60 + record.born)};
          const dx = desired.x-at.x, dy = desired.y-at.y, dz = desired.z-at.z;
          const distance = Math.hypot(dx, dy, dz), step = Math.min(distance, config.speed * 5);
          const next = distance > .001 ? {x: at.x+dx/distance*step, y: at.y+dy/distance*step, z: at.z+dz/distance*step} : at;
          if (!mutantWaterPath(dimension, at, at, cache)) { this.retire(id); continue; }
          // A blocked pursuit waits, never crosses walls or seeks unloaded chunks.
          if (!mutantWaterPath(dimension, at, next, cache)) continue;
          if (!entity.tryTeleport(next, {rotation: {x: 0, y: Math.atan2(-dx, dz)*180/Math.PI},
            checkForBlocks: true, keepVelocity: false})) { this.retire(id); continue; }
          if (target && squaredDistance(next, desired) <= 1.7 ** 2
            && tick-record.lastAttack >= config.cooldown
            && tick-(this.lastHits.get(target.id) ?? -Infinity) >= 20
            && !isSubmarinePassenger(target)
            && mutantWaterPath(dimension, next, desired, cache)) {
            // Stable entityAttack uses native armor/resistance/invulnerability.
            // Failed damage attempts also wait, so no per-tick bypass is tried.
            record.lastAttack = tick;
            this.lastHits.set(target.id, tick);
            target.applyDamage(config.damage, {cause: 'entityAttack', damagingEntity: entity});
          }
        } catch { this.retire(id); }
      }
    } catch {
      if (tick-this.lastWarning >= 1200) {
        this.report('Lumen Mutantenfische: Weltzugriff fehlgeschlagen; sichere Wiederholung folgt.');
        this.lastWarning = tick;
      }
    }
  }
}
