import {waterVolume} from './water.js';

export const SUBMARINE = 'lumen_birds:submarine';
export const DIVING_SLOTS = Object.freeze({
  Head: 'lumen_birds:diving_helmet',
  Chest: 'lumen_birds:diving_chestplate',
  Legs: 'lumen_birds:diving_leggings',
  Feet: 'lumen_birds:diving_boots',
});
export const SUBMARINE_RADIUS = 2.5;
export const SUBMARINE_HEIGHT = 2.3;
export const SUBMARINE_SPEED = .16;

export function isSubmarinePassenger(player) {
  return player.getComponent('minecraft:riding')?.entityRidingOn?.typeId === SUBMARINE;
}

export function wearsDivingSuit(player) {
  const equipment = player.getComponent('minecraft:equippable');
  return equipment !== undefined && Object.entries(DIVING_SLOTS).every(
    ([slot, item]) => equipment.getEquipment(slot)?.typeId === item);
}

function refreshEffect(player, name, duration) {
  const effect = player.getEffect(name);
  // Keep stronger or longer effects supplied by potions/other add-ons. We never
  // remove an effect on dismount: a short grace period remains for the swimmer.
  if (!effect || (effect.amplifier === 0 && effect.duration < duration / 2)) {
    player.addEffect(name, duration, {amplifier: 0, showParticles: false});
  }
}

export function protectDiver(player) {
  refreshEffect(player, 'water_breathing', 300);
  refreshEffect(player, 'night_vision', 600);
}

export function submarineStep(player) {
  const input = player.inputInfo.getMovementVector();
  const look = player.getViewDirection();
  if (![input.x, input.y, look.x, look.y, look.z].every(Number.isFinite)) return undefined;
  const forward = Math.max(-1, Math.min(1, input.y));
  const sideways = Math.max(-1, Math.min(1, input.x));
  const horizontal = Math.hypot(look.x, look.z);
  const yaw = horizontal > .001 ? Math.atan2(-look.x, look.z) : player.getRotation().y * Math.PI / 180;
  const length = Math.hypot(look.x, look.y, look.z);
  if (!Number.isFinite(yaw) || length < .001) return undefined;
  const direction = {
    x: look.x / length * forward + Math.cos(yaw) * sideways,
    y: look.y / length * forward,
    z: look.z / length * forward + Math.sin(yaw) * sideways,
  };
  const scale = SUBMARINE_SPEED / Math.max(1, Math.hypot(direction.x, direction.y, direction.z));
  return {delta: {x: direction.x * scale, y: direction.y * scale, z: direction.z * scale},
    yaw: yaw * 180 / Math.PI};
}

export function submarinePathIsWater(dimension, position, delta, cache = new Map()) {
  const center = {x: position.x + delta.x / 2, y: position.y + delta.y / 2, z: position.z + delta.z / 2};
  return waterVolume(dimension, center,
    SUBMARINE_RADIUS + Math.max(Math.abs(delta.x), Math.abs(delta.z)) / 2,
    SUBMARINE_HEIGHT + Math.abs(delta.y) / 2, cache);
}

export class DivingAdventure {
  constructor(world, warn = () => {}) {
    this.world = world;
    this.warn = warn;
    this.warned = false;
  }

  tick(tick) {
    let players;
    try { players = this.world.getPlayers(); } catch { return; }
    const eligible = new Map();
    for (const player of players) {
      try {
        if (player.dimension.id !== 'minecraft:overworld') continue;
        eligible.set(player.id, player);
        if (wearsDivingSuit(player)) protectDiver(player);
      } catch { /* A disconnect or equipment transition is retried next tick. */ }
    }
    let dimension, submarines;
    try {
      dimension = this.world.getDimension('overworld');
      submarines = dimension.getEntities({type: SUBMARINE});
    } catch { return; }
    // No retained entity/player references, input locks or teleport anchors:
    // native mounts survive save/reload; disconnects and dimension changes do
    // not require restoring controller-owned player state.
    const cache = new Map();
    for (const submarine of submarines) {
      try {
        submarine.clearVelocity();
        const riders = submarine.getComponent('minecraft:rideable')?.getRiders() ?? [];
        const pilot = riders[0];
        if (!pilot || !eligible.has(pilot.id)) continue;
        // Effects precede movement so a newly boarded player is protected even
        // if input reading, collision checks or movement fail below.
        for (const rider of riders) if (eligible.has(rider.id)) protectDiver(rider);
        if (pilot.isSneaking) continue; // Bedrock handles normal dismounting.
        const step = submarineStep(pilot);
        if (!step) continue;
        if (submarinePathIsWater(dimension, submarine.location, step.delta, cache)) {
          submarine.setRotation({x: 0, y: step.yaw});
          submarine.applyImpulse(step.delta);
        }
        if (tick % 40 === 0) pilot.onScreenDisplay.setActionBar(
          'U-Boot · Bewegen + Blick: steuern/tauchen · Schleichen: aussteigen');
      } catch (error) {
        // A missing chunk stops the boat. Never deliberately load chunks or
        // delete a parked collectible, including after script reload.
        try { submarine.clearVelocity(); } catch { /* Entity has unloaded. */ }
        if (!this.warned) { this.warned = true; this.warn('Lumen U-Boot: ' + String(error)); }
      }
    }
  }
}
