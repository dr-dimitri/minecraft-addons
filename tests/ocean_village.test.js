import test from 'node:test';
import assert from 'node:assert/strict';
import {OceanVillage, villageBlocks, VILLAGE_PROPERTY, ARRIVAL_PROPERTY,
  VILLAGE_BATCH_SIZE, VILLAGE_SPAWN, VILLAGE_SITES, villageProperty, villageEntities,
  EQUIPMENT_CHEST, DIVING_ITEMS, VILLAGE_SUPPLIES, VILLAGE_ENTITIES} from '../src/ocean_village.js';

function fixture() {
  const properties = new Map(), blocks = new Map(), containers = new Map(), entities = [], writes = [], reports = [], reads = [];
  let calls = 0, serial = 0;
  const key = at => [at.x, at.y, at.z].map(Math.floor).join(',');
  const dimension = {id: 'minecraft:overworld', heightRange: {min: -64, max: 320}, loaded: () => true,
    failSet: false, failSpawn: false, itemFailure: false,
    getBlock(at) {
      calls++;
      reads.push({...at});
      if (!this.loaded(at)) throw new Error('Unloaded chunk');
      const position = key(at);
      const typeId = blocks.get(position) ?? (at.y <= 62 && at.y >= -37 ? 'minecraft:water' : 'minecraft:air');
      return {typeId, isAir: typeId === 'minecraft:air', permutation: {getState: () => 0},
        setType(type) {
          if (dimension.failSet) throw new Error('Placement failed');
          blocks.set(position, type); writes.push({position, type});
          if (type === 'minecraft:chest') containers.set(position, new Map());
        },
        getComponent(id) {
          assert.equal(id, 'minecraft:inventory');
          const items = containers.get(position);
          return items && {container: {
            getItem: slot => items.get(slot),
            setItem(slot, item) {
              if (dimension.itemFailure) throw new Error('Inventory unavailable');
              items.set(slot, item);
            },
          }};
        },
      };
    },
    getEntities(query) {
      calls++;
      return entities.filter(e => e.typeId === query.type
        && (query.tags ?? []).every(tag => e.tags.has(tag))
        && (!query.location || Math.hypot(e.location.x-query.location.x,
          e.location.y-query.location.y, e.location.z-query.location.z) <= query.maxDistance));
    },
    spawnEntity(typeId, location) {
      calls++;
      if (this.failSpawn) throw new Error('Spawn unavailable');
      const e = {id: String(++serial), typeId, location: {...location}, tags: new Set(),
        addTag(tag) { this.tags.add(tag); }};
      entities.push(e);
      return e;
    },
  };
  const player = {dimension, location: {...VILLAGE_SPAWN}, properties: new Map(), effects: new Map(), teleports: [],
    getDynamicProperty(name) { return this.properties.get(name); },
    setDynamicProperty(name, value) { this.properties.set(name, value); },
    getEffect(type) { return this.effects.get(type); },
    addEffect(type, duration, {amplifier}) { this.effects.set(type, {duration, amplifier}); },
    tryTeleport(location) { this.location = {...location}; this.teleports.push(location); return true; },
    onScreenDisplay: {setActionBar() {}},
  };
  const world = {players: [player], failSave: false, spawnCalls: 0,
    getPlayers() { calls++; return this.players; },
    getDimension(id) { calls++; assert.equal(id, 'overworld'); return dimension; },
    getDynamicProperty(name) { calls++; return properties.get(name); },
    setDynamicProperty(name, value) {
      calls++;
      if (this.failSave) throw new Error('Checkpoint unavailable');
      properties.set(name, value);
    },
    setDefaultSpawnLocation(at) { calls++; this.spawnCalls++; this.spawn = {...at}; },
  };
  const create = () => new OceanVillage(world, {makeItemStack: (typeId, amount) => ({typeId, amount}),
    report: message => reports.push(message)});
  const builder = create();
  const state = (site = VILLAGE_SITES[0]) => {
    const value = properties.get(villageProperty(site));
    return value === undefined ? undefined : JSON.parse(value);
  };
  const finish = (current = builder, site = VILLAGE_SITES[0]) => {
    for (let tick = 0; tick < 500; tick++) {
      current.tick(tick);
      if (state(site)?.complete || state(site)?.consumed) break;
    }
    assert.equal(state(site)?.complete || state(site)?.consumed, true, JSON.stringify({state: state(site), reports}));
  };
  const addPlayer = site => {
    const extra = {...player, location: {...site.spawn}, properties: new Map(), effects: new Map(), teleports: []};
    world.players.push(extra);
    return extra;
  };
  return {world, dimension, player, properties, blocks, containers, entities, writes, reports, reads, builder, addPlayer,
    state, finish, create, key, calls: () => calls};
}

test('ordinary add-on worlds remain untouched and activation is safe during early execution', () => {
  const f = fixture();
  f.builder.tick(0);
  assert.equal(f.calls(), 0);
  assert.equal(f.properties.size, 0);
  f.builder.activate();
  assert.equal(f.calls(), 0);
  f.builder.tick(1);
  assert.ok(f.properties.has(VILLAGE_PROPERTY));
  assert.ok(f.writes.length > 0);
});

test('bounded construction starts with a dry platform and creates an accessible village', () => {
  const f = fixture(); f.builder.activate(); f.builder.tick(0);
  assert.ok(f.writes.length <= VILLAGE_BATCH_SIZE);
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    assert.equal(f.blocks.get(`${x},63,${z}`), 'minecraft:spruce_planks');
  }
  assert.deepEqual(f.world.spawn, VILLAGE_SPAWN);
  f.finish();
  assert.equal(f.entities.length, 3);
  assert.deepEqual(f.entities.map(e => e.typeId), VILLAGE_ENTITIES.map(e => e.type));
  const inventory = f.containers.get(f.key(EQUIPMENT_CHEST));
  assert.deepEqual([...inventory.values()].slice(0, 4).map(i => i.typeId), DIVING_ITEMS);
  assert.deepEqual([...inventory.values()], VILLAGE_SUPPLIES.map(({type, amount}) => ({typeId: type, amount})));
  assert.equal(f.blocks.get(f.key(EQUIPMENT_CHEST)), 'minecraft:chest');
  // A player can walk from spawn to every house and the submarine pier.
  // Fence gates count as passable because the player can open them.
  const traversable = (x, z) => f.blocks.get(`${x},63,${z}`) === 'minecraft:spruce_planks'
    && [64, 65].every(y => !f.blocks.has(`${x},${y},${z}`) || f.blocks.get(`${x},${y},${z}`) === 'minecraft:spruce_fence_gate');
  const queue = [[0, 0]], seen = new Set(['0,0']);
  for (let i = 0; i < queue.length; i++) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const [x, z] = [queue[i][0]+dx, queue[i][1]+dz], key = `${x},${z}`;
    if (!seen.has(key) && traversable(x, z)) { seen.add(key); queue.push([x, z]); }
  }
  for (const destination of ['-12,0', '12,0', '0,-13', '8,22']) assert.ok(seen.has(destination), destination);
  for (const e of f.entities.filter(e => e.typeId === 'minecraft:villager')) {
    assert.equal(f.dimension.getBlock(e.location).isAir, true);
  }
});

test('a first player already in spawn water is rescued without blocking the floor', () => {
  const f = fixture(); f.player.location.y = 62.5;
  f.builder.activate(); f.builder.tick(0);
  assert.equal(f.player.location.y, 64);
  assert.equal(f.player.teleports.length, 1);
  assert.equal(f.player.properties.get(ARRIVAL_PROPERTY), true);
  assert.ok(f.player.effects.has('water_breathing'));
  assert.equal(f.blocks.get('0,63,0'), 'minecraft:spruce_planks');
  f.finish();
  f.player.location.y = 61;
  const reloaded = f.create(); reloaded.activate(); reloaded.tick(900);
  assert.equal(f.player.location.y, 61);
  assert.equal(f.player.teleports.length, 1);
});

test('a player on the very first floor cell also gets a dry initial landing', () => {
  const f = fixture(), first = villageBlocks()[0].location;
  f.player.location = {x: first.x+.5, y: 62.5, z: first.z+.5};
  f.builder.activate(); f.builder.tick(0);
  assert.equal(f.player.location.y, 64);
  assert.ok(f.writes.length <= VILLAGE_BATCH_SIZE);
  assert.ok(f.state().next > 0);
  f.finish();
});

test('missing chunks pause construction and persisted progress resumes after reload', () => {
  const f = fixture(); f.builder.activate(); f.builder.tick(0);
  const next = f.state().next, target = f.builder.blocks[next].location;
  f.dimension.loaded = at => f.key(at) !== f.key(target);
  f.builder.tick(1);
  assert.equal(f.state().next, next);
  const writes = f.writes.length;
  const reloaded = f.create(); reloaded.activate(); reloaded.tick(2);
  assert.equal(f.state().next, next);
  assert.equal(f.writes.length, writes);
  f.dimension.loaded = () => true;
  f.finish(reloaded);
  assert.equal(f.entities.length, 3);
});

test('existing blocks are preserved and construction resumes after the obstruction is removed', () => {
  const f = fixture(); const first = f.builder.blocks[0].location;
  f.blocks.set(f.key(first), 'minecraft:diamond_block');
  f.builder.activate(); f.builder.tick(0);
  assert.equal(f.blocks.get(f.key(first)), 'minecraft:diamond_block');
  assert.equal(f.state().next, 0);
  assert.equal(f.writes.length, 0);
  f.blocks.delete(f.key(first));
  f.finish();
});

test('block and checkpoint failures cannot skip unfinished construction', () => {
  const f = fixture(); f.builder.activate(); f.dimension.failSet = true; f.builder.tick(0);
  assert.equal(f.state().next, 0);
  f.dimension.failSet = false;
  f.world.failSave = true; f.builder.tick(1);
  assert.equal(f.state().next, 0);
  assert.equal(f.writes.length, VILLAGE_BATCH_SIZE);
  f.world.failSave = false;
  const writes = f.writes.length; f.builder.tick(2);
  assert.equal(f.writes.length, writes); // Existing completed cells are not reset.
  assert.equal(f.state().next, VILLAGE_BATCH_SIZE);
  f.finish();
});

test('finished village never refills loot, respawns inhabitants, or repairs player edits', () => {
  const f = fixture(); f.builder.activate(); f.finish();
  f.containers.get(f.key(EQUIPMENT_CHEST)).clear();
  f.entities.length = 0;
  f.blocks.delete('0,63,0');
  const writes = f.writes.length;
  const reloaded = f.create(); reloaded.activate(); reloaded.tick(1000);
  assert.equal(f.writes.length, writes);
  assert.equal(f.containers.get(f.key(EQUIPMENT_CHEST)).size, 0);
  assert.equal(f.entities.length, 0);
  assert.equal(f.blocks.has('0,63,0'), false);
});

test('partial chest contents and a failed entity checkpoint resume without duplicates', () => {
  const f = fixture(); f.builder.activate();
  for (let tick = 0; tick < 100 && (!f.properties.has(VILLAGE_PROPERTY) || f.state().equipment < 2); tick++) f.builder.tick(tick);
  assert.equal(f.state().equipment, 2);
  const inventory = f.containers.get(f.key(EQUIPMENT_CHEST));
  inventory.delete(0); // First item was collected before the next world load.
  const reloaded = f.create(); reloaded.activate();
  const originalSave = f.world.setDynamicProperty;
  f.world.setDynamicProperty = function(name, value) {
    if (name === VILLAGE_PROPERTY && JSON.parse(value).entity === 1) throw new Error('Save after spawn failed');
    originalSave.call(this, name, value);
  };
  for (let tick = 100; tick < 150; tick++) reloaded.tick(tick);
  assert.equal(f.entities.length, 1);
  assert.equal(f.state().entity, 0);
  f.world.setDynamicProperty = originalSave;
  f.finish(reloaded);
  assert.equal(f.entities.length, 3);
  assert.equal(inventory.has(0), false);
});

test('occupied chest slots and unsafe submarine water are never overwritten', () => {
  const f = fixture(); f.builder.activate(); f.dimension.itemFailure = true;
  for (let tick = 0; tick < 100; tick++) f.builder.tick(tick);
  const inventory = f.containers.get(f.key(EQUIPMENT_CHEST));
  inventory.set(0, {typeId: 'minecraft:diamond', amount: 5});
  f.dimension.itemFailure = false; f.builder.tick(101);
  assert.equal(inventory.get(0).typeId, 'minecraft:diamond');
  assert.equal(f.state().equipment, 0);
  inventory.delete(0);
  const submarine = VILLAGE_ENTITIES[0];
  f.blocks.set(f.key(submarine.location), 'minecraft:lava');
  for (let tick = 102; tick < 120; tick++) f.builder.tick(tick);
  assert.equal(f.state().complete, false);
  assert.equal(f.entities.length, 0);
  f.blocks.delete(f.key(submarine.location));
  f.finish();
});

test('the submarine spawn uses its full periscope and seated-player water envelope', () => {
  const f = fixture(); f.builder.activate();
  // This stone is outside the former 1.2-block half-height but inside the
  // submarine controller's actual 2.3-block half-height.
  f.blocks.set('13,61,22', 'minecraft:stone');
  for (let tick = 0; tick < 100; tick++) f.builder.tick(tick);
  assert.equal(f.state().entity, 0);
  assert.equal(f.entities.length, 0);
  assert.equal(f.state().complete, false);
  f.blocks.delete('13,61,22');
  f.finish();
});

test('the required submarine precedes optional residents and failed NPCs have bounded retries', () => {
  const f = fixture(); f.builder.activate();
  const originalSpawn = f.dimension.spawnEntity, attempts = [];
  let currentTick = 0;
  f.dimension.spawnEntity = function(type, location) {
    if (type === 'minecraft:villager') { attempts.push(currentTick); throw new Error('Vanilla resident unavailable'); }
    return originalSpawn.call(this, type, location);
  };
  while (!f.properties.has(VILLAGE_PROPERTY) || f.state().next < f.builder.blocks.length) f.builder.tick(currentTick++);
  f.player.effects.clear();
  while (!f.state().complete && currentTick < 500) f.builder.tick(currentTick++);
  assert.equal(f.state().complete, true);
  assert.equal(f.entities.length, 1);
  assert.equal(f.entities[0].typeId, 'lumen_birds:submarine');
  assert.equal(f.state().skippedResidents, 2);
  assert.equal(attempts.length, 6);
  assert.ok(attempts.slice(1).every((tick, i) => tick-attempts[i] >= 20));
  assert.equal(f.player.effects.size, 0); // No permanent construction buffs while NPCs retry.
  assert.equal(f.reports.filter(message => message.includes('house remains empty')).length, 2);
});

test('a transformed vanilla villager is found after a failed checkpoint instead of duplicated', () => {
  const f = fixture(); f.builder.activate();
  const originalSave = f.world.setDynamicProperty;
  f.world.setDynamicProperty = function(name, value) {
    if (name === VILLAGE_PROPERTY && JSON.parse(value).entity === 2) throw new Error('Resident checkpoint failed');
    originalSave.call(this, name, value);
  };
  for (let tick = 0; tick < 100; tick++) f.builder.tick(tick);
  assert.equal(f.entities.length, 2);
  assert.equal(f.state().entity, 1);
  f.entities[1].typeId = 'minecraft:villager_v2';
  f.entities[1].tags.clear();
  f.world.setDynamicProperty = originalSave;
  const reloaded = f.create(); reloaded.activate(); f.finish(reloaded);
  assert.equal(f.entities.length, 3);
  assert.equal(f.entities.filter(entity => entity.typeId === 'minecraft:villager_v2').length, 1);
});

test('corrupt progress and absent players never cause a destructive restart', () => {
  const f = fixture(); f.properties.set(VILLAGE_PROPERTY, '{broken');
  f.builder.activate(); f.builder.tick(0);
  assert.equal(f.writes.length, 0);
  assert.equal(f.properties.get(VILLAGE_PROPERTY), '{broken');
  const empty = fixture(); empty.world.players = []; empty.builder.activate(); empty.builder.tick(0);
  assert.equal(empty.writes.length, 0);
  const outside = fixture(); outside.player.dimension = {id: 'minecraft:nether'};
  outside.builder.activate(); outside.builder.tick(0);
  assert.equal(outside.writes.length, 0);
});

test('construction protection preserves existing weaker and stronger long effects', () => {
  const f = fixture();
  f.player.effects.set('resistance', {duration: 6000, amplifier: 0});
  f.player.effects.set('water_breathing', {duration: 9000, amplifier: 1});
  f.builder.activate(); f.builder.tick(0);
  assert.deepEqual(f.player.effects.get('resistance'), {duration: 6000, amplifier: 0});
  assert.deepEqual(f.player.effects.get('water_breathing'), {duration: 9000, amplifier: 1});
});

test('block plan is deterministic, unique and has no world-bottom construction', () => {
  const plan = villageBlocks();
  assert.deepEqual(plan, villageBlocks());
  assert.equal(new Set(plan.map(b => JSON.stringify(b.location))).size, plan.length);
  assert.ok(plan.length < 2000);
  assert.ok(plan.every(b => b.location.y >= 62 && b.location.y <= 71));
  assert.equal(plan.filter(b => b.type === 'minecraft:spruce_fence_gate').length, 3);
});

test('four named sites have absolute blueprints and distinct supplies and entity tags', () => {
  assert.deepEqual(VILLAGE_SITES.map(({name, x, z}) => [name, x, z]), [
    ['Hafenlicht', 0, 0], ['Ostwacht', 192, 0], ['Nebelhafen', -160, 144], ['Fernsteg', 64, -192],
  ]);
  const origin = villageBlocks(), tags = new Set(), allPositions = new Set();
  for (const site of VILLAGE_SITES) {
    const plan = villageBlocks(site);
    assert.deepEqual(plan, villageBlocks(site.id));
    assert.equal(plan.length, origin.length);
    assert.deepEqual(site.spawn, {x: site.x+.5, y: 64, z: site.z+.5});
    for (let i = 0; i < plan.length; i++) {
      assert.deepEqual(plan[i].location, {
        x: origin[i].location.x+site.x, y: origin[i].location.y, z: origin[i].location.z+site.z,
      });
      const key = JSON.stringify(plan[i].location);
      assert.equal(allPositions.has(key), false); allPositions.add(key);
      if (site.id !== VILLAGE_SITES[0].id) assert.equal(plan[i].protected, false);
    }
    for (const job of villageEntities(site)) {
      assert.equal(tags.has(job.tag), false); tags.add(job.tag);
    }
  }
  assert.equal(tags.size, 12);
});

test('distant villages stay dormant until visited and never move the global spawn', () => {
  const f = fixture(); f.builder.activate(); f.finish();
  assert.equal(f.properties.size, 1);
  assert.ok(f.reads.every(at => Math.abs(at.x) < 50 && Math.abs(at.z) < 50));
  assert.equal(f.world.spawnCalls, 1);
  for (const site of VILLAGE_SITES.slice(1)) {
    const previousWrites = f.writes.length;
    f.player.location = {...site.spawn};
    f.finish(f.builder, site);
    const added = f.writes.slice(previousWrites);
    assert.ok(added.length > 0);
    assert.ok(added.every(({position}) => {
      const [x, , z] = position.split(',').map(Number);
      return Math.abs(x-site.x) < 30 && Math.abs(z-site.z) < 30;
    }));
    const chestKey = f.key({x: EQUIPMENT_CHEST.x+site.x, y: EQUIPMENT_CHEST.y, z: EQUIPMENT_CHEST.z+site.z});
    assert.deepEqual([...f.containers.get(chestKey).values()], VILLAGE_SUPPLIES.map(({type, amount}) => ({typeId: type, amount})));
  }
  assert.equal(f.world.spawnCalls, 1);
  assert.deepEqual(f.world.spawn, VILLAGE_SPAWN);
  assert.equal(f.entities.length, 12);
  assert.equal(f.player.teleports.length, 0);
  assert.equal(f.builder.complete, true);
});

test('multiple players share one construction budget across all four villages', () => {
  const f = fixture();
  for (const site of VILLAGE_SITES.slice(1)) f.addPlayer(site);
  f.builder.activate();
  for (let tick = 0; tick < 300 && !f.builder.complete; tick++) {
    const count = f.writes.length;
    f.builder.tick(tick);
    assert.ok(f.writes.length-count <= VILLAGE_BATCH_SIZE, 'global placement budget exceeded');
    if (tick === 3) for (const site of VILLAGE_SITES) assert.ok(f.state(site).next > 0);
  }
  assert.equal(f.builder.complete, true);
  assert.equal(f.entities.length, 12);
});

test('a completed legacy v1 origin checkpoint is reused without rewriting blocks or loot', () => {
  const f = fixture(); f.builder.activate(); f.finish();
  const legacy = f.state(); delete legacy.consumed;
  const saved = JSON.stringify(legacy); f.properties.set(VILLAGE_PROPERTY, saved);
  f.containers.get(f.key(EQUIPMENT_CHEST)).clear();
  f.blocks.set('-3,63,-3', 'minecraft:diamond_block');
  const count = f.writes.length, spawns = f.entities.length, spawnCalls = f.world.spawnCalls;
  const reloaded = f.create(); reloaded.activate(); reloaded.tick(900);
  assert.equal(f.properties.get(VILLAGE_PROPERTY), saved);
  assert.equal(f.writes.length, count);
  assert.equal(f.entities.length, spawns);
  assert.equal(f.world.spawnCalls, spawnCalls);
  assert.equal(f.containers.get(f.key(EQUIPMENT_CHEST)).size, 0);
  assert.equal(f.blocks.get('-3,63,-3'), 'minecraft:diamond_block');
  assert.deepEqual(reloaded.attackableVillages().map(entry => entry.site.id), ['harborlight']);
});

test('an unfinished legacy v1 checkpoint resumes its original index without rebuilding visited cells', () => {
  const f = fixture(); f.builder.activate(); f.builder.tick(0);
  const legacy = f.state(); delete legacy.consumed;
  const next = legacy.next; f.properties.set(VILLAGE_PROPERTY, JSON.stringify(legacy));
  f.blocks.set('-3,63,-3', 'minecraft:diamond_block');
  const reloaded = f.create(); reloaded.activate(); reloaded.tick(1);
  assert.equal(f.state().next, next+VILLAGE_BATCH_SIZE);
  f.finish(reloaded);
  assert.equal(f.blocks.get('-3,63,-3'), 'minecraft:diamond_block');
  assert.equal(f.entities.length, 3);
});

test('remote construction waits around a swimming player without teleporting them', () => {
  const f = fixture(), site = VILLAGE_SITES[1], first = villageBlocks(site)[0].location;
  f.player.location = {x: first.x+.5, y: 62.5, z: first.z+.5};
  const original = {...f.player.location};
  f.builder.activate(); f.builder.tick(0);
  assert.deepEqual(f.player.location, original);
  assert.equal(f.player.teleports.length, 0);
  assert.equal(f.state(site).next, 0);
  assert.equal(f.world.spawnCalls, 0);
  assert.equal(f.properties.has(VILLAGE_PROPERTY), false);
  f.player.location = {x: site.x+30, y: 62, z: site.z};
  f.finish(f.builder, site);
  assert.equal(f.player.teleports.length, 0);
  assert.equal(f.world.spawnCalls, 0);
});

test('an unloaded village cannot prevent a different loaded village from progressing', () => {
  const f = fixture(), remote = VILLAGE_SITES[1]; f.addPlayer(remote);
  f.dimension.loaded = at => at.x > 100;
  f.builder.activate(); f.builder.tick(0);
  assert.equal(f.state().next, 0);
  assert.ok(f.state(remote).next > 0);
  assert.ok(f.writes.length <= VILLAGE_BATCH_SIZE);
  assert.ok(f.writes.every(({position}) => Number(position.split(',')[0]) > 100));
  assert.equal(f.state(remote).complete, false);
  const reloaded = f.create(); reloaded.activate(); f.finish(reloaded, remote);
  assert.equal(f.state().next, 0);
});

test('consumed villages stay consumed across reload while the protected start platform remains', () => {
  const f = fixture(); f.builder.activate(); f.finish();
  const [entry] = f.builder.attackableVillages();
  assert.equal(entry.site.id, 'harborlight');
  assert.equal(entry.residentTags.length, 2);
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    assert.ok(entry.blocks.some(job => job.protected && job.location.x === x && job.location.y === 63 && job.location.z === z));
  }
  assert.ok(entry.blocks.some(job => job.protected && job.type === 'minecraft:sea_lantern'));
  assert.equal(f.builder.markConsumed(entry.site.id), true);
  assert.equal(f.state().consumed, true);
  const removable = entry.blocks.find(job => !job.protected && job.location.y === 63);
  f.blocks.delete(f.key(removable.location));
  const count = f.writes.length;
  assert.deepEqual(f.builder.attackableVillages(), []);
  const reloaded = f.create(); reloaded.activate(); reloaded.tick(900);
  assert.deepEqual(reloaded.attackableVillages(), []);
  assert.equal(f.writes.length, count);
  assert.equal(f.blocks.has(f.key(removable.location)), false);
  assert.equal(f.blocks.get('0,63,0'), 'minecraft:spruce_planks');
  assert.equal(reloaded.markConsumed('harborlight'), true);
  f.player.location = {...VILLAGE_SITES[1].spawn};
  f.finish(reloaded, VILLAGE_SITES[1]);
  assert.deepEqual(reloaded.attackableVillages().map(value => value.site.id), ['eastwatch']);
});

test('feeding opt-in and consumption require completed durable progress', () => {
  const f = fixture(); f.builder.activate();
  assert.equal(f.builder.markConsumed('harborlight'), false);
  assert.deepEqual(f.builder.attackableVillages(), []);
  assert.equal(f.calls(), 0);
  f.builder.tick(0);
  assert.equal(f.builder.markConsumed('harborlight'), false);
  assert.equal(f.builder.markConsumed('unknown'), false);
  f.finish();
  f.world.failSave = true;
  assert.equal(f.builder.markConsumed('harborlight'), false);
  assert.equal(f.state().consumed, false);
  assert.equal(f.builder.attackableVillages().length, 1);
  f.world.failSave = false;
  assert.equal(f.builder.markConsumed('harborlight'), true);
});
