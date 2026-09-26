// Distances are blocks and time is seconds; no world or rendering API here.
export const FISH_SPECIES = Object.freeze(['trout', 'carp', 'pike']);
export const DAY_FISH = Object.freeze(['trout', 'trout', 'carp', 'carp']);
export const NIGHT_FISH = Object.freeze(['pike', 'pike']);
export const MAX_FISH = 12;
export const MAX_FISH_GROUPS = 3;
export const FISH_LIFETIME_TICKS = 900;
export const FISH_INTEREST_DISTANCE = 64;
export const FISH_GROUP_DISTANCE = 48;

export function fishPositionAt(species, habitat, seconds, phase = 0) {
  // A mixed daytime school shares one speed so its members keep their spacing.
  const period = species === 'pike' ? 20 : 24;
  const speed = 2 * Math.PI / period;
  const angle = seconds * speed + phase;
  const dx = -habitat.radius * speed * Math.sin(angle);
  const dz = habitat.radius * speed * Math.cos(angle);
  return {
    location: {
      x: habitat.x + habitat.radius * Math.cos(angle),
      y: habitat.y + .15 * Math.sin(angle * 2 + phase),
      z: habitat.z + habitat.radius * Math.sin(angle),
    },
    rotation: {x: 0, y: Math.atan2(-dx, dz) * 180 / Math.PI},
  };
}
