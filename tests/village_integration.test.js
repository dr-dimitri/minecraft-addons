import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BellyRooms, BELLY_BATCH_SIZE, BELLY_Y_OFFSET, BELLY_BLOCK_COUNT} from '../src/belly_rooms.js';
import {VillageFeast, FEAST_BATCH_SIZE, mouthContains} from '../src/village_feast.js';
import {MonsterEncounter, RETURN_PROPERTY} from '../src/monster_encounter.js';
import {VILLAGE_SITES, villageBlocks} from '../src/ocean_village.js';

const coordinate = at => `${Math.floor(at.x)},${Math.floor(at.y)},${Math.floor(at.z)}`;
const definition = JSON.parse(readFileSync(new URL('../behavior_pack/entities/deepmaw.json', import.meta.url), 'utf8'))['minecraft:entity'];

function adventure() {
  const site = VILLAGE_SITES[0], plan = villageBlocks(site);
  const properties = new Map(), blocks = new Map(), entities = new Map(), writes = [], operations = [];
  let serial = 0, maxEntities = 0;
  for (const job of plan) blocks.set(coordinate(job.location), {type: job.type, states: {}});
  const supported = plan.find(job => !job.protected && job.location.y === 63 && job.location.x === -16);
  const sources = new Map(plan.map(job => [coordinate(job.location), job]));
  const dimension = {id: 'minecraft:overworld', heightRange: {min: -64, max: 320},
    loaded: at => Math.abs(at.x) <= 64 && Math.abs(at.z) <= 64,
    getBlock(at) {
      if (!this.loaded(at)) throw new Error('Outside loaded village columns');
      const location = {x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z)};
      const key = coordinate(location), record = blocks.get(key) ?? {
        type: location.y < -38 ? 'minecraft:deepslate' : location.y <= 62 ? 'minecraft:water' : 'minecraft:air', states: {},
      };
      const set = (type, states) => {
        const source = sources.get(key);
        if (source && type === 'minecraft:air') {
          const copy = blocks.get(coordinate({...source.location, y: source.location.y+BELLY_Y_OFFSET}));
          assert.equal(copy?.type, source.type, 'Actual BellyRooms copy must precede source removal');
          assert.deepEqual(copy.states, record.states);
          if (key === coordinate(supported.location)) {
            assert.ok(player.location.y < -40, 'Actual MonsterEncounter must rescue the standing player first');
            assert.equal(JSON.parse(player.getDynamicProperty(RETURN_PROPERTY)).kind, 'room');
          }
          operations.push({kind: 'remove', key, tick: world.time});
        }
        blocks.set(key, {type, states: {...states}});
        writes.push({location, type, tick: world.time});
      };
      return {typeId: record.type, isAir: record.type === 'minecraft:air',
        permutation: {type: {id: record.type}, getAllStates: () => ({...record.states}),
          getState: name => name === 'liquid_depth' && record.type === 'minecraft:water' ? 0 : record.states[name]},
        setType(type) { set(type, {}); },
        setPermutation(permutation) { set(permutation.type.id, permutation.getAllStates()); },
        getComponent(id) {
          assert.equal(id, 'minecraft:inventory');
          return ['minecraft:chest', 'minecraft:barrel'].includes(record.type)
            ? {container: {size: 27, emptySlotsCount: 27, getItem: () => undefined}} : undefined;
        },
      };
    },
    getEntities(options = {}) {
      return [...entities.values()].filter(entity => !options.type || entity.typeId === options.type)
        .filter(() => !options.tags?.length);
    },
    spawnEntity(typeId, location) {
      const entity = {id: 'giant-' + (++serial), typeId, location: {...location}, dimension, valid: true,
        properties: new Map(), expires: world.time+definition.components['minecraft:timer'].time*20,
        getRotation() { return this.rotation ?? {x: 0, y: 0}; },
        setProperty(name, value) { if (!this.valid) throw new Error('Expired entity'); this.properties.set(name, value); },
        tryTeleport(at, options) {
          if (!this.valid) return false;
          this.location = {...at}; this.rotation = options.rotation; return true;
        },
        triggerEvent(name) {
          const event = definition.events[name]; assert.ok(event, 'Generated entity must define ' + name);
          for (const groupName of event.add?.component_groups ?? []) {
            const group = definition.component_groups[groupName];
            if (group['minecraft:timer']) this.expires = world.time+group['minecraft:timer'].time*20;
            if (group['minecraft:instant_despawn']) this.remove();
          }
        },
        remove() { this.valid = false; entities.delete(this.id); },
      };
      entities.set(entity.id, entity); maxEntities = Math.max(maxEntities, entities.size); return entity;
    },
  };
  const player = {id: 'standing-player', typeId: 'minecraft:player', dimension,
    location: {x: supported.location.x+.5, y: 64, z: supported.location.z+.5},
    properties: new Map(), effects: new Map(), isSneaking: false,
    getGameMode() { return 'Survival'; }, getComponent() { return undefined; },
    getDynamicProperty(name) { return this.properties.get(name); },
    setDynamicProperty(name, value) { if (value === undefined) this.properties.delete(name); else this.properties.set(name, value); },
    getEffect(name) { return this.effects.get(name); },
    addEffect(name, duration, options) { this.effects.set(name, {duration, amplifier: options.amplifier}); },
    removeEffect(name) { this.effects.delete(name); },
    tryTeleport(at) {
      const feet = dimension.getBlock(at), head = dimension.getBlock({...at, y: at.y+1});
      if (!feet.isAir || !head.isAir) return false;
      if (at.y < -40) {
        assert.ok(rooms.entryFor(this, site.id), 'Real chamber must contain a persistently archived piece');
        assert.equal(dimension.getBlock(supported.location).typeId, supported.type, 'Supporting source survives until rescue');
        operations.push({kind: 'rescue', tick: world.time});
      }
      this.location = {...at}; return true;
    },
    onScreenDisplay: {setActionBar() {}},
  };
  const world = {time: 0, players: [player], getAbsoluteTime() { return this.time; }, getTimeOfDay() { return 6000; },
    getPlayers() { return this.players; }, getDimension(id) { assert.equal(id, 'overworld'); return dimension; },
    getDynamicProperty(name) { return properties.get(name); },
    setDynamicProperty(name, value) {
      if (typeof value === 'string') assert.ok(value.length <= 32767);
      properties.set(name, value);
    },
  };
  const villages = {consumed: false,
    attackableVillages() { return this.consumed ? [] : [{site, blocks: plan, residentTags: []}]; },
    markConsumed(id) { assert.equal(id, site.id); this.consumed = true; return true; },
  };
  const rooms = new BellyRooms(world);
  const monster = new MonsterEncounter(world, () => {}, {bellyRooms: rooms});
  const feast = new VillageFeast(world, villages, monster, rooms);
  const step = () => {
    world.time++;
    for (const entity of [...entities.values()]) if (entity.expires <= world.time) entity.remove();
    rooms.tick(world.time, true);
    monster.tick(world.time);
    feast.tick(world.time, true);
  };
  return {world, dimension, site, plan, supported, player, blocks, writes, operations, rooms,
    monster, feast, villages, step, maxEntities: () => maxEntities};
}

test('real belly, feast and monster controllers archive the support, rescue its player, then remove the source', () => {
  const f = adventure();
  for (let i = 0; i < 2600 && !f.operations.some(operation => operation.kind === 'rescue'); i++) f.step();
  assert.ok(f.rooms.isReady(f.site.id));
  assert.ok(f.operations.some(operation => operation.kind === 'rescue'), 'Encounter must reach a real belly entry');
  const rescue = f.operations.findIndex(operation => operation.kind === 'rescue');
  const removal = f.operations.findIndex(operation => operation.kind === 'remove'
    && operation.key === coordinate(f.supported.location));
  assert.ok(removal > rescue, 'Standing player enters the chamber before their surface floor is removed');
  assert.equal(f.rooms.contains(f.player, f.site.id), true);
  assert.equal(JSON.parse(f.player.getDynamicProperty(RETURN_PROPERTY)).siteId, f.site.id);
  assert.ok(f.player.getEffect('water_breathing')); assert.equal(f.player.getEffect('resistance').amplifier, 4);
});

test('the generated native timer permits complete real-controller feeding within copy and construction budgets', () => {
  const f = adventure();
  for (let i = 0; i < 2800 && f.feast.state.phase !== 'cooldown'; i++) f.step();
  assert.equal(f.feast.state.outcome, 'complete');
  assert.equal(f.maxEntities(), 1, 'Surface feeding and ordinary encounters share one giant');
  assert.equal(f.villages.consumed, true);
  const removed = f.operations.filter(operation => operation.kind === 'remove');
  assert.equal(removed.length, f.plan.filter(job => !job.protected).length);
  for (const job of f.plan) {
    const source = f.dimension.getBlock(job.location);
    if (job.protected) assert.equal(source.typeId, job.type);
    else {
      assert.equal(source.typeId, 'minecraft:air');
      assert.equal(f.dimension.getBlock({...job.location, y: job.location.y+BELLY_Y_OFFSET}).typeId, job.type);
    }
  }
  const perTick = new Map();
  for (const write of f.writes) perTick.set(write.tick, (perTick.get(write.tick) ?? 0)+1);
  assert.ok([...perTick.values()].every(count => count <= BELLY_BATCH_SIZE));
  const feedingTicks = new Set(removed.map(operation => operation.tick));
  assert.ok([...feedingTicks].every(tick => perTick.get(tick) <= FEAST_BATCH_SIZE*2));
  assert.equal(f.writes.length, BELLY_BLOCK_COUNT+2*removed.length);
});

test('real concurrent chamber construction and a belly visitor only pause feeding until the copy becomes possible', () => {
  const f = adventure();
  while (f.world.time < 1200 && f.feast.state.phase !== 'feeding') f.step();
  assert.equal(f.feast.state.phase, 'feeding');
  const remote = VILLAGE_SITES[1];
  f.dimension.loaded = at => Math.abs(at.z) <= 64
    && (Math.abs(at.x) <= 64 || Math.abs(at.x-remote.x) <= 64);
  const visitor = {id: 'belly-visitor', dimension: f.dimension, location: {...remote.spawn},
    getGameMode: () => 'Creative', getDynamicProperty: () => undefined, getComponent: () => undefined};
  f.world.players.push(visitor); f.rooms.prepare(remote);
  for (let i = 0; i < 50; i++) f.step();
  assert.equal(f.rooms.writes, BELLY_BATCH_SIZE, 'The real second-room builder spends this tick\'s copy budget');
  assert.equal(f.feast.state.phase, 'feeding'); assert.equal(f.villages.consumed, false);
  assert.equal(f.operations.filter(operation => operation.kind === 'remove').length, 0);
  // Moving away pauses that room's construction and frees the shared budget;
  // this visitor now temporarily occupies a coming house-floor copy position.
  visitor.location = {...f.supported.location, x: f.supported.location.x+.5,
    y: f.supported.location.y+BELLY_Y_OFFSET, z: f.supported.location.z+.5};
  while (f.world.time < 2000 && !mouthContains(f.supported, f.feast.mouth)) f.step();
  for (let i = 0; i < 60; i++) f.step();
  assert.equal(f.feast.state.phase, 'feeding');
  assert.equal(f.dimension.getBlock(f.supported.location).typeId, f.supported.type);
  assert.equal(f.rooms.storeDeferred(f.site.id, f.supported), true);
  const waitingMouth = {...f.feast.mouth}; f.step(); assert.deepEqual(f.feast.mouth, waitingMouth);
  visitor.location = {...f.rooms.landingFor(f.site.id).location};
  for (let i = 0; i < 2000 && f.feast.state.phase !== 'cooldown'; i++) f.step();
  assert.equal(f.feast.state.outcome, 'complete');
  assert.equal(f.operations.filter(operation => operation.kind === 'remove').length,
    f.plan.filter(job => !job.protected).length);
});
