import {FishManager} from './fish_manager.js';
import {SEA_MONSTER_CONFIG, isMonsterPositionSafe} from './sea_monster.js';
import {isFullWater, waterVolume} from './water.js';
import {isSubmarinePassenger} from './diving.js';

export const RETURN_PROPERTY = 'lumen_birds:deepmaw_return';
export const ESCAPE_TIMEOUT = 400;
export const ESCAPE_COOLDOWN = 1200;
export const BELLY_ROOM_TIMEOUT = 3600;
const PROTECTION = [['resistance', 4], ['water_breathing', 0],
  ['fire_resistance', 0], ['saturation', 0]];

export function relativeToMaw(location, pose) {
  const yaw = pose.rotation.y * Math.PI / 180;
  const x = location.x - pose.location.x, z = location.z - pose.location.z;
  return {forward: -Math.sin(yaw) * x + Math.cos(yaw) * z,
    side: Math.cos(yaw) * x + Math.sin(yaw) * z, y: location.y - pose.location.y};
}

// Short effects also expire if the add-on is disabled. Existing stronger/longer
// effects are preserved; no game mode, inventory, health or world rule is changed.
export function protectPassenger(player) {
  for (const [type, amplifier] of PROTECTION) {
    const previous = player.getEffect(type);
    if (!previous || previous.amplifier < amplifier || previous.duration < 80) {
      player.addEffect(type, previous?.amplifier >= amplifier ? Math.max(120, previous.duration) : 120, {
        amplifier: Math.max(amplifier, previous?.amplifier ?? 0), showParticles: false,
      });
    }
    const applied = player.getEffect(type);
    if (!applied || applied.amplifier < amplifier) throw new Error('Passenger protection unavailable');
  }
}

function surfaceExit(dimension, at, distances = [2], height = 128) {
  // A free air column directly above water; no landing on plants, roofs or lava.
  const offsets = [[0, 0], ...distances.flatMap(d => [[d, 0], [-d, 0], [0, d], [0, -d]])];
  for (const [dx, dz] of offsets) {
    const x = Math.floor(at.x) + dx, z = Math.floor(at.z) + dz;
    // The adventure sea is 100 blocks deep. Keep the search bounded while also
    // reaching its surface from encounters close to the seabed.
    for (let y = Math.floor(at.y); y < Math.min(at.y + height, dimension.heightRange.max - 2); y++) {
      try {
        const below = dimension.getBlock({x, y: y - 1, z});
        const feet = dimension.getBlock({x, y, z}), head = dimension.getBlock({x, y: y + 1, z});
        if (isFullWater(below) && feet?.isAir && head?.isAir) return {x: x + .5, y, z: z + .5};
      } catch { break; }
    }
  }
  return undefined;
}

export class MonsterEncounter extends FishManager {
  constructor(world, report = () => {}, {bellyRooms} = {}) {
    super(world, report, SEA_MONSTER_CONFIG);
    this.passenger = undefined;
    this.cooldowns = new Map();
    this.bellyRooms = bellyRooms;
    this.villageMonster = undefined;
    this.villagePose = undefined;
  }

  canStartVillageFeast() {
    if (this.passenger || this.villageMonster) return false;
    // An unfinished ordinary rescue must finish before its monster is retired.
    return !this.world.getPlayers().some(player => {
      const saved = player.getDynamicProperty(RETURN_PROPERTY);
      if (typeof saved !== 'string') return false;
      try { return JSON.parse(saved).kind !== 'room'; } catch { return true; }
    });
  }

  acquireVillageMonster(location, rotation) {
    if (!this.canStartVillageFeast()) return undefined;
    const dimension = this.world.getDimension('overworld');
    // The surface encounter shares the ordinary giant's single-entity budget.
    this.retireAll();
    if (this.ownEntities(dimension).length) return undefined;
    const block = dimension.getBlock(location);
    if (!block || (!block.isAir && !isFullWater(block))) return undefined;
    let entity;
    try {
      entity = dimension.spawnEntity('lumen_birds:deepmaw', location);
      this.villageMonster = entity; // Register before another API call can fail.
      entity.triggerEvent('lumen_birds:begin_feast');
      if (!this.updateVillageMonster(entity, {location, rotation}, 0, 3.5)) throw new Error('Feast pose unavailable');
      return entity;
    } catch {
      this.releaseVillageMonster();
      return undefined;
    }
  }

  updateVillageMonster(entity, pose, openness, scale = 3.5) {
    if (entity !== this.villageMonster) return false;
    this.villagePose = undefined;
    try {
      if (entity.dimension.id !== 'minecraft:overworld' || !Number.isFinite(openness) || !Number.isFinite(scale)
        || !Object.values(pose.location).every(Number.isFinite)
        || !['x', 'y'].every(axis => Number.isFinite(pose.rotation[axis]))) return false;
      // The giant deliberately breaches the surface during feeding. Its mouth
      // checks live blocks in VillageFeast; normal underwater clearance does not
      // apply to this staged surface encounter.
      const block = entity.dimension.getBlock(pose.location);
      if (!block || (!block.isAir && !isFullWater(block))) return false;
      const size = Math.max(1, Math.min(3.5, scale)), jawOpen = Math.max(0, Math.min(1, openness));
      entity.setProperty('lumen_birds:feast_scale', size);
      entity.setProperty('lumen_birds:jaw_open', jawOpen);
      if (!entity.tryTeleport(pose.location, {rotation: pose.rotation,
        keepVelocity: false, checkForBlocks: true})) return false;
      this.villagePose = {location: {...pose.location}, rotation: {...pose.rotation}, scale: size, jawOpen};
      return true;
    } catch { return false; }
  }

  releaseVillageMonster() {
    const entity = this.villageMonster;
    this.villageMonster = undefined;
    this.villagePose = undefined;
    try { entity?.remove(); } catch { /* The native timer and normal orphan sweep remain. */ }
    this.lastReconcile = -Infinity;
  }

  enterBellyRoom(player, entry, tick = this.lastTick ?? 0) {
    const effects = PROTECTION.flatMap(([type, amplifier]) => {
      const old = player.getEffect(type);
      return old && old.amplifier < amplifier
        ? [{type, amplifier: old.amplifier, duration: old.duration}] : [];
    });
    player.setDynamicProperty(RETURN_PROPERTY, JSON.stringify({
      kind: 'room', siteId: entry.siteId, time: this.world.getAbsoluteTime(), effects,
      dimension: player.dimension.id, location: {...player.location},
    }));
    protectPassenger(player);
    if (!player.tryTeleport(entry.location, {checkForBlocks: true, keepVelocity: false})) {
      this.release(player, tick);
      return false;
    }
    this.message(player, 'Im Bauch! Erkunde das verschluckte Dorf. Leuchtender Ausgang oder Schleichen: entkommen.');
    return true;
  }

  evacuateVillagePlayer(player, site) {
    if (isSubmarinePassenger(player) || !['Survival', 'Adventure'].includes(player.getGameMode())) return true;
    if (player.getDynamicProperty(RETURN_PROPERTY) !== undefined) return false;
    const entry = this.bellyRooms?.entryFor(player, site.id);
    return entry ? this.enterBellyRoom(player, entry) : false;
  }

  swallowVillageSwimmers(players, tick) {
    const pose = this.villagePose;
    if (!pose || pose.jawOpen < .8) return;
    for (const player of players) {
      try {
        if (player.dimension.id !== 'minecraft:overworld' || this.cooldowns.has(player.id)
          || isSubmarinePassenger(player) || player.getDynamicProperty(RETURN_PROPERTY) !== undefined
          || !['Survival', 'Adventure'].includes(player.getGameMode())) continue;
        const at = relativeToMaw(player.location, pose), size = pose.scale;
        // The modeled mouth faces local +Z. Keep the whole upright player
        // between its cheeks and teeth, behind the front lip, above the open jaw.
        if (Math.abs(at.side)+.3 > 2.5*size || at.forward-.3 < 7.25*size
          || at.forward+.3 > 8*size || at.y < -2.8*size || at.y+1.8 > 1.4*size) continue;
        if (!isFullWater(player.dimension.getBlock(player.location))) continue;
        const entry = this.bellyRooms?.entryFor(player);
        if (entry) this.enterBellyRoom(player, entry, tick);
      } catch { this.warn(tick); }
    }
  }

  visitBellyRoom(player, entry, tick) {
    protectPassenger(player);
    const elapsed = this.world.getAbsoluteTime() - entry.time;
    if (!Number.isFinite(entry.time) || !this.bellyRooms || !this.bellyRooms.isReady(entry.siteId)
      || player.dimension.id !== entry.dimension || player.isSneaking
      || elapsed < 0 || elapsed >= BELLY_ROOM_TIMEOUT
      || !this.bellyRooms.contains(player, entry.siteId)
      || this.bellyRooms.isExit(player, entry.siteId)) {
      this.release(player, tick);
    } else if (tick % 40 === 0) {
      this.message(player, 'Verschlucktes Dorf · Erkunde den Bauch. Leuchtender Ausgang / Schleichen: zurück ins Meer.');
    }
  }

  move(dimension, entity, pose, cache) {
    return super.move(dimension, entity,
      this.passenger?.monsterId === entity.id ? this.passenger.pose : pose, cache);
  }

  message(player, text) {
    try { player.onScreenDisplay.setActionBar(text); } catch { /* UI cannot prevent rescue. */ }
  }

  release(player, tick) {
    const saved = player.getDynamicProperty(RETURN_PROPERTY);
    if (typeof saved !== 'string') return true;
    let entry;
    try { entry = JSON.parse(saved); } catch { entry = undefined; }
    if (!entry || !entry.location || !['x', 'y', 'z'].every(k => Number.isFinite(entry.location[k]))) {
      player.setDynamicProperty(RETURN_PROPERTY, undefined);
      return true;
    }
    if (entry.dimension !== player.dimension.id) {
      // Portals/other add-ons already moved this player: never pull them back.
      this.restoreEffects(player, entry);
      player.setDynamicProperty(RETURN_PROPERTY, undefined);
      this.cooldowns.set(player.id, tick + ESCAPE_COOLDOWN);
      return true;
    }
    protectPassenger(player);
    const targets = [surfaceExit(player.dimension, player.location),
      surfaceExit(player.dimension, entry.location)];
    if (entry.kind === 'room') {
      // Village decks sit above the adventure sea at Y=63. Starting the usual
      // upward search at saved deck/roof height misses the water after a bite.
      // Wider columns also let guests escape from below the protected harbor.
      targets.push(surfaceExit(player.dimension, {...entry.location, y: 62}, [2, 4, 8, 16, 24], 4));
    }
    // If a surface is blocked, return to the original, still-clear water.
    // Keep retrying with protection if neither target is currently loaded/safe.
    try {
      const center = {...entry.location, y: entry.location.y + .9};
      if (waterVolume(player.dimension, center, .4, 1, new Map())) targets.push(entry.location);
    } catch { /* Missing chunks cannot be used for rescue. */ }
    for (const target of targets.filter(Boolean)) {
      if (!player.tryTeleport(target, {checkForBlocks: true, keepVelocity: false})) continue;
      this.restoreEffects(player, entry);
      player.setDynamicProperty(RETURN_PROPERTY, undefined);
      this.cooldowns.set(player.id, tick + ESCAPE_COOLDOWN);
      this.message(player, 'Entkommen! Das Tiefenmaul lässt dich eine Minute in Ruhe.');
      return true;
    }
    this.message(player, 'Rettung läuft — du bist geschützt. Freies Wasser wird gesucht.');
    return false;
  }

  restoreEffects(player, entry) {
    const elapsed = Math.max(0, this.world.getAbsoluteTime() - entry.time);
    for (const old of entry.effects ?? []) {
      const current = player.getEffect(old.type);
      const owned = PROTECTION.find(([type]) => type === old.type)?.[1];
      if (!current || current.amplifier !== owned || current.duration > 120) continue;
      player.removeEffect(old.type);
      if (old.duration > elapsed) player.addEffect(old.type, old.duration - elapsed,
        {amplifier: old.amplifier, showParticles: false});
    }
  }

  swallow(player, swimmer, tick) {
    const entity = swimmer.entity;
    const pose = {location: {...entity.location}, rotation: entity.getRotation()};
    const belly = {...pose.location, y: pose.location.y - .8};
    if (!isMonsterPositionSafe(entity.dimension, entity.location)) return;
    const entry = this.bellyRooms?.entryFor(player);
    if (entry) { this.enterBellyRoom(player, entry, tick); return; }
    // Protection and durable recovery information must succeed before teleporting.
    const effects = PROTECTION.flatMap(([type, amplifier]) => {
      const old = player.getEffect(type);
      return old && old.amplifier < amplifier
        ? [{type, amplifier: old.amplifier, duration: old.duration}] : [];
    });
    player.setDynamicProperty(RETURN_PROPERTY, JSON.stringify({
      dimension: player.dimension.id, location: {...player.location}, effects, time: this.world.getAbsoluteTime(),
    }));
    protectPassenger(player);
    this.passenger = {playerId: player.id, monsterId: entity.id, pose, born: tick};
    if (!player.tryTeleport(belly, {rotation: pose.rotation, keepVelocity: false, checkForBlocks: true})) {
      this.passenger = undefined;
      this.release(player, tick);
      return;
    }
    this.message(player, 'Verschluckt! Schwimme geradeaus durch das große Maul. Schleichen: Notausgang.');
  }

  tick(tick) {
    this.lastTick = tick;
    // Protect/recover players before the shared manager can retire their monster.
    let players;
    try { players = this.world.getPlayers(); } catch { this.warn(tick); return; }
    for (const [id, until] of this.cooldowns) if (until <= tick) this.cooldowns.delete(id);
    if (this.passenger && !players.some(p => p.id === this.passenger.playerId)) {
      // On reconnect the persistent marker takes the recovery path below.
      this.retire(this.passenger.monsterId);
      this.passenger = undefined;
    }
    for (const player of players) {
      try {
        const saved = player.getDynamicProperty(RETURN_PROPERTY);
        if (saved === undefined) continue;
        let entry;
        try { entry = JSON.parse(saved); } catch { /* release() handles malformed markers. */ }
        if (entry?.kind === 'room') { this.visitBellyRoom(player, entry, tick); continue; }
        const ride = this.passenger?.playerId === player.id ? this.passenger : undefined;
        if (!ride) { this.release(player, tick); continue; }
        protectPassenger(player);
        const at = relativeToMaw(player.location, ride.pose);
        const escape = at.forward >= 7.5 || player.isSneaking || tick - ride.born >= ESCAPE_TIMEOUT
          || player.dimension.id !== 'minecraft:overworld' || !this.swimmers.has(ride.monsterId);
        if (escape) {
          // Remove the visual enclosure before retrying any failed rescue.
          this.retire(ride.monsterId);
          this.passenger = undefined;
          this.release(player, tick);
          continue;
        }
        // Walls are visual geometry; constrain the playable interior without blocks.
        if (Math.abs(at.side) > 2.1 || at.forward < -2.5 || at.y < -1.3 || at.y > -.5) {
          const yaw = ride.pose.rotation.y * Math.PI / 180;
          const forward = Math.max(-2.3, Math.min(7.6, at.forward));
          const side = Math.max(-2, Math.min(2, at.side));
          const target = {x: ride.pose.location.x - Math.sin(yaw) * forward + Math.cos(yaw) * side,
            y: ride.pose.location.y + Math.max(-1.2, Math.min(-.6, at.y)),
            z: ride.pose.location.z + Math.cos(yaw) * forward + Math.sin(yaw) * side};
          if (!player.tryTeleport(target, {checkForBlocks: true, keepVelocity: false})) {
            this.retire(ride.monsterId); this.passenger = undefined; this.release(player, tick);
          }
        }
        if (tick % 20 === 0) this.message(player,
          'Zum Maul schwimmen — ' + Math.max(0, Math.ceil(7.5 - at.forward)) + ' m. Schleichen: Notausgang.');
      } catch {
        // Never leave a player confined when their protection/API becomes unavailable.
        if (this.passenger?.playerId === player.id) {
          this.retire(this.passenger.monsterId); this.passenger = undefined;
        }
        this.warn(tick);
      }
    }
    if (this.villageMonster) {
      this.swallowVillageSwimmers(players, tick);
      return;
    }
    super.tick(tick);
    if (this.passenger || tick % 5 !== 0) return;
    for (const player of players) {
      try {
        if (player.dimension.id !== 'minecraft:overworld' || this.cooldowns.has(player.id)
          || isSubmarinePassenger(player)
          || player.getDynamicProperty(RETURN_PROPERTY) !== undefined
          || !['Survival', 'Adventure'].includes(player.getGameMode())) continue;
        for (const swimmer of this.swimmers.values()) {
          const age = tick - swimmer.group.born;
          if (age < 40 || age > 480) continue;
          const at = relativeToMaw(player.location, {
            location: swimmer.entity.location, rotation: swimmer.entity.getRotation(),
          });
          if (at.forward >= 6.5 && at.forward <= 9 && Math.abs(at.side) <= 2.1 && at.y >= -1.2 && at.y <= .6) {
            this.swallow(player, swimmer, tick);
            return;
          }
        }
      } catch { this.warn(tick); }
    }
  }
}
