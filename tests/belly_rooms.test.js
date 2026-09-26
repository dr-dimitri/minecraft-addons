import test from 'node:test';
import assert from 'node:assert/strict';
import {BellyRooms, BELLY_BATCH_SIZE, BELLY_BLOCK_COUNT, BELLY_Y_OFFSET,
  bellyBlock, bellyProperty, bellyStoreProperty} from '../src/belly_rooms.js';
import {VILLAGE_SITES, villageBlocks} from '../src/ocean_village.js';

const coordinate = at => `${Math.floor(at.x)},${Math.floor(at.y)},${Math.floor(at.z)}`;
const first = VILLAGE_SITES[0];

function fixture() {
  const properties = new Map(), blocks = new Map(), inventories = new Map(), writes = [];
  let calls = 0, tick = 0;
  const dimension = {id: 'minecraft:overworld', loaded: () => true, failWrite: () => false,
    getBlock(at) {
      calls++;
      if (!this.loaded(at)) throw new Error('Unloaded chunk');
      const location = coordinate(at), record = blocks.get(location)
        ?? {type: at.y < -38 ? 'minecraft:deepslate' : at.y <= 62 ? 'minecraft:water' : 'minecraft:air', states: {}};
      const set = (type, states) => {
        if (dimension.failWrite(at, type)) throw new Error('Block update unavailable');
        blocks.set(location, {type, states: {...states}});
        writes.push({tick, location: {...at}, type, states: {...states}});
      };
      return {typeId: record.type, isAir: record.type === 'minecraft:air',
        permutation: {type: {id: record.type}, getAllStates: () => ({...record.states})},
        setType(type) { set(type, {}); },
        setPermutation(permutation) { set(permutation.type.id, permutation.getAllStates()); },
        getComponent(id) {
          assert.equal(id, 'minecraft:inventory');
          if (!['minecraft:chest', 'minecraft:barrel'].includes(record.type)) return undefined;
          const items = inventories.get(location) ?? new Map();
          return {container: {size: 27, getItem: slot => items.get(slot)}};
        },
      };
    },
  };
  const player = {dimension, location: {...first.spawn}};
  const world = {players: [player], failSave: () => false,
    getPlayers() { calls++; return this.players; },
    getDimension(id) { calls++; assert.equal(id, 'overworld'); return dimension; },
    getDynamicProperty(name) { calls++; return properties.get(name); },
    setDynamicProperty(name, value) {
      calls++;
      if (this.failSave(name, value)) throw new Error('Checkpoint unavailable');
      assert.ok(value.length <= 32767, 'Bedrock dynamic-property string limit');
      properties.set(name, value);
    },
  };
  const create = () => new BellyRooms(world);
  const rooms = create();
  const step = (current = rooms, active = true) => { tick++; current.tick(tick, active); };
  const finish = (site = first, current = rooms) => {
    player.location = {...site.spawn}; current.prepare(site);
    for (let i = 0; i < 1000 && !current.isReady(site.id); i++) step(current);
    assert.equal(current.isReady(site.id), true);
    step(current); // Start a tick with a full copy budget.
  };
  const setSource = (job, states = {}) => blocks.set(coordinate(job.location), {type: job.type, states});
  const get = at => dimension.getBlock(at).typeId;
  const destination = job => ({...job.location, y: job.location.y+BELLY_Y_OFFSET});
  const ordinary = (site = first) => villageBlocks(site).find(job => !job.protected && job.type === 'minecraft:stripped_spruce_log');
  return {rooms, create, world, player, dimension, blocks, properties, inventories, writes, step, finish,
    setSource, get, destination, ordinary, calls: () => calls};
}

test('construction is opt-in, deferred, local to loaded players and bounded per tick', () => {
  const f = fixture(); assert.equal(f.calls(), 0);
  assert.equal(f.rooms.prepare(first), true); assert.equal(f.calls(), 0);
  f.step(f.rooms, false); assert.equal(f.calls(), 0);
  f.world.players = []; f.step(); assert.equal(f.writes.length, 0);
  f.world.players = [f.player]; f.step(); assert.equal(f.writes.length, BELLY_BATCH_SIZE);
  const state = JSON.parse(f.properties.get(bellyProperty(first.id)));
  assert.equal(state.next, BELLY_BATCH_SIZE); assert.equal(state.ready, false);
  for (const write of f.writes) {
    assert.ok(write.location.x >= -21 && write.location.x <= 21);
    assert.ok(write.location.z >= -22 && write.location.z <= 32);
    assert.ok(write.location.y >= -60 && write.location.y <= -42);
  }
  assert.equal(f.rooms.prepare({id: first.id, x: 99, z: 0}), false);
  assert.equal(f.rooms.prepare('unknown'), false);
});

test('a finished chamber has a solid shell, dry house space, ribs and a marked mouth', () => {
  const f = fixture(); f.finish();
  assert.equal(f.writes.length, BELLY_BLOCK_COUNT);
  const counts = new Map();
  for (const write of f.writes) counts.set(write.tick, (counts.get(write.tick) ?? 0)+1);
  assert.ok([...counts.values()].every(count => count <= BELLY_BATCH_SIZE));
  for (const at of [{x: 0, y: -60, z: 0}, {x: 21, y: -50, z: 0},
    {x: 0, y: -42, z: 0}, {x: 0, y: -50, z: 32}]) assert.equal(f.get(at), 'minecraft:red_terracotta');
  assert.equal(f.get({x: 0, y: -55, z: 0}), 'minecraft:air');
  assert.equal(f.get({x: 19, y: -55, z: -20}), 'minecraft:bone_block');
  assert.equal(f.get({x: 20, y: -51, z: -20}), 'minecraft:shroomlight');
  assert.equal(f.get({x: 0, y: -59, z: -20}), 'minecraft:sea_lantern');
  assert.equal(f.get({x: 0, y: -58, z: -20}), 'minecraft:air');
  assert.equal(f.rooms.entryFor(f.player), undefined, 'Empty rooms cannot be entered');
});

test('foreign blocks, existing air cavities, bedrock and unloaded chunks stop excavation', () => {
  for (const type of ['minecraft:chest', 'minecraft:air', 'minecraft:bedrock', 'minecraft:red_terracotta']) {
    const f = fixture(), job = bellyBlock(first, 17);
    f.blocks.set(coordinate(job.location), {type, states: {}});
    f.rooms.prepare(first); f.step();
    assert.equal(f.writes.length, 0, type);
    assert.equal(f.get(job.location), type);
  }
  const f = fixture(); f.rooms.prepare(first); f.dimension.loaded = () => false;
  f.step(); assert.equal(f.writes.length, 0);
  f.dimension.loaded = () => true; f.step(); assert.equal(f.writes.length, BELLY_BATCH_SIZE);
});

test('saved intent resumes a partial batch after reload without claiming foreign edits', () => {
  const f = fixture(); f.rooms.prepare(first);
  f.dimension.failWrite = at => coordinate(at) === coordinate(bellyBlock(first, 5).location);
  f.step(); assert.equal(f.writes.length, 5);
  const persisted = JSON.parse(f.properties.get(bellyProperty(first.id)));
  assert.equal(persisted.next, 0); assert.equal(persisted.pending.originals.length, BELLY_BATCH_SIZE);
  const reloaded = f.create(); f.dimension.failWrite = () => false;
  f.step(reloaded); assert.equal(f.writes.length, BELLY_BATCH_SIZE);
  assert.equal(JSON.parse(f.properties.get(bellyProperty(first.id))).next, BELLY_BATCH_SIZE);
  const second = fixture(); second.rooms.prepare(first);
  second.dimension.failWrite = at => coordinate(at) === coordinate(bellyBlock(first, 5).location);
  second.step();
  const edited = bellyBlock(first, 5).location;
  second.blocks.set(coordinate(edited), {type: 'minecraft:diamond_block', states: {}});
  second.dimension.failWrite = () => false; second.step(second.create());
  assert.equal(second.get(edited), 'minecraft:diamond_block'); assert.equal(second.writes.length, 5);
});

test('room copying preserves the source permutation and is durably idempotent', () => {
  const f = fixture(); f.finish();
  const job = f.ordinary(); f.setSource(job, {pillar_axis: 'x'});
  const before = f.writes.length;
  assert.equal(f.rooms.storeBlock(first.id, job), true);
  assert.equal(f.writes.length, before+1);
  assert.deepEqual(f.blocks.get(coordinate(f.destination(job))).states, {pillar_axis: 'x'});
  assert.equal(f.get(job.location), job.type, 'Only Feast may remove the source');
  assert.equal(f.rooms.storeBlock(first.id, job), true); assert.equal(f.writes.length, before+1);
  const reloaded = f.create(); f.step(reloaded);
  assert.equal(reloaded.storeBlock(first.id, job), true); assert.equal(f.writes.length, before+1);
  f.blocks.set(coordinate(f.destination(job)), {type: 'minecraft:air', states: {}});
  assert.equal(reloaded.storeBlock(first.id, job), false, 'Mined copies are never regenerated');
  assert.equal(f.writes.length, before+1);
});

test('stale, forged, protected, changed or occupied copies never delete or replace data', () => {
  const f = fixture(); f.finish(); const job = f.ordinary(); f.setSource(job);
  assert.equal(f.rooms.storeBlock(first.id, {...job, type: 'minecraft:diamond_block'}), false);
  assert.equal(f.rooms.storeBlock(first.id, {...job, location: {...job.location, y: 72}}), false);
  const protectedJob = villageBlocks(first).find(value => value.protected);
  f.setSource(protectedJob); assert.equal(f.rooms.storeBlock(first.id, protectedJob), false);
  f.player.location = f.destination(job);
  assert.equal(f.rooms.storeDeferred(first.id, job), true);
  assert.equal(f.rooms.storeBlock(first.id, job), false);
  f.player.location = {...first.spawn};
  assert.equal(f.rooms.storeDeferred(first.id, job), false);
  f.blocks.set(coordinate(f.destination(job)), {type: 'minecraft:diamond_block', states: {}});
  assert.equal(f.rooms.storeBlock(first.id, job), false);
  assert.equal(f.get(f.destination(job)), 'minecraft:diamond_block');
  f.blocks.set(coordinate(f.destination(job)), {type: 'minecraft:pink_terracotta', states: {}});
  assert.equal(f.rooms.storeBlock(first.id, job), true);
  f.setSource(job, {pillar_axis: 'z'});
  assert.equal(f.rooms.storeBlock(first.id, job), false, 'An old mapping cannot approve a newly changed source');
});

test('container contents are never duplicated and source/checkpoint failures do not approve removal', () => {
  const f = fixture(); f.finish();
  const barrel = villageBlocks(first).find(job => job.type === 'minecraft:barrel');
  f.setSource(barrel); f.inventories.set(coordinate(barrel.location), new Map([[0, {typeId: 'minecraft:diamond'}]]));
  assert.equal(f.rooms.storeBlock(first.id, barrel), false);
  assert.equal(f.get(f.destination(barrel)), 'minecraft:air');
  f.inventories.clear(); assert.equal(f.rooms.storeBlock(first.id, barrel), true);
  const job = f.ordinary(); f.setSource(job);
  const before = f.writes.length;
  f.world.failSave = () => true;
  assert.equal(f.rooms.storeBlock(first.id, job), false); assert.equal(f.writes.length, before);
  f.world.failSave = (_name, value) => value.includes('"done"');
  assert.equal(f.rooms.storeBlock(first.id, job), false); assert.equal(f.writes.length, before+1);
  f.world.failSave = () => false;
  assert.equal(f.rooms.storeBlock(first.id, job), true); assert.equal(f.writes.length, before+1);
});

test('entry selects a nearby occupied chamber only when the landing and copied blocks are loaded', () => {
  const f = fixture(); f.finish(); const job = f.ordinary(); f.setSource(job);
  assert.equal(f.rooms.storeBlock(first.id, job), true);
  const entry = f.rooms.entryFor(f.player, first.id);
  assert.deepEqual(entry, {siteId: first.id, location: {x: .5, y: -58, z: -18.5}});
  f.player.location = {...entry.location};
  assert.equal(f.rooms.contains(f.player, first.id), true); assert.equal(f.rooms.isExit(f.player, first.id), false);
  f.player.location.z = -20; assert.equal(f.rooms.isExit(f.player, first.id), true);
  f.player.location.x = 25; assert.equal(f.rooms.contains(f.player, first.id), false);
  f.player.location = {...first.spawn};
  f.dimension.loaded = at => at.y > -40; assert.equal(f.rooms.entryFor(f.player), undefined);
  f.dimension.loaded = () => true;
  f.blocks.set('0,-57,-19', {type: 'minecraft:stone', states: {}});
  assert.equal(f.rooms.entryFor(f.player), undefined);
  f.player.location = {x: 100, y: 64, z: 100}; assert.equal(f.rooms.entryFor(f.player), undefined);
  assert.equal(f.rooms.entryFor(f.player, 'unknown'), undefined);
});

test('every site reconstructs a separate chamber, and invalid saved state is never overwritten', () => {
  const f = fixture(), site = VILLAGE_SITES[1];
  f.finish(site); const job = f.ordinary(site); f.setSource(job);
  assert.equal(f.rooms.storeBlock(site.id, job), true);
  assert.equal(f.rooms.entryFor(f.player, site.id).location.x, site.x+.5);
  assert.equal(f.properties.has(bellyProperty(first.id)), false);
  assert.equal(f.rooms.isReady(first.id), false);
  const broken = fixture(); broken.rooms.prepare(first);
  broken.properties.set(bellyProperty(first.id), '{broken'); broken.step();
  assert.equal(broken.writes.length, 0); assert.equal(broken.properties.get(bellyProperty(first.id)), '{broken');
  const index = villageBlocks(site).findIndex(value => coordinate(value.location) === coordinate(job.location));
  assert.ok(f.properties.get(bellyStoreProperty(site.id, Math.floor(index/64))).length < 32767);
});

test('NPC evacuation has a checked landing before any copied block or nearby player is required', () => {
  const f = fixture(); f.finish();
  f.player.location = {x: 1000, y: 64, z: 1000};
  assert.deepEqual(f.rooms.landingFor(first.id), {siteId: first.id, location: {x: .5, y: -58, z: -18.5}});
  assert.equal(f.rooms.entryFor(f.player, first.id), undefined);
  assert.equal(f.rooms.landingFor('unknown'), undefined);
  f.dimension.loaded = () => false; assert.equal(f.rooms.landingFor(first.id), undefined);
  f.dimension.loaded = () => true;
  f.blocks.set('0,-57,-19', {type: 'minecraft:stone', states: {}});
  assert.equal(f.rooms.landingFor(first.id), undefined);
});

test('unloaded first-site chunks do not starve another player\'s loaded chamber', () => {
  const f = fixture(), east = VILLAGE_SITES[1];
  f.rooms.prepare(first); f.rooms.prepare(east);
  f.world.players.push({dimension: f.dimension, location: {...east.spawn}});
  f.dimension.loaded = at => at.x > 100;
  for (let i = 0; i < 12; i++) f.step();
  assert.ok(f.writes.length > 0);
  assert.ok(f.writes.every(write => write.location.x >= east.x-21));
  assert.ok(JSON.parse(f.properties.get(bellyProperty(east.id))).next > 0);
  assert.equal(JSON.parse(f.properties.get(bellyProperty(first.id))).next, 0);
});

test('copy writes share the construction budget instead of exceeding 128 writes per tick', () => {
  const f = fixture(); f.finish();
  const job = f.ordinary(); f.setSource(job);
  const east = VILLAGE_SITES[1]; f.rooms.prepare(east);
  f.world.players.push({dimension: f.dimension, location: {...east.spawn}});
  f.step();
  const before = f.writes.length;
  assert.equal(f.rooms.storeDeferred(first.id, job), true);
  assert.equal(f.rooms.storeBlock(first.id, job), false);
  assert.equal(f.writes.length, before);
  assert.equal(f.rooms.storeDeferred(first.id, {...job, type: 'minecraft:diamond_block'}), false);
  assert.equal(f.rooms.storeDeferred(first.id, undefined), false);
  f.blocks.set(coordinate(f.destination(job)), {type: 'minecraft:diamond_block', states: {}});
  assert.equal(f.rooms.storeDeferred(first.id, job), false, 'Budget cannot hide a permanent destination conflict');
  f.blocks.set(coordinate(f.destination(job)), {type: 'minecraft:pink_terracotta', states: {}});
  f.world.players.pop(); f.step();
  assert.equal(f.rooms.storeDeferred(first.id, job), false);
  assert.equal(f.rooms.storeBlock(first.id, job), true);
  assert.equal(f.writes.length, before+1);
  f.world.players.push({dimension: f.dimension, location: {...east.spawn}}); f.step();
  assert.equal(f.rooms.storeDeferred(first.id, job), false, 'Completed copies need no write budget');
  assert.equal(f.rooms.storeBlock(first.id, job), true);
});
