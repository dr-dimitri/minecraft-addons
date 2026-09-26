import {world, system, ItemStack} from '@minecraft/server';
import {BirdManager} from './manager.js';
import {FishManager} from './fish_manager.js';
import {MonsterEncounter} from './monster_encounter.js';
import {DivingAdventure} from './diving.js';
import {OceanVillage} from './ocean_village.js';
import {ADVENTURE_WORLD} from './world_settings.js';
import {MutantFishManager} from './mutant_fish.js';
import {BellyRooms} from './belly_rooms.js';
import {VillageFeast} from './village_feast.js';

const manager = new BirdManager(world, message => console.warn(message));
const fish = new FishManager(world, message => console.warn(message));
const belly = new BellyRooms(world, {report: message => console.warn(message)});
const seaMonster = new MonsterEncounter(world, message => console.warn(message), {bellyRooms: belly});
const diving = new DivingAdventure(world, message => console.warn(message));
const mutants = new MutantFishManager(world, message => console.warn(message));
const village = new OceanVillage(world, {
  makeItemStack: (identifier, amount) => new ItemStack(identifier, amount),
  report: message => console.warn(message),
});
if (ADVENTURE_WORLD) village.activate();
const feast = new VillageFeast(world, village, seaMonster, belly, {report: message => console.warn(message)});
// World access begins on a scheduled tick, not during module initialization.
system.runInterval(() => {
  village.tick(system.currentTick);
  belly.tick(system.currentTick, ADVENTURE_WORLD);
  diving.tick(system.currentTick);
  if (ADVENTURE_WORLD) mutants.tick(system.currentTick, true);
  manager.tick(system.currentTick);
  fish.tick(system.currentTick);
  seaMonster.tick(system.currentTick);
  if (ADVENTURE_WORLD) feast.tick(system.currentTick, true);
}, 1);
