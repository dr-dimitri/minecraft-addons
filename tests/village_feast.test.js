import test from 'node:test';
import assert from 'node:assert/strict';
import {VillageFeast, FEAST_PROPERTY, FEAST_WARNING, FEAST_APPROACH, FEAST_COOLDOWN,
  FEAST_BATCH_SIZE, FEAST_SPEED, FEAST_SCALE, FEAST_MOUTH_FORWARD, mouthContains, feastRoute} from '../src/village_feast.js';

const key = at => `${Math.floor(at.x)},${Math.floor(at.y)},${Math.floor(at.z)}`;
const job = (x, y, z, type = 'minecraft:spruce_planks', protectedBlock = false) =>
  ({location: {x, y, z}, type, protected: protectedBlock});

function fixture(jobs = [job(-12, 63, 0), job(12, 63, 0), job(0, 63, 0, 'minecraft:spruce_planks', true)], customSite) {
  const blocks = new Map(jobs.map(block => [key(block.location), block.type]));
  const properties = new Map(), archives = new Map(), containers = new Map(), writes = new Map();
  const player = {id: 'p1', dimension: {id: 'minecraft:overworld'}, mode: 'Survival',
    location: {x: .5, y: 64, z: .5}, getGameMode() { return this.mode; },
    getComponent() { return this.mount ? {entityRidingOn: this.mount} : undefined; },
    onScreenDisplay: {setActionBar() {}},
  };
  const site = customSite ?? {id: 'harborlight', name: 'Hafenlicht', x: 0, z: 0, spawn: {x: .5, y: 64, z: .5}};
  player.location = {...site.spawn};
  const entry = {site, blocks: jobs, residentTags: []};
  const recordWrite = () => writes.set(world.time, (writes.get(world.time) ?? 0)+1);
  const dimension = {id: 'minecraft:overworld', loaded: true, reads: 0, residents: [],
    getEntities({tags}) { return this.residents.filter(entity => entity.tags.includes(tags[0])); },
    getBlock(at) {
      this.reads++;
      if (!this.loaded) throw new Error('Chunk not loaded');
      const where = key(at);
      return {
        get typeId() { return blocks.get(where) ?? (where === '0,63,0' ? 'minecraft:spruce_planks' : 'minecraft:air'); },
        get isAir() { return this.typeId === 'minecraft:air'; },
        getComponent(name) {
          assert.equal(name, 'minecraft:inventory');
          return containers.has(where) ? {container: containers.get(where)} : undefined;
        },
        setType(type) {
          assert.equal(type, 'minecraft:air');
          assert.ok(archives.has(where), 'Archive must exist before source removal');
          if (dimension.failRemove) throw new Error('Block write failed');
          assert.ok(monster.currentOpen > 0, 'No deletion with a closed mouth');
          assert.ok(mouthContains({location: at}, monster.currentMouth), 'No deletion outside the visible mouth');
          recordWrite(); blocks.set(where, type);
          dimension.afterRemove?.();
        },
      };
    },
  };
  const world = {time: 0, players: [player], failSave: false,
    getAbsoluteTime() { return this.time; }, getPlayers() { return this.players; },
    getDimension(name) { assert.equal(name, 'overworld'); return dimension; },
    getDynamicProperty(name) { return properties.get(name); },
    setDynamicProperty(name, value) { if (this.failSave) throw new Error('Persistence failed'); properties.set(name, value); },
  };
  const villages = {consumed: false, refuseConsume: false,
    attackableVillages() { return this.consumed ? [] : [entry]; },
    markConsumed(id) { assert.equal(id, site.id); if (this.refuseConsume) return false; this.consumed = true; return true; },
  };
  const monster = {busy: false, acquired: 0, released: 0, poses: [], rescues: [], refuseRescue: false,
    canStartVillageFeast() { return !this.busy; },
    acquireVillageMonster(location) {
      if (this.boundedSpawning && Math.hypot(location.x-site.x, location.z-site.z) > 64) return undefined;
      this.acquired++; return {id: 'deepmaw'};
    },
    updateVillageMonster(_entity, pose, openness, scale) {
      if (this.failPose) return false;
      if (this.boundedMotion && (Math.abs(pose.location.x-site.x) > 64 || Math.abs(pose.location.z-site.z) > 64)) return false;
      assert.equal(scale, FEAST_SCALE);
      this.currentOpen = openness;
      const angle = pose.rotation.y*Math.PI/180;
      this.currentMouth = {x: pose.location.x-Math.sin(angle)*FEAST_MOUTH_FORWARD,
        z: pose.location.z+Math.cos(angle)*FEAST_MOUTH_FORWARD};
      this.poses.push({mouth: {...this.currentMouth}, openness}); return true;
    },
    releaseVillageMonster() { this.released++; },
    evacuateVillagePlayer(player, targetSite) {
      assert.equal(targetSite.id, site.id); this.rescues.push(player.id);
      if (this.refuseRescue) return false;
      if (this.requireStoredBlock && archives.size === 0) return false;
      player.location = {x: 0, y: -55, z: 0}; return true;
    },
  };
  const belly = {ready: true, prepared: 0, refuseStore: false,
    prepare(targetSite) { assert.equal(targetSite.id, site.id); this.prepared++; },
    isReady(id) { assert.equal(id, site.id); return this.ready; },
    landingFor(id) { assert.equal(id, site.id); return this.ready
      ? {siteId: id, location: {x: site.x+.5, y: -55, z: site.z+.5}} : undefined; },
    storeDeferred() { return this.deferred ?? false; },
    storeBlock(id, block) {
      assert.equal(id, site.id); if (this.refuseStore || this.deferred) return false;
      const pending = JSON.parse(properties.get(FEAST_PROPERTY));
      assert.equal(pending.pending.length, 1, 'Write intent must be persistent before copying');
      assert.ok(villages.consumed, 'Consumed marker prevents rebuilding before copying');
      if (!archives.has(key(block.location))) {
        archives.set(key(block.location), block.type); recordWrite();
      }
      return true;
    },
  };
  let feast = new VillageFeast(world, villages, monster, belly);
  const tick = (time, active = true) => { world.time = time; feast.tick(time, active); };
  const feeding = () => { tick(0); tick(FEAST_WARNING); tick(FEAST_WARNING+FEAST_APPROACH); };
  const complete = (limit = 2400) => {
    for (let time = world.time+1; time < limit && feast.state.phase !== 'cooldown'; time++) tick(time);
  };
  const reload = () => { feast = new VillageFeast(world, villages, monster, belly); return feast; };
  return {world, dimension, player, site, entry, blocks, properties, archives, containers, writes,
    villages, monster, belly, feast, tick, feeding, complete, reload};
}

test('requires active adventure, ready belly, eligible nearby players and a free global monster', () => {
  const f = fixture();
  f.tick(0, false); assert.equal(f.feast.state.phase, 'idle');
  f.player.mode = 'Creative'; f.tick(1); assert.equal(f.belly.prepared, 0);
  f.player.mode = 'Spectator'; f.tick(2); assert.equal(f.belly.prepared, 0);
  f.player.mode = 'Survival'; f.monster.busy = true; f.tick(3); assert.equal(f.belly.prepared, 0);
  f.monster.busy = false; f.belly.ready = false; f.tick(4);
  assert.equal(f.belly.prepared, 1); assert.equal(f.monster.acquired, 0);
  f.belly.ready = true; f.tick(5); assert.equal(f.feast.state.phase, 'warning');
  assert.equal(f.monster.acquired, 0); assert.equal(f.archives.size, 0);
});

test('the monster approaches before feeding and each removal is copied inside its open mouth', () => {
  const f = fixture(); f.feeding();
  assert.equal(f.feast.state.phase, 'feeding'); assert.equal(f.archives.size, 0);
  assert.equal(f.monster.acquired, 1);
  f.complete();
  assert.equal(f.feast.state.outcome, 'complete'); assert.equal(f.archives.size, 2);
  assert.equal(f.blocks.get('0,63,0'), 'minecraft:spruce_planks');
  assert.equal(f.monster.released, 1);
  assert.equal(f.feast.state.cooldownUntil-f.world.time, FEAST_COOLDOWN);
});

test('dense full-width villages finish without skipping plan columns or exceeding twelve writes per tick', () => {
  const jobs = [];
  for (let x = -16; x <= 16; x++) for (let z = -17; z <= 27; z++) jobs.push(job(x, 63, z));
  for (let x = -15; x <= 15; x++) for (let y = 64; y <= 71; y++) jobs.push(job(x, y, 0, 'minecraft:oak_planks'));
  const f = fixture(jobs); f.player.location = {x: 30, y: 64, z: 0}; f.feeding(); f.complete();
  assert.equal(f.feast.state.outcome, 'complete');
  assert.equal(f.archives.size, jobs.length);
  assert.ok([...f.blocks.values()].every(type => type === 'minecraft:air'));
  assert.ok(Math.max(...f.writes.values()) <= FEAST_BATCH_SIZE*2);
  const open = f.monster.poses.filter(pose => pose.openness > .5);
  assert.ok(open.some(pose => pose.mouth.x < 0) && open.some(pose => pose.mouth.x > 0));
});

test('filled chests and foreign edits remain while empty containers may be archived', () => {
  const f = fixture([job(-12, 64, 0, 'minecraft:chest'), job(12, 64, 0, 'minecraft:barrel'), job(-12, 65, 0)]);
  f.containers.set('-12,64,0', {size: 27, emptySlotsCount: 26});
  f.containers.set('12,64,0', {size: 27, emptySlotsCount: 27});
  f.blocks.set('-12,65,0', 'minecraft:diamond_block');
  f.blocks.set('40,64,0', 'minecraft:oak_planks');
  f.feeding(); f.complete();
  assert.equal(f.feast.state.outcome, 'complete');
  assert.equal(f.blocks.get('-12,64,0'), 'minecraft:chest');
  assert.equal(f.blocks.get('-12,65,0'), 'minecraft:diamond_block');
  assert.equal(f.blocks.get('40,64,0'), 'minecraft:oak_planks');
  assert.equal(f.archives.size, 1);
});

test('players are rescued before their supporting block disappears, without moving submarine riders', () => {
  for (const submarine of [false, true]) {
    const f = fixture([job(-12, 63, 0)]); f.player.location = {x: -11.5, y: 64, z: .5};
    if (submarine) f.player.mount = {typeId: 'lumen_birds:submarine'};
    f.feeding(); f.complete();
    assert.equal(f.feast.state.outcome, 'complete');
    assert.equal(f.monster.rescues.length, submarine ? 0 : 1);
    if (!submarine) assert.equal(f.player.location.y, -55);
  }
});

test('failed rescue or archive leaves the source intact and stops the live encounter', () => {
  for (const reason of ['rescue', 'archive', 'consumed']) {
    const f = fixture([job(-12, 63, 0)]); f.player.location = {x: -11.5, y: 64, z: .5};
    if (reason === 'rescue') f.monster.refuseRescue = true;
    if (reason === 'archive') f.belly.refuseStore = true;
    if (reason === 'consumed') f.villages.refuseConsume = true;
    f.feeding(); f.complete();
    assert.equal(f.feast.state.outcome, 'unavailable', reason);
    assert.equal(f.blocks.get('-12,63,0'), 'minecraft:spruce_planks', reason);
    assert.equal(f.monster.released, 1);
  }
});

test('temporary belly occupancy or exhausted copy budget holds the mouth and retries without consuming the village', () => {
  const f = fixture([job(-12, 63, 0)]); f.belly.deferred = true; f.feeding();
  for (let i = 0; i < 60; i++) f.tick(f.world.time+1);
  assert.equal(f.feast.state.phase, 'feeding'); assert.equal(f.villages.consumed, false);
  assert.equal(f.archives.size, 0); assert.equal(f.blocks.get('-12,63,0'), 'minecraft:spruce_planks');
  const mouth = {...f.feast.mouth};
  f.tick(f.world.time+1); assert.deepEqual(f.feast.mouth, mouth);
  f.belly.deferred = false; f.complete();
  assert.equal(f.feast.state.outcome, 'complete'); assert.equal(f.archives.size, 1);
});

test('script reload aborts partial feeding without replaying any removed block or copying it again', () => {
  const f = fixture(); f.feeding();
  while (f.archives.size === 0 && f.world.time < 900) f.tick(f.world.time+1);
  assert.equal(f.archives.size, 1); assert.equal(f.villages.consumed, true);
  const count = f.archives.size, before = new Map(f.blocks), restored = f.reload();
  f.tick(f.world.time+1);
  assert.equal(restored.state.outcome, 'reload');
  assert.equal(f.archives.size, count); assert.deepEqual(f.blocks, before);
  assert.equal(f.villages.attackableVillages().length, 0);
});

test('unload, failed entity motion and loss of all players abort without mass deletion', () => {
  for (const reason of ['unload', 'pose', 'disconnect']) {
    const f = fixture(); f.feeding();
    if (reason === 'unload') f.dimension.loaded = false;
    if (reason === 'pose') f.monster.failPose = true;
    if (reason === 'disconnect') f.world.players = [];
    f.complete();
    assert.equal(f.feast.state.phase, 'cooldown');
    assert.equal(f.archives.size, 0); assert.ok([...f.blocks.values()].every(type => type !== 'minecraft:air'));
  }
});

test('write intent must persist before archiving or removing source blocks', () => {
  const f = fixture([job(-12, 63, 0)]); f.feeding(); f.world.failSave = true; f.complete();
  assert.equal(f.archives.size, 0); assert.equal(f.blocks.get('-12,63,0'), 'minecraft:spruce_planks');
  assert.equal(f.feast.failed, true);
});

test('a copy survives a failed source write and is not duplicated on reload', () => {
  const f = fixture([job(-12, 63, 0)]); f.feeding(); f.dimension.failRemove = true; f.complete();
  assert.equal(f.archives.size, 1); assert.equal(f.blocks.get('-12,63,0'), 'minecraft:spruce_planks');
  assert.equal(f.villages.consumed, true);
  const next = f.reload(); f.tick(f.world.time+1);
  assert.equal(next.state.phase, 'cooldown'); assert.equal(f.archives.size, 1);
});

test('a crash after removal preserves the pending checkpoint without replaying or refilling the source', () => {
  const f = fixture([job(-12, 63, 0)]); f.feeding();
  f.dimension.afterRemove = () => { f.world.failSave = true; };
  f.complete();
  assert.equal(f.blocks.get('-12,63,0'), 'minecraft:air');
  assert.deepEqual(JSON.parse(f.properties.get(FEAST_PROPERTY)).pending, [0]);
  f.world.failSave = false;
  const next = f.reload(); f.tick(f.world.time+1);
  assert.equal(next.state.outcome, 'reload'); assert.deepEqual(next.state.pending, [0]);
  assert.equal(f.archives.size, 1); assert.equal(f.blocks.get('-12,63,0'), 'minecraft:air');
});

test('tagged residents reach their village belly chamber before feeding begins', () => {
  const f = fixture(); f.entry.residentTags = ['resident1'];
  const resident = {typeId: 'minecraft:villager_v2', tags: ['resident1'], location: {x: -12, y: 64, z: 0},
    tryTeleport(at) { this.location = at; return true; }};
  const unrelated = {typeId: 'minecraft:villager_v2', tags: [], location: {x: 40, y: 64, z: 0}};
  f.dimension.residents = [resident, unrelated]; f.feeding();
  assert.deepEqual(resident.location, {x: .5, y: -55, z: .5});
  assert.deepEqual(unrelated.location, {x: 40, y: 64, z: 0});
  assert.equal(f.feast.state.phase, 'feeding'); assert.equal(f.archives.size, 0);
});

test('remote residents can be rescued when the original start village is not loaded', () => {
  const site = {id: 'eastwatch', name: 'Ostwacht', x: 192, z: 0, spawn: {x: 192.5, y: 64, z: .5}};
  const f = fixture([job(204, 63, 0)], site); f.entry.residentTags = ['resident_east'];
  const resident = {typeId: 'minecraft:villager_v2', tags: ['resident_east'], location: {x: 204, y: 64, z: 0},
    tryTeleport(at) { this.location = at; return true; }};
  f.dimension.residents = [resident];
  const getBlock = f.dimension.getBlock.bind(f.dimension);
  f.dimension.getBlock = at => { if (at.x < 128) throw new Error('Start village is not loaded'); return getBlock(at); };
  f.feeding();
  assert.equal(f.feast.state.phase, 'feeding');
  assert.deepEqual(resident.location, {x: 192.5, y: -55, z: .5});
});

test('the first supporting block is archived before a player enters the newly swallowed village', () => {
  const f = fixture([job(-12, 63, 0)]); f.player.location = {x: -11.5, y: 64, z: .5};
  f.monster.requireStoredBlock = true; f.feeding(); f.complete();
  assert.equal(f.feast.state.outcome, 'complete'); assert.equal(f.monster.rescues.length, 1);
  assert.equal(f.blocks.get('-12,63,0'), 'minecraft:air');
});

test('the approach begins within normally loaded chunks near the village', () => {
  const f = fixture([job(0, 63, -17), job(12, 63, 27)]);
  f.monster.boundedSpawning = true; f.feeding();
  assert.equal(f.monster.acquired, 1); assert.equal(f.feast.state.phase, 'feeding');
});

test('the complete return arc keeps the monster center within loaded village columns', () => {
  const f = fixture([job(-16, 63, -17), job(16, 63, 27)]);
  f.monster.boundedSpawning = true; f.monster.boundedMotion = true;
  f.feeding(); f.complete();
  assert.equal(f.feast.state.outcome, 'complete'); assert.equal(f.archives.size, 2);
});

test('the closed return route is continuous and feeding lanes cover negative coordinates', () => {
  const site = {id: 'far', name: 'Far', x: -160, z: 144, spawn: {x: -159.5, y: 64, z: 144.5}};
  const jobs = [job(-176, 62, 127), job(-144, 71, 171)];
  const route = feastRoute({site, blocks: jobs});
  for (let i = 1; i < route.length; i++) assert.deepEqual(route[i-1].to, route[i].from);
  assert.equal(route.filter(segment => segment.eating).length, 2);
  for (const block of jobs) assert.ok(route.some(segment => segment.eating
    && mouthContains(block, {x: segment.from.x, z: block.location.z+.5})));
  assert.equal(FEAST_SPEED, .3);
});
