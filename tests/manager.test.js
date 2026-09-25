import test from 'node:test';
import assert from 'node:assert/strict';
import {BirdManager} from '../src/manager.js';
import {FLOCK, NIGHT_FLOCK, MAX_BIRDS, LIFETIME_TICKS, isDay, activityAt,
  positionAt, owlPositionAt, distanceSquared} from '../src/flight.js';

function fixture(playerCount = 1, spacing = 200) {
  let nextId = 0;
  const entities = new Map();
  const warnings = [];
  const dim = {
    id: 'minecraft:overworld', heightRange: {min: -64, max: 320},
    surface: 63, loaded: true, air: true, spawnCount: 0, failSpawnAt: 0, failTeleportAt: 0,
    removalFails: false, blockTeleports: false, failProperty: false, trees: new Map(), blocked: new Set(),
    getTopmostBlock({x, z}) {
      if (!this.loaded) throw new Error('Unloaded chunk');
      const tree = this.trees.get(x + ',' + z);
      return {location: {x, y: tree?.y ?? this.surface, z}, typeId: tree?.typeId ?? 'minecraft:stone'};
    },
    getBlock({x, y, z}) {
      if (!this.loaded) return undefined;
      const tree = this.trees.get(x + ',' + z);
      if (tree?.y === y) return {isAir: false, typeId: tree.typeId};
      if (this.blocked.has([x, y, z].join(','))) return {isAir: false, typeId: 'minecraft:stone'};
      return {isAir: this.air, typeId: this.air ? 'minecraft:air' : 'minecraft:stone'};
    },
    getEntities({type}) { return [...entities.values()].filter(e => e.typeId === type); },
    spawnEntity(typeId, location) {
      if (++this.spawnCount === this.failSpawnAt) throw new Error('Spawn failed');
      const entity = {
        id: 'bird-' + ++nextId, typeId, location, teleports: 0, valid: true, properties: {}, propertyWrites: 0,
        setProperty(name, value) {
          if (dim.failProperty || !this.valid) throw new Error('Property unavailable');
          this.properties[name] = value; this.propertyWrites++;
        },
        tryTeleport(at, options) {
          if (!this.valid) throw new Error('Invalid entity');
          if (nextId === dim.failTeleportAt || dim.blockTeleports) return false;
          this.location = at; this.options = options; this.teleports++;
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
  const manager = new BirdManager(world, message => warnings.push(message));
  return {world, dim, manager, entities, warnings};
}

test('daylight excludes dawn, dusk and all of night', () => {
  for (const t of [0, 499, 11500, 18000, 23999, NaN, Infinity, -1]) assert.equal(isDay(t), false);
  for (const t of [500, 6000, 11499, 30000]) assert.equal(isDay(t), true);
});

function plantTrees(f) {
  for (const player of f.world.players) for (const dx of [-4, 4]) {
    f.dim.trees.set((player.location.x + dx) + ',0', {y: 70, typeId: 'minecraft:oak_leaves'});
  }
}

test('owls cover dusk, night and dawn, while invalid world times never spawn birds', () => {
  for (const time of [0, 499, 11500, 18000, 23999, -1]) assert.equal(activityAt(time), 'night');
  for (const time of [500, 6000, 11499, 30000]) assert.equal(activityAt(time), 'day');
  for (const time of [NaN, Infinity]) {
    assert.equal(activityAt(time), undefined);
    const f = fixture(); plantTrees(f); f.world.time = time; f.manager.tick(0);
    assert.equal(f.entities.size, 0);
  }
});

test('a night group has an owl and eagle owl, with a seated and flying bird', () => {
  for (const time of [0, 11500, 18000]) {
    const f = fixture(); plantTrees(f); f.world.time = time; f.manager.tick(0);
    assert.deepEqual([...f.entities.values()].map(e => e.typeId.split(':')[1]), NIGHT_FLOCK);
    assert.deepEqual([...f.entities.values()].map(e => e.properties['lumen_birds:perched']), [true, false]);
    const owl = [...f.entities.values()][0];
    assert.equal(owl.location.y, 71.02);
  }
});

test('night birds require two clear leaf perches and do not spawn below roofs or underground', () => {
  for (const setup of [() => {}, f => { plantTrees(f); f.dim.surface = 66; },
    f => { plantTrees(f); f.dim.trees.delete('-4,0'); },
    f => { plantTrees(f); f.dim.trees.get('-4,0').typeId = 'minecraft:stone'; },
    f => { plantTrees(f); f.dim.blocked.add('-4,72,0'); },
    f => { plantTrees(f); f.dim.loaded = false; },
    f => { plantTrees(f); for (const tree of f.dim.trees.values()) tree.y = 315; },
    f => { plantTrees(f); f.dim.trees.set('0,0', {y: 75, typeId: 'minecraft:oak_leaves'});
      f.dim.blocked.add('0,68,0'); }]) {
    const f = fixture(); setup(f); f.world.time = 18000; f.manager.tick(0);
    assert.equal(f.entities.size, 0); assert.equal(f.manager.groups.size, 0);
  }
});

test('players below a tree canopy can see night birds', () => {
  const f = fixture(); plantTrees(f);
  f.dim.trees.set('0,0', {y: 73, typeId: 'minecraft:birch_leaves'});
  f.world.time = 18000; f.manager.tick(0);
  assert.equal(f.entities.size, 2);
});

test('a single small tree crown provides two perches even with only one coarse grid hit', () => {
  const f = fixture();
  for (let x = 2; x <= 6; x++) for (let z = 2; z <= 6; z++) {
    f.dim.trees.set(x + ',' + z, {y: 70, typeId: 'minecraft:oak_leaves'});
  }
  f.world.time = 18000; f.manager.tick(0);
  assert.equal(f.entities.size, 2);
  const perches = [...f.manager.flights.values()].map(flight => flight.perch);
  assert.ok(distanceSquared(...perches) >= 4);
});

test('owl takeoff, closed flight and landing stay continuous and return to the same perch', () => {
  const perch = {x: 10.5, y: 71.02, z: -8.5, cruiseY: 95};
  for (const species of NIGHT_FLOCK) for (const phase of [0, 2, 5]) {
    let previous = owlPositionAt(species, perch, 0, phase);
    for (let tick = 1; tick <= 1600; tick++) {
      const pose = owlPositionAt(species, perch, tick / 20, phase);
      const delta = Math.hypot(...['x', 'y', 'z'].map(key => pose.location[key] - previous.location[key]));
      assert.ok(delta < .5, `${species} at ${tick}: ${delta}`);
      if (pose.perched) assert.deepEqual(pose.location, {x: perch.x, y: perch.y, z: perch.z});
      assert.ok(pose.location.y >= perch.y && pose.location.y <= perch.cruiseY);
      previous = pose;
    }
  }
});

test('perch animation state follows landings and takeoffs without being rewritten every tick', () => {
  const f = fixture(); plantTrees(f); f.world.time = 18000; f.manager.tick(0);
  const owl = [...f.entities.values()][0];
  for (let tick = 1; tick <= 800; tick++) {
    f.manager.tick(tick);
    assert.equal(owl.properties['lumen_birds:perched'], tick < 180 || tick >= 700);
    assert.equal(f.entities.size, 2);
  }
  assert.equal(owl.propertyWrites, 3);
});

test('removed leaves and blocked perches retire their owls instead of leaving them floating', () => {
  for (const change of [f => f.dim.trees.clear(), f => f.dim.blocked.add('-4,71,0')]) {
    const f = fixture(); plantTrees(f); f.world.time = 18000; f.manager.tick(0);
    const first = [...f.entities.keys()][0]; change(f); f.manager.tick(20);
    assert.equal(f.entities.has(first), false);
  }
});

test('day and night groups replace each other immediately, preserving the global cap', () => {
  const f = fixture(8); plantTrees(f); f.manager.tick(0);
  assert.equal(f.entities.size, 18);
  f.world.time = 11500; f.manager.tick(1);
  assert.equal(f.entities.size, 6);
  assert.ok([...f.entities.values()].every(e => NIGHT_FLOCK.includes(e.typeId.split(':')[1])));
  f.world.time = 500; f.manager.tick(2);
  assert.equal(f.entities.size, 18);
  assert.ok([...f.entities.values()].every(e => FLOCK.includes(e.typeId.split(':')[1])));
});

test('unremovable day birds count against the night limit until cleanup succeeds', () => {
  const f = fixture(5); plantTrees(f); f.manager.tick(0);
  f.dim.removalFails = true; f.world.time = 11500; f.manager.tick(1);
  assert.equal(f.entities.size, MAX_BIRDS); assert.equal(f.manager.groups.size, 0);
  f.dim.removalFails = false; f.manager.tick(101);
  assert.equal(f.entities.size, 6);
});

test('night groups clean up on reload, dimension change, disconnect and failed property writes', () => {
  const f = fixture(); plantTrees(f); f.world.time = 18000; f.manager.tick(0);
  const oldIds = [...f.entities.keys()];
  const reloaded = new BirdManager(f.world); reloaded.tick(1);
  assert.ok(oldIds.every(id => !f.entities.has(id))); assert.equal(f.entities.size, 2);
  f.world.players[0].dimension = {id: 'minecraft:nether'}; reloaded.tick(101);
  assert.equal(f.entities.size, 0);
  f.world.players[0].dimension = f.dim; f.dim.failProperty = true; reloaded.tick(201);
  assert.equal(f.entities.size, 0);
  f.dim.failProperty = false; reloaded.tick(301); assert.equal(f.entities.size, 2);
  f.world.players = []; reloaded.tick(401); assert.equal(f.entities.size, 0);
});

test('one outdoor player gets two ravens, three songbirds and one eagle', () => {
  const f = fixture(); f.manager.tick(0);
  assert.deepEqual([...f.entities.values()].map(e => e.typeId.split(':')[1]), FLOCK);
  const ravens = [...f.entities.values()].filter(e => e.typeId.endsWith(':raven'));
  assert.ok(distanceSquared(ravens[0].location, ravens[1].location) > 10 ** 2);
  assert.equal(f.manager.groups.size, 1);
});

test('each species follows a finite, bounded route, facing its direction of travel', () => {
  const anchor = {x: -120, y: 80, z: 211};
  for (const species of new Set(FLOCK)) for (let seconds = 0; seconds < 45; seconds += .31) {
    const pose = positionAt(species, anchor, seconds, 2);
    const next = positionAt(species, anchor, seconds + .001, 2);
    for (const value of Object.values(pose.location)) assert.ok(Number.isFinite(value));
    assert.ok(distanceSquared(pose.location, anchor) <= 28 ** 2 + 1e-8);
    assert.ok(pose.location.y > anchor.y + 10 && pose.location.y < anchor.y + 36);
    const yaw = pose.rotation.y * Math.PI / 180;
    const dx = next.location.x - pose.location.x, dz = next.location.z - pose.location.z;
    assert.ok((-Math.sin(yaw) * dx + Math.cos(yaw) * dz) / Math.hypot(dx, dz) > .999);
  }
  const a = positionAt('eagle', anchor, 0, .1), b = positionAt('eagle', anchor, 26, .1);
  assert.ok(distanceSquared(a.location, b.location) < 1e-16);
});

test('per-tick motion stays below half a block and uses non-colliding destinations', () => {
  const f = fixture(); f.manager.tick(0);
  for (let tick = 1; tick < 80; tick++) {
    const before = new Map([...f.entities].map(([id, e]) => [id, e.location]));
    f.manager.tick(tick);
    for (const [id, e] of f.entities) {
      assert.ok(distanceSquared(before.get(id), e.location) < .25);
      assert.equal(e.options.checkForBlocks, true);
      assert.equal(e.options.keepVelocity, false);
    }
  }
});

test('nearby players share a group; distant players cannot exceed 18 loaded birds', () => {
  const shared = fixture(8, 1); shared.manager.tick(0);
  assert.equal(shared.entities.size, 6);
  const distant = fixture(10); distant.manager.tick(0);
  assert.equal(distant.entities.size, MAX_BIRDS);
  for (let tick = 100; tick <= 2500; tick += 100) {
    distant.manager.tick(tick); assert.ok(distant.entities.size <= MAX_BIRDS);
  }
});

test('replacement groups rotate through distant players when the loaded bird cap is reached', () => {
  const f = fixture(10);
  const visited = new Set();
  for (let round = 0; round < 4; round++) {
    f.manager.tick(round * LIFETIME_TICKS);
    assert.equal(f.entities.size, MAX_BIRDS);
    for (const group of f.manager.groups.values()) visited.add(group.anchor.x);
  }
  assert.deepEqual([...visited].sort((a, b) => a - b), f.world.players.map(p => p.location.x));
});

test('allocation continues with the next player when the last served player disconnects', () => {
  const f = fixture(5); f.manager.tick(0);
  f.world.players = f.world.players.filter(p => p.id !== 'p2');
  f.manager.tick(LIFETIME_TICKS);
  assert.deepEqual([...f.manager.groups.values()].map(g => g.anchor.x), [600, 800, 0]);
});

test('night removes managed birds on the next tick and does not touch vanilla or other add-ons', () => {
  const f = fixture();
  f.dim.spawnEntity('minecraft:parrot', {x: 1, y: 65, z: 0});
  f.dim.spawnEntity('other:raven', {x: 2, y: 65, z: 0});
  f.manager.tick(0); assert.equal(f.entities.size, 8);
  f.world.time = 11500; f.manager.tick(1);
  assert.equal(f.entities.size, 2); assert.equal(f.manager.groups.size, 0);
  f.manager.tick(100); assert.equal(f.entities.size, 2);
  f.world.time = 6000; f.manager.tick(200); assert.equal(f.entities.size, 8);
});

test('no spawning under a roof, underground, beyond build height or into unloaded/occupied sky', () => {
  for (const setup of [f => f.dim.surface = 80, f => f.dim.surface = 318,
    f => f.dim.loaded = false, f => f.dim.air = false,
    f => f.dim.getTopmostBlock = () => undefined]) {
    const f = fixture(); setup(f); f.manager.tick(0);
    assert.equal(f.entities.size, 0); assert.equal(f.manager.groups.size, 0);
  }
});

test('a normal two-block-high ceiling prevents spawning, including while jumping under it', () => {
  for (const feetY of [64, 64.19]) {
    const f = fixture();
    f.world.players[0].location.y = feetY;
    f.dim.surface = 66;
    f.manager.tick(0);
    assert.equal(f.entities.size, 0);
    assert.equal(f.manager.groups.size, 0);
  }
});

test('no birds are spawned in Nether or End; leaving Overworld cleans up the group', () => {
  for (const name of ['nether', 'the_end']) {
    const f = fixture(); f.manager.tick(0);
    f.world.players[0].dimension = {id: 'minecraft:' + name}; f.manager.tick(100);
    assert.equal(f.entities.size, 0);
  }
});

test('travel and disconnect remove old groups within a reconciliation interval', () => {
  const f = fixture(); f.manager.tick(0);
  const oldIds = [...f.entities.keys()]; f.world.players[0].location.x = 500;
  f.manager.tick(100);
  assert.ok(oldIds.every(id => !f.entities.has(id))); assert.equal(f.entities.size, 6);
  f.world.players = []; f.manager.tick(200); assert.equal(f.entities.size, 0);
});

test('groups retire after 45 seconds and are replaced without accumulating birds', () => {
  const f = fixture(); f.manager.tick(0); const oldIds = [...f.entities.keys()];
  f.manager.tick(LIFETIME_TICKS);
  assert.ok(oldIds.every(id => !f.entities.has(id))); assert.equal(f.entities.size, 6);
});

test('new manager cleans up a previous script session before creating its group', () => {
  const f = fixture(); f.manager.tick(0); const oldIds = [...f.entities.keys()];
  new BirdManager(f.world).tick(1);
  assert.equal(f.entities.size, 6); assert.ok(oldIds.every(id => !f.entities.has(id)));
});

test('failed partial spawns and failed initial teleports roll back the entire group', () => {
  for (const field of ['failSpawnAt', 'failTeleportAt']) {
    const f = fixture(); f.dim[field] = 3; f.manager.tick(0);
    assert.equal(f.entities.size, 0); assert.equal(f.manager.groups.size, 0);
    assert.equal(f.manager.flights.size, 0);
    f.dim[field] = 0; f.manager.tick(100); assert.equal(f.entities.size, 6);
  }
});

test('an unremovable partial group is counted against the cap for the next players', () => {
  const f = fixture(8); f.dim.failSpawnAt = 6; f.dim.removalFails = true;
  f.manager.tick(0);
  assert.equal(f.entities.size, 17); assert.ok(f.entities.size <= MAX_BIRDS);
  f.dim.removalFails = false; f.manager.tick(100); assert.equal(f.entities.size, 18);
});

test('blocked or invalid entities retire without breaking other birds or the scheduler', () => {
  const f = fixture(); f.manager.tick(0);
  [...f.entities.values()][0].valid = false; f.manager.tick(1); assert.equal(f.entities.size, 5);
  f.dim.blockTeleports = true; f.manager.tick(2); assert.equal(f.entities.size, 0);
  f.dim.blockTeleports = false; f.manager.tick(100); assert.equal(f.entities.size, 6);
});

test('world API failures are contained, warnings throttled, and later ticks recover', () => {
  const f = fixture(); const original = f.world.getTimeOfDay;
  f.world.getTimeOfDay = () => { throw new Error('World not available'); };
  for (let tick = 0; tick < 1200; tick++) assert.doesNotThrow(() => f.manager.tick(tick));
  assert.equal(f.warnings.length, 1);
  f.world.getTimeOfDay = original; f.manager.tick(1200); assert.equal(f.entities.size, 6);
});
