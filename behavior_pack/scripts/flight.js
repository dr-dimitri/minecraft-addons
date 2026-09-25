// All distances are blocks; time is seconds. No rendering or game API here.
export const SPECIES = Object.freeze(['raven', 'blue_tit', 'robin', 'goldfinch', 'eagle']);
export const FLOCK = Object.freeze(['raven', 'raven', 'blue_tit', 'robin', 'goldfinch', 'eagle']);
export const MAX_BIRDS = 18;
export const LIFETIME_TICKS = 900;
export const INTEREST_DISTANCE = 96;

export function isDay(ticks) {
  if (!Number.isFinite(ticks)) return false;
  const time = ((ticks % 24000) + 24000) % 24000;
  return time >= 500 && time < 11500;
}

export function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}

export function seedFor(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return (value >>> 0) / 4294967296;
}

export function positionAt(species, anchor, seconds, phase) {
  const eagle = species === 'eagle';
  const raven = species === 'raven';
  const speed = eagle ? 2 * Math.PI / 26 : raven ? 2 * Math.PI / 19 : 2 * Math.PI / 12;
  const angle = seconds * speed + phase;
  const radius = eagle ? 28 : raven ? 21 : 13;
  // Eagles circle. The smaller birds follow gently varying elliptical routes.
  const x = radius * Math.cos(angle);
  const z = (eagle ? radius : radius * .65) * Math.sin(angle);
  const altitude = eagle ? 34 : raven ? 23 : 13;
  const bob = (eagle ? 1 : raven ? 1.6 : 2.2) * Math.sin(angle * 2 + phase);
  const dx = -radius * speed * Math.sin(angle);
  const dz = (eagle ? radius : radius * .65) * speed * Math.cos(angle);
  return {
    location: {x: anchor.x + x, y: anchor.y + altitude + bob, z: anchor.z + z},
    rotation: {x: 0, y: Math.atan2(-dx, dz) * 180 / Math.PI},
  };
}
