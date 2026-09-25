// All distances are blocks; time is seconds. No rendering or game API here.
export const FLOCK = Object.freeze(['raven', 'raven', 'blue_tit', 'robin', 'goldfinch', 'eagle']);
export const NIGHT_FLOCK = Object.freeze(['owl', 'eagle_owl']);
export const SPECIES = Object.freeze([...new Set([...FLOCK, ...NIGHT_FLOCK])]);
export const MAX_BIRDS = 18;
export const MAX_GROUPS = 3;
export const LIFETIME_TICKS = 900;
export const INTEREST_DISTANCE = 96;

export function isDay(ticks) {
  if (!Number.isFinite(ticks)) return false;
  const time = ((ticks % 24000) + 24000) % 24000;
  return time >= 500 && time < 11500;
}

export function activityAt(ticks) {
  if (!Number.isFinite(ticks)) return undefined;
  return isDay(ticks) ? 'day' : 'night';
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

// One 40-second trip starts and ends on the same leaf block. Smooth acceleration
// keeps takeoff, the closed orbit and landing continuous at each boundary.
export function owlPositionAt(species, perch, seconds, phase = 0) {
  const time = ((seconds % 40) + 40) % 40;
  const smooth = value => value * value * (3 - 2 * value);
  let height = 0, angle = 0;
  const perched = time < 9 || time >= 35;
  if (time >= 9 && time < 15) height = smooth((time - 9) / 6);
  if (time >= 15 && time < 29) {
    height = 1;
    angle = Math.PI * 2 * smooth((time - 15) / 14);
  }
  if (time >= 29 && time < 35) height = 1 - smooth((time - 29) / 6);
  const radius = species === 'eagle_owl' ? 7 : 5;
  const x = radius * Math.sin(angle), z = radius * (1 - Math.cos(angle));
  const heading = angle + phase;
  return {
    location: {
      x: perch.x + x * Math.cos(phase) - z * Math.sin(phase),
      y: perch.y + (perch.cruiseY - perch.y) * height,
      z: perch.z + x * Math.sin(phase) + z * Math.cos(phase),
    },
    rotation: {x: 0, y: Math.atan2(-Math.cos(heading), Math.sin(heading)) * 180 / Math.PI},
    perched,
  };
}
