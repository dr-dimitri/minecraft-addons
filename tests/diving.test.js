import test from 'node:test';
import assert from 'node:assert/strict';
import {DivingAdventure, DIVING_SLOTS, SUBMARINE, SUBMARINE_SPEED, wearsDivingSuit,
  submarineStep, submarinePathIsWater} from '../src/diving.js';

function fixture() {
  const dimension = {id: 'minecraft:overworld', heightRange: {min: -64, max: 320},
    blocks: new Map(), reads: 0, loaded: true,
    getBlock(at) {
      this.reads++;
      if (!this.loaded) throw new Error('Chunk unavailable');
      const typeId = this.blocks.get([at.x, at.y, at.z].join(',')) ?? 'minecraft:water';
      return {typeId, permutation: {getState() { return 0; }}};
    },
    getEntities({type}) { assert.equal(type, SUBMARINE); return [boat]; },
  };
  const equipment = new Map();
  const player = {id: 'diver', typeId: 'minecraft:player', dimension,
    location: {x: 0, y: 45, z: 0}, effects: new Map(), isSneaking: false,
    movement: {x: 0, y: 1}, view: {x: 0, y: 0, z: 1},
    inputInfo: {getMovementVector: () => player.movement},
    getRotation() { return {x: 0, y: 0}; },
    getViewDirection() { return this.view; },
    getComponent(id) { assert.equal(id, 'minecraft:equippable'); return {getEquipment: slot => equipment.get(slot)}; },
    getEffect(id) { return this.effects.get(id); },
    addEffect(id, duration, options) { this.effects.set(id, {duration, amplifier: options.amplifier}); },
    onScreenDisplay: {setActionBar() {}},
  };
  const boat = {id: 'boat', typeId: SUBMARINE, dimension, location: {x: 0, y: 45, z: 0},
    riders: [player], impulses: [], stopped: 0,
    getComponent(id) { assert.equal(id, 'minecraft:rideable'); return {getRiders: () => this.riders}; },
    clearVelocity() { this.stopped++; },
    setRotation(rotation) { this.rotation = rotation; },
    applyImpulse(impulse) { this.impulses.push({...impulse}); },
  };
  const world = {players: [player], getPlayers() { return this.players; },
    getDimension(id) { assert.equal(id, 'overworld'); return dimension; }};
  const manager = new DivingAdventure(world);
  const equip = () => { for (const [slot, id] of Object.entries(DIVING_SLOTS)) equipment.set(slot, {typeId: id}); };
  return {world, dimension, player, boat, equipment, manager, equip};
}

test('helmet and air tanks supply breathing and vision without leggings or boots', () => {
  const f = fixture(); f.boat.riders = [];
  f.manager.tick(0); assert.equal(f.player.effects.size, 0);
  f.equip(); assert.equal(wearsDivingSuit(f.player), true);
  f.manager.tick(1);
  assert.equal(f.player.effects.get('water_breathing').duration, 300);
  assert.equal(f.player.effects.get('night_vision').duration, 600);
  f.equipment.delete('Feet'); f.equipment.delete('Legs'); f.player.effects.clear();
  f.manager.tick(2); assert.equal(f.player.effects.get('water_breathing')?.duration, 300);
  f.equipment.set('Feet', {typeId: 'minecraft:iron_boots'});
  assert.equal(wearsDivingSuit(f.player), true);
});

test('air supply requires the actual helmet and tanks in their armor slots', () => {
  for (const missing of ['Head', 'Chest']) {
    const f = fixture(); f.boat.riders = []; f.equip();
    f.equipment.delete(missing);
    f.manager.tick(0); assert.equal(f.player.effects.size, 0);
    f.equipment.set(missing, {typeId: missing === 'Head' ? 'minecraft:iron_helmet' : 'minecraft:iron_chestplate'});
    f.manager.tick(1); assert.equal(f.player.effects.size, 0);
    f.equipment.set('Mainhand', {typeId: DIVING_SLOTS[missing]});
    f.manager.tick(2); assert.equal(f.player.effects.size, 0);
  }
});

test('diving air supply remains active over time and resumes after milk and reload', () => {
  const f = fixture(); f.boat.riders = [];
  // Use actual slot and item identifiers independently of the controller mapping.
  f.equipment.set('Head', {typeId: 'lumen_birds:diving_helmet'});
  f.equipment.set('Chest', {typeId: 'lumen_birds:diving_chestplate'});
  for (let tick = 0; tick < 1500; tick++) {
    if (tick === 400) f.player.effects.clear();
    if (tick === 800) f.manager = new DivingAdventure(f.world);
    f.manager.tick(tick);
    for (const name of ['water_breathing', 'night_vision']) {
      const effect = f.player.effects.get(name);
      assert.ok(effect?.duration > 1, name + ' must not expire while equipped');
      effect.duration--;
    }
  }
  f.equipment.delete('Chest');
  for (let tick = 1500; tick < 2200; tick++) {
    for (const [name, effect] of f.player.effects) if (--effect.duration <= 0) f.player.effects.delete(name);
    f.manager.tick(tick);
  }
  assert.equal(f.player.effects.size, 0, 'Protection expires after removing the tanks');
});

test('longer and stronger external effects are preserved and removed equipment stops refreshing', () => {
  const f = fixture(); f.boat.riders = []; f.equip();
  f.player.effects.set('water_breathing', {duration: 3000, amplifier: 0});
  f.player.effects.set('night_vision', {duration: 20, amplifier: 1});
  f.manager.tick(0);
  assert.deepEqual(f.player.effects.get('water_breathing'), {duration: 3000, amplifier: 0});
  assert.deepEqual(f.player.effects.get('night_vision'), {duration: 20, amplifier: 1});
  f.equipment.clear();
  f.player.effects.set('water_breathing', {duration: 10, amplifier: 0});
  f.manager.tick(1); assert.equal(f.player.effects.get('water_breathing').duration, 10);
});

test('movement input steers forward, backward, sideways and vertically by view direction', () => {
  const f = fixture();
  for (const [movement, view, expected] of [
    [{x: 0, y: 1}, {x: 0, y: 0, z: 1}, {x: 0, y: 0, z: SUBMARINE_SPEED}],
    [{x: 0, y: -1}, {x: 0, y: 0, z: 1}, {x: 0, y: 0, z: -SUBMARINE_SPEED}],
    [{x: 1, y: 0}, {x: 0, y: 0, z: 1}, {x: SUBMARINE_SPEED, y: 0, z: 0}],
    [{x: 0, y: 1}, {x: 0, y: -1, z: 0}, {x: 0, y: -SUBMARINE_SPEED, z: 0}],
  ]) {
    f.player.movement = movement; f.player.view = view;
    const delta = submarineStep(f.player).delta;
    for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(delta[axis] - expected[axis]) < 1e-10);
  }
  f.player.movement = {x: 1, y: 1}; f.player.view = {x: 0, y: 0, z: 1};
  const delta = submarineStep(f.player).delta;
  assert.ok(Math.abs(Math.hypot(delta.x, delta.y, delta.z) - SUBMARINE_SPEED) < 1e-10);
});

test('boarding protects before propulsion and stopping clears native velocity', () => {
  const f = fixture();
  f.boat.applyImpulse = impulse => {
    assert.ok(f.player.effects.has('water_breathing'));
    f.boat.impulses.push(impulse);
  };
  f.manager.tick(0); assert.equal(f.boat.impulses.length, 1);
  f.player.movement = {x: 0, y: 0}; f.manager.tick(1);
  assert.deepEqual(f.boat.impulses.at(-1), {x: 0, y: 0, z: 0});
  f.boat.riders = []; f.manager.tick(2);
  assert.equal(f.boat.impulses.length, 2); assert.equal(f.boat.stopped, 3);
});

test('the complete hull and swept movement reject solid blocks, lava, air and unloaded chunks', () => {
  const f = fixture();
  assert.equal(submarinePathIsWater(f.dimension, {x: 0, y: 45, z: 0}, {x: 0, y: 0, z: .16}), true);
  for (const material of ['minecraft:stone', 'minecraft:lava', 'minecraft:air', 'minecraft:oak_stairs']) {
    f.dimension.blocks.set('2,47,2', material); f.boat.impulses = [];
    f.manager.tick(1); assert.equal(f.boat.impulses.length, 0, material);
    assert.ok(f.player.effects.has('water_breathing'));
  }
  f.dimension.blocks.clear(); f.dimension.loaded = false; f.manager.tick(2);
  assert.equal(f.boat.impulses.length, 0);
  f.dimension.loaded = true; f.manager.tick(3);
  assert.equal(f.boat.impulses.length, 1);
});

test('water checks are fresh each tick and include the leading sweep edge', () => {
  const f = fixture(); f.boat.location.z = .4;
  f.manager.tick(0); assert.equal(f.boat.impulses.length, 1);
  // Old envelope ends at 2.9; next position reaches 3.06.
  f.dimension.blocks.set('0,45,3', 'minecraft:stone');
  f.manager.tick(1); assert.equal(f.boat.impulses.length, 1);
  f.dimension.blocks.clear(); f.manager.tick(2); assert.equal(f.boat.impulses.length, 2);
});

test('reload resumes a native mounted vehicle without duplicate spawning or player locks', () => {
  const f = fixture(); f.manager.tick(0);
  const reloaded = new DivingAdventure(f.world); reloaded.tick(1);
  assert.equal(f.boat.impulses.length, 2); assert.equal(f.boat.riders[0], f.player);
  f.player.isSneaking = true; reloaded.tick(2); assert.equal(f.boat.impulses.length, 2);
});

test('disconnects and dimension changes do not steer or refresh protection', () => {
  const f = fixture(); f.manager.tick(0);
  f.player.effects.clear(); f.world.players = []; f.manager.tick(1);
  assert.equal(f.boat.impulses.length, 1); assert.equal(f.player.effects.size, 0);
  f.world.players = [f.player]; f.player.dimension = {id: 'minecraft:nether'}; f.manager.tick(2);
  assert.equal(f.boat.impulses.length, 1); assert.equal(f.player.effects.size, 0);
  assert.equal(f.boat.stopped, 3, 'A remaining loaded boat must stop when its pilot leaves');
});

test('invalid controller input stops propulsion without removing passenger breathing', () => {
  const f = fixture();
  f.player.movement = {x: NaN, y: 1}; f.manager.tick(0);
  assert.equal(f.boat.impulses.length, 0); assert.ok(f.player.effects.has('water_breathing'));
  f.player.inputInfo.getMovementVector = () => { throw new Error('Disconnected'); };
  f.manager.tick(1); assert.equal(f.boat.impulses.length, 0); assert.ok(f.boat.stopped >= 2);
});

test('constructor does not access world during early module initialization', () => {
  const world = {getPlayers() { throw new Error('early world access'); },
    getDimension() { throw new Error('early world access'); }};
  assert.doesNotThrow(() => new DivingAdventure(world));
});
