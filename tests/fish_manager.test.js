import test from 'node:test';
import assert from 'node:assert/strict';
import {FishManager} from '../src/fish_manager.js';
import {FISH_SPECIES, DAY_FISH, NIGHT_FISH, MAX_FISH, MAX_FISH_GROUPS,
  FISH_LIFETIME_TICKS, fishPositionAt} from '../src/fish.js';
import {distanceSquared} from '../src/flight.js';
import {isFishPositionSafe} from '../src/water.js';

function fixture(playerCount = 1, spacing = 200) {
  let nextId = 0;
  const entities = new Map(), warnings = [];
  const pools = Array.from({length: playerCount}, (_, i) => i * spacing);
  const dim = {
    id: 'minecraft:overworld', heightRange: {min: -64, max: 320},
    loaded: true, medium: 'minecraft:water', liquidDepth: 0,
    spawnCount: 0, failSpawnAt: 0, failTeleportAt: 0,
    removalFails: false, blockTeleports: false, overrides: new Map(),
    getBlock({x, y, z}) {
      if (!this.loaded) return undefined;
      const inPool = pools.some(center => Math.abs(x - center) <= 20) && Math.abs(z) <= 20;
      let typeId = y < 48 ? 'minecraft:stone' : 'minecraft:air';
      if (inPool && y >= 48 && y <= 62) typeId = this.medium;
      typeId = this.overrides.get([x, y, z].join(',')) ?? typeId;
      return {typeId, location: {x, y, z}, isAir: typeId === 'minecraft:air',
        isWaterlogged: typeId === 'minecraft:oak_slab',
        permutation: {getState: name => name === 'liquid_depth' ? this.liquidDepth : undefined}};
    },
    getTopmostBlock({x, z}) { return this.getBlock({x, y: 62, z}); },
    getEntities({type}) {
      return [...entities.values()].filter(entity => entity.typeId === type && entity.dimension.id === this.id);
    },
    spawnEntity(typeId, location) {
      if (++this.spawnCount === this.failSpawnAt) throw new Error('Spawn failed');
      const number = ++nextId;
      const entity = {
        id: 'fish-' + number, typeId, dimension: dim, location: {...location}, valid: true, teleports: 0,
        tryTeleport(at, options) {
          if (!this.valid) throw new Error('Invalid entity');
          if (number === dim.failTeleportAt || dim.blockTeleports) return false;
          this.location = {...at}; this.options = options; this.teleports++;
          return true;
        },
        remove() {
          if (dim.removalFails) throw new Error('Temporarily unavailable');
          entities.delete(this.id); this.valid = false;
        },
      };
      entities.set(entity.id, entity);
      return entity;
    },
  };
  const world = {
    time: 6000,
    players: Array.from({length: playerCount}, (_, i) => ({id: 'p' + i, dimension: dim,
      location: {x: i * spacing, y: 64, z: 0}})),
    getTimeOfDay() { return this.time; },
    getDimension(id) { assert.equal(id, 'overworld'); return dim; },
    getPlayers() { return this.players; },
  };
  const manager = new FishManager(world, message => warnings.push(message));
  return {world, dim, manager, entities, warnings};
}

test('day pools receive two trout and two carp with separated initial positions', () => {
  const f = fixture(); f.manager.tick(0);
  assert.deepEqual([...f.entities.values()].map(entity => entity.typeId.split(':')[1]), DAY_FISH);
  assert.equal(f.manager.groups.size, 1);
  for (const entity of f.entities.values()) assert.ok(isFishPositionSafe(f.dim, entity.location));
  for (const species of ['trout', 'carp']) {
    const pair = [...f.entities.values()].filter(entity => entity.typeId.endsWith(':' + species));
    assert.ok(distanceSquared(pair[0].location, pair[1].location) > 1);
  }
});

test('fish swim on bounded continuous circles facing their horizontal movement', () => {
  const habitat = {x: -12.5, y: 58.8, z: 13.5, radius: 1.5};
  for (const species of FISH_SPECIES) for (const phase of [0, 1.7, 5.8]) {
    for (let tick = 0; tick < FISH_LIFETIME_TICKS; tick++) {
      const pose = fishPositionAt(species, habitat, tick / 20, phase);
      const next = fishPositionAt(species, habitat, (tick + 1) / 20, phase);
      for (const value of Object.values(pose.location)) assert.ok(Number.isFinite(value));
      assert.ok(Math.abs(distanceSquared(pose.location, habitat) - habitat.radius ** 2) < 1e-10);
      assert.ok(Math.abs(pose.location.y - habitat.y) <= .15 + 1e-10);
      const dx = next.location.x - pose.location.x, dz = next.location.z - pose.location.z;
      assert.ok(Math.hypot(dx, next.location.y - pose.location.y, dz) < .04);
      const yaw = pose.rotation.y * Math.PI / 180;
      assert.ok((-Math.sin(yaw) * dx + Math.cos(yaw) * dz) / Math.hypot(dx, dz) > .999);
    }
  }
});

test('school members remain separated for their entire lifetime instead of overtaking each other', () => {
  const habitat = {x: 0, y: 60, z: 0, radius: 1.5};
  for (const school of [DAY_FISH, NIGHT_FISH]) for (const phase of [0, 2, 5]) {
    for (let tick = 0; tick < FISH_LIFETIME_TICKS; tick++) {
      const positions = school.map((species, i) => fishPositionAt(species, habitat,
        tick / 20, phase + i * Math.PI * 2 / school.length).location);
      for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
        assert.ok(distanceSquared(positions[i], positions[j]) >= 1.6 ** 2,
          `${school[i]}/${school[j]} overlap at tick ${tick}`);
      }
    }
  }
});

test('night and dawn fish are pike, and activity changes replace the old group immediately', () => {
  const f = fixture(); f.manager.tick(0);
  const dayIds = [...f.entities.keys()];
  f.world.time = 11500; f.manager.tick(1);
  assert.ok(dayIds.every(id => !f.entities.has(id)));
  assert.deepEqual([...f.entities.values()].map(entity => entity.typeId.split(':')[1]), NIGHT_FISH);
  f.world.time = 0; f.manager.tick(2);
  assert.equal(f.entities.size, 2);
  f.world.time = 500; f.manager.tick(3);
  assert.deepEqual([...f.entities.values()].map(entity => entity.typeId.split(':')[1]), DAY_FISH);
});

test('absent, shallow, flowing, lava, waterlogged or unloaded water never receives fish', () => {
  const setups = [
    f => { f.dim.medium = 'minecraft:air'; },
    f => { f.dim.medium = 'minecraft:lava'; },
    f => { f.dim.medium = 'minecraft:oak_slab'; },
    f => { f.dim.medium = 'minecraft:kelp'; },
    f => { f.dim.liquidDepth = 3; },
    f => { f.dim.loaded = false; },
    f => {
      const original = f.dim.getBlock;
      f.dim.getBlock = function (at) {
        return at.y === 62 ? original.call(this, at)
          : {typeId: 'minecraft:stone', isAir: false, permutation: {getState: () => undefined}};
      };
    },
  ];
  for (const setup of setups) {
    const f = fixture(); setup(f); f.manager.tick(0);
    assert.equal(f.entities.size, 0);
    assert.equal(f.dim.spawnCount, 0);
    assert.equal(f.manager.groups.size, 0);
  }
});

test('underwater players receive fish without requiring air at the player position', () => {
  const f = fixture(); f.world.players[0].location.y = 57;
  f.manager.tick(0);
  assert.equal(f.entities.size, DAY_FISH.length);
});

test('water is checked again every tick and drained or changed pools retire all swimmers', () => {
  for (const medium of ['minecraft:air', 'minecraft:lava', 'minecraft:oak_slab']) {
    const f = fixture(); f.manager.tick(0);
    const fish = [...f.entities.values()];
    const teleports = fish.map(entity => entity.teleports);
    f.dim.medium = medium; f.manager.tick(1);
    assert.equal(f.entities.size, 0);
    assert.equal(f.manager.swimmers.size, 0);
    assert.equal(f.manager.groups.size, 0);
    assert.deepEqual(fish.map(entity => entity.teleports), teleports);
    f.dim.medium = 'minecraft:water'; f.manager.tick(100);
    assert.equal(f.entities.size, DAY_FISH.length);
  }
});

test('a fish moved out of water retires before being teleported back to its habitat', () => {
  const f = fixture(); f.manager.tick(0);
  const fish = [...f.entities.values()][0];
  fish.location = {x: 1000, y: 64, z: 1000};
  const teleports = fish.teleports;
  f.manager.tick(1);
  assert.equal(f.entities.has(fish.id), false);
  assert.equal(fish.teleports, teleports);
  assert.equal(f.entities.size, DAY_FISH.length - 1);
});

test('unsafe future positions and changed dimensions prevent another teleport', () => {
  for (const change of [
    f => { [...f.manager.groups.values()][0].habitat.x = 1000; },
    f => { for (const entity of f.entities.values()) entity.dimension = {id: 'minecraft:nether'}; },
  ]) {
    const f = fixture(); f.manager.tick(0);
    const fish = [...f.entities.values()], teleports = fish.map(entity => entity.teleports);
    change(f); f.manager.tick(1);
    assert.equal(f.entities.size, 0);
    assert.deepEqual(fish.map(entity => entity.teleports), teleports);
  }
});

test('unloaded or invalid entities retire without stopping later safe spawning', () => {
  const f = fixture(); f.manager.tick(0);
  [...f.entities.values()][0].valid = false; f.manager.tick(1);
  assert.equal(f.entities.size, DAY_FISH.length - 1);
  f.dim.loaded = false; f.manager.tick(2);
  assert.equal(f.entities.size, 0);
  f.dim.loaded = true; f.manager.tick(100);
  assert.equal(f.entities.size, DAY_FISH.length);
});

test('all movement teleports keep velocity disabled and block checks enabled', () => {
  const f = fixture(); f.manager.tick(0);
  for (let tick = 1; tick <= 60; tick++) {
    f.manager.tick(tick);
    assert.equal(f.entities.size, DAY_FISH.length);
    for (const entity of f.entities.values()) {
      assert.equal(entity.options.keepVelocity, false);
      assert.equal(entity.options.checkForBlocks, true);
      assert.ok(isFishPositionSafe(f.dim, entity.location));
    }
  }
});

test('nearby players share a school; day and night obey both independent fish caps', () => {
  const shared = fixture(6, 1); shared.manager.tick(0);
  assert.equal(shared.entities.size, DAY_FISH.length);
  for (const time of [6000, 18000]) {
    const f = fixture(10); f.world.time = time;
    for (let tick = 0; tick <= 2000; tick += 100) {
      f.manager.tick(tick);
      assert.equal(f.manager.groups.size, MAX_FISH_GROUPS);
      assert.equal(f.entities.size, time === 6000 ? MAX_FISH : NIGHT_FISH.length * MAX_FISH_GROUPS);
    }
  }
});

test('distant players take turns receiving fish after the global school cap is reached', () => {
  for (const time of [6000, 18000]) {
    const f = fixture(10); f.world.time = time;
    const served = new Set();
    for (let round = 0; round < 4; round++) {
      f.manager.tick(round * FISH_LIFETIME_TICKS);
      for (const group of f.manager.groups.values()) {
        const player = f.world.players.find(p => distanceSquared(p.location, group.habitat) < 20 ** 2);
        assert.ok(player); served.add(player.id);
      }
    }
    assert.equal(served.size, 10);
  }
});

test('bird and vanilla entities neither consume the fish budget nor get swept away', () => {
  const f = fixture(5);
  const others = [];
  for (let i = 0; i < 18; i++) others.push(f.dim.spawnEntity('lumen_birds:raven', {x: i, y: 80, z: 0}).id);
  for (const typeId of ['minecraft:salmon', 'minecraft:cod', 'other:trout']) {
    others.push(f.dim.spawnEntity(typeId, {x: 0, y: 60, z: 0}).id);
  }
  f.manager.tick(0);
  assert.equal(f.manager.swimmers.size, MAX_FISH);
  assert.ok(others.every(id => f.entities.has(id)));
  f.world.time = NaN; f.manager.tick(1);
  assert.equal(f.entities.size, others.length);
});

test('fish groups clean up after travel, player dimension changes and disconnects', () => {
  for (const change of [
    f => { f.world.players[0].location.x = 500; },
    f => { f.world.players[0].dimension = {id: 'minecraft:nether'}; },
    f => { f.world.players[0].dimension = {id: 'minecraft:the_end'}; },
    f => { f.world.players = []; },
  ]) {
    const f = fixture(); f.manager.tick(0); change(f); f.manager.tick(100);
    assert.equal(f.entities.size, 0);
    assert.equal(f.manager.groups.size, 0);
  }
});

test('fish groups expire and a reloaded manager removes previous session fish', () => {
  const f = fixture(); f.manager.tick(0);
  let oldIds = [...f.entities.keys()];
  f.manager.tick(FISH_LIFETIME_TICKS);
  assert.ok(oldIds.every(id => !f.entities.has(id)));
  assert.equal(f.entities.size, DAY_FISH.length);
  oldIds = [...f.entities.keys()];
  new FishManager(f.world).tick(1);
  assert.ok(oldIds.every(id => !f.entities.has(id)));
  assert.equal(f.entities.size, DAY_FISH.length);
});

test('failed partial fish spawns and initial teleports roll back without leaking entities', () => {
  for (const field of ['failSpawnAt', 'failTeleportAt']) {
    const f = fixture(); f.dim[field] = 3; f.manager.tick(0);
    assert.equal(f.entities.size, 0);
    assert.equal(f.manager.swimmers.size, 0);
    assert.equal(f.manager.groups.size, 0);
    f.dim[field] = 0; f.manager.tick(100);
    assert.equal(f.entities.size, DAY_FISH.length);
  }
});

test('failed fish rollback and failed activity cleanup count actual loaded orphans against the cap', () => {
  const f = fixture(8); f.dim.failSpawnAt = 4; f.dim.removalFails = true;
  f.manager.tick(0);
  assert.equal(f.entities.size, 11);
  assert.ok(f.entities.size <= MAX_FISH);
  f.world.time = 18000; f.manager.tick(1);
  assert.equal(f.entities.size, 11);
  assert.equal(f.manager.groups.size, 0);
  f.dim.removalFails = false; f.manager.tick(101);
  assert.equal(f.entities.size, NIGHT_FISH.length * MAX_FISH_GROUPS);
});

test('world failures are contained and warnings throttled; invalid times clean up fish', () => {
  const f = fixture(); const getTime = f.world.getTimeOfDay;
  f.world.getTimeOfDay = () => { throw new Error('World unavailable'); };
  for (let tick = 0; tick < 1200; tick++) assert.doesNotThrow(() => f.manager.tick(tick));
  assert.equal(f.warnings.length, 1);
  f.world.getTimeOfDay = getTime; f.manager.tick(1200);
  assert.equal(f.entities.size, DAY_FISH.length);
  for (const time of [NaN, Infinity]) {
    f.world.time = time; f.manager.tick(1201);
    assert.equal(f.entities.size, 0);
  }
});
