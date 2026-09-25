import {world, system} from '@minecraft/server';
import {BirdManager} from './manager.js';

const manager = new BirdManager(world, message => console.warn(message));
// World access begins on a scheduled tick, not during module initialization.
system.runInterval(() => manager.tick(system.currentTick), 1);
