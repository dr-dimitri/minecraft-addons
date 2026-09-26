import test from 'node:test';
import assert from 'node:assert/strict';
import {MonsterEncounter, RETURN_PROPERTY, ESCAPE_TIMEOUT, BELLY_ROOM_TIMEOUT, protectPassenger} from '../src/monster_encounter.js';
import {findMonsterHabitat, isMonsterPositionSafe, MONSTER_SEARCH_BUDGET, monsterPositionAt} from '../src/sea_monster.js';

function fixture(count = 1) {
  let serial = 0;
  const entities = new Map();
  const dim = {id: 'minecraft:overworld', heightRange: {min: -64, max: 320},
    reads: 0, medium: 'minecraft:water', waterBottom: 0, waterTop: 63, loaded: true, removalFails: false, failSpawn: false,
    failMove: false, blocks: new Map(),
    getBlock({x, y, z}) {
      this.reads++;
      if (!this.loaded) throw new Error('Unloaded');
      const typeId = this.blocks.get([x, y, z].join(',')) ?? (y >= this.waterBottom && y < this.waterTop ? this.medium : 'minecraft:air');
      return {typeId, isAir: typeId === 'minecraft:air', permutation: {getState: () => 0}};
    },
    getEntities({type}) { return [...entities.values()].filter(e => e.typeId === type); },
    spawnEntity(typeId, location) {
      if (this.failSpawn) throw new Error('Spawn failed');
      const e = {id: String(++serial), typeId, location: {...location}, dimension: dim,
        properties: new Map(), events: [],
        setProperty(name, value) { this.properties.set(name, value); },
        triggerEvent(name) { this.events.push(name); },
        getRotation() { return this.rotation ?? {x: 0, y: 0}; },
        tryTeleport(at, options) {
          if (dim.failMove) return false;
          this.location = {...at}; this.rotation = options.rotation; return true;
        },
        remove() { if (dim.removalFails) throw new Error('Removal failed'); entities.delete(this.id); },
      };
      entities.set(e.id, e); return e;
    },
  };
  const players = Array.from({length: count}, (_, i) => ({
    id: 'p' + i, dimension: dim, location: {x: i * 200, y: 64, z: 0}, isSneaking: false,
    effects: new Map(), properties: new Map(), mode: 'Survival', teleports: 0, failTeleport: false,
    getGameMode() { return this.mode; },
    getComponent(type) { return type === 'minecraft:riding' && this.mount
      ? {entityRidingOn: this.mount} : undefined; },
    getEffect(type) { return this.effects.get(type); },
    addEffect(type, duration, options) {
      if (this.failEffect) return;
      this.effects.set(type, {duration, amplifier: options.amplifier});
    },
    removeEffect(type) { this.effects.delete(type); },
    getDynamicProperty(key) { return this.properties.get(key); },
    setDynamicProperty(key, value) { if (value === undefined) this.properties.delete(key); else this.properties.set(key, value); },
    tryTeleport(at, options) {
      if (this.failTeleport) return false;
      this.location = {...at}; this.options = options; this.teleports++; return true;
    },
    onScreenDisplay: {setActionBar() {}},
  }));
  const world = {players, time: 6000, absolute: 0, getPlayers() { return this.players; },
    getTimeOfDay() { return this.time; }, getAbsoluteTime() { return this.absolute; },
    getDimension(id) { assert.equal(id, 'overworld'); return dim; }};
  const manager = new MonsterEncounter(world);
  const tick = n => { world.absolute = n; manager.tick(n); };
  const approach = (p = players[0]) => {
    const swimmer = [...manager.swimmers.values()][0];
    const pose = monsterPositionAt('deepmaw', swimmer.group.habitat, 2, swimmer.phase);
    const yaw = pose.rotation.y * Math.PI / 180;
    p.location = {x: pose.location.x - Math.sin(yaw) * 8, y: pose.location.y - .8,
      z: pose.location.z + Math.cos(yaw) * 8};
    return pose;
  };
  return {dim, entities, players, world, manager, tick, approach};
}

test('giant habitat requires deep open water and uses bounded reads', () => {
  const f = fixture();
  assert.ok(findMonsterHabitat(f.dim, f.players[0]));
  assert.ok(f.dim.reads <= MONSTER_SEARCH_BUDGET);
  for (const medium of ['minecraft:lava', 'minecraft:oak_stairs', 'minecraft:air']) {
    f.dim.medium = medium; f.dim.reads = 0;
    assert.equal(findMonsterHabitat(f.dim, f.players[0]), undefined);
    assert.ok(f.dim.reads <= MONSTER_SEARCH_BUDGET);
  }
  f.dim.medium = 'minecraft:water'; f.dim.loaded = false;
  assert.equal(findMonsterHabitat(f.dim, f.players[0]), undefined);
  f.dim.loaded = true;
  const at = {x: 0, y: 30, z: 0};
  assert.equal(isMonsterPositionSafe(f.dim, at), true);
  f.dim.blocks.set('11,30,0', 'minecraft:stone');
  assert.equal(isMonsterPositionSafe(f.dim, at), false);
});

test('intermediate depths find a complete giant route in seventeen water layers', () => {
  for (const shift of [0, -64]) for (let y = 55; y <= 78; y++) {
    const f = fixture(); f.dim.waterBottom = 46 + shift; f.dim.waterTop = 63 + shift;
    f.players[0].location.y = y + shift;
    const habitat = findMonsterHabitat(f.dim, f.players[0]);
    assert.ok(habitat, `player height ${y + shift}`);
    assert.equal(habitat.y, 54.5 + shift);
    assert.ok(f.dim.reads <= MONSTER_SEARCH_BUDGET);
    if (y === 63 || y === 64) {
      f.tick(0);
      assert.equal(f.manager.swimmers.size, 1);
    }
  }
});

test('intermediate depth search still rejects sixteen water layers within its budget', () => {
  const f = fixture(); f.dim.waterBottom = 47;
  assert.equal(findMonsterHabitat(f.dim, f.players[0]), undefined);
  assert.ok(f.dim.reads <= MONSTER_SEARCH_BUDGET);
});

test('intermediate depth refinement does not exhaust the budget before a clear neighboring route', () => {
  const f = fixture();
  for (let y = 0; y < 63; y++) f.dim.blocks.set([-1, y, 9].join(','), 'minecraft:stone');
  const habitat = findMonsterHabitat(f.dim, f.players[0]);
  assert.ok(habitat);
  assert.equal(habitat.x, 16.5);
  assert.ok(f.dim.reads <= MONSTER_SEARCH_BUDGET);
});

test('one giant stays independent of fish and bird budgets, at all times of day', () => {
  const f = fixture(5);
  const bird = f.dim.spawnEntity('lumen_birds:raven', {x: 0, y: 80, z: 0});
  const fish = f.dim.spawnEntity('lumen_birds:pike', {x: 0, y: 60, z: 0});
  for (const time of [0, 6000, 12000, 18000]) {
    f.world.time = time; f.tick(time);
    assert.equal(f.manager.swimmers.size, 1); assert.equal(f.entities.size, 3);
    assert.ok(f.entities.has(bird.id) && f.entities.has(fish.id));
  }
});

test('mouth entry protects before teleport, holds monster still and provides a swim exit', () => {
  const f = fixture(); f.tick(0); f.approach(); f.tick(40);
  const p = f.players[0], ride = f.manager.passenger;
  assert.ok(ride); assert.ok(p.getDynamicProperty(RETURN_PROPERTY));
  assert.equal(p.effects.get('resistance').amplifier, 4);
  assert.ok(p.effects.has('water_breathing'));
  const before = {...ride.pose.location}; f.tick(45);
  assert.deepEqual([...f.entities.values()][0].location, before);
  const yaw = ride.pose.rotation.y * Math.PI / 180;
  p.location = {x: before.x - Math.sin(yaw) * 7.6, y: before.y - .8, z: before.z + Math.cos(yaw) * 7.6};
  f.tick(46);
  assert.equal(f.manager.passenger, undefined); assert.equal(p.getDynamicProperty(RETURN_PROPERTY), undefined);
  assert.equal(p.location.y, 63); assert.ok(f.manager.cooldowns.has(p.id));
});

test('sneaking, timeout and missing monster each release passengers alive to the surface', () => {
  for (const reason of ['sneak', 'timeout', 'missing']) {
    const f = fixture(); f.tick(0); f.approach(); f.tick(40);
    if (reason === 'sneak') f.players[0].isSneaking = true;
    if (reason === 'missing') f.manager.retire(f.manager.passenger.monsterId);
    f.tick(reason === 'timeout' ? 40 + ESCAPE_TIMEOUT : 41);
    assert.equal(f.manager.passenger, undefined);
    assert.equal(f.players[0].location.y, 63);
    assert.equal(f.players[0].getDynamicProperty(RETURN_PROPERTY), undefined);
  }
});

test('script reload and disconnect recover using persistent player information', () => {
  for (const reason of ['reload', 'disconnect']) {
    const f = fixture(); f.tick(0); f.approach(); f.tick(40);
    if (reason === 'reload') new MonsterEncounter(f.world).tick(41);
    else { f.world.players = []; f.tick(41); f.world.players = f.players; f.tick(42); }
    assert.equal(f.players[0].getDynamicProperty(RETURN_PROPERTY), undefined);
    assert.equal(f.players[0].location.y, 63);
  }
});

test('failed rescue keeps protection and recovery marker until teleport works', () => {
  const f = fixture(); f.tick(0); f.approach(); f.tick(40);
  const p = f.players[0]; p.failTeleport = true; p.isSneaking = true; f.tick(41);
  assert.ok(p.getDynamicProperty(RETURN_PROPERTY)); assert.equal(f.manager.passenger, undefined);
  assert.ok(p.effects.has('water_breathing'));
  p.failTeleport = false; f.tick(42);
  assert.equal(p.getDynamicProperty(RETURN_PROPERTY), undefined);
});

test('unavailable protection prevents swallowing; creative and spectator are ignored', () => {
  for (const scenario of ['effects', 'Creative', 'Spectator']) {
    const f = fixture(); f.tick(0); f.approach();
    if (scenario === 'effects') f.players[0].failEffect = true;
    else f.players[0].mode = scenario;
    f.tick(40); assert.equal(f.manager.passenger, undefined); assert.equal(f.players[0].teleports, 0);
  }
});

test('submarine passengers stay aboard when passing through the mouth', () => {
  const f = fixture(); f.tick(0); f.approach();
  f.players[0].mount = {typeId: 'lumen_birds:submarine'};
  f.tick(40);
  assert.equal(f.manager.passenger, undefined);
  assert.equal(f.players[0].teleports, 0);
  assert.equal(f.players[0].getDynamicProperty(RETURN_PROPERTY), undefined);
});

test('escape from the deep-sea floor reaches the surface over 64 blocks above', () => {
  const f = fixture(); f.dim.waterBottom = -37;
  f.players[0].location.y = -15;
  f.tick(0); f.approach(); f.tick(40);
  assert.ok(f.manager.passenger);
  assert.ok(f.players[0].location.y < -1);
  f.players[0].isSneaking = true; f.tick(41);
  assert.equal(f.players[0].location.y, 63);
  assert.equal(f.players[0].getDynamicProperty(RETURN_PROPERTY), undefined);
});

function bellyFixture() {
  const f = fixture();
  const entry = {siteId: 'harborlight', location: {x: .5, y: -57, z: -20.5}};
  const rooms = {
    entryFor: () => entry, isReady: () => true,
    contains: player => player.location.y < -40,
    isExit: player => player.location.z < -21,
  };
  f.manager.bellyRooms = rooms;
  return {...f, rooms, entry};
}

test('swallowed players explore an archived village instead of being clamped to the small model', () => {
  const f = bellyFixture(); f.tick(0); f.approach(); f.tick(40);
  const p = f.players[0];
  assert.deepEqual(p.location, f.entry.location);
  assert.equal(JSON.parse(p.getDynamicProperty(RETURN_PROPERTY)).kind, 'room');
  assert.equal(f.manager.passenger, undefined);
  p.location.x += 8; const teleports = p.teleports;
  f.tick(41);
  assert.equal(p.location.x, 8.5);
  assert.equal(p.teleports, teleports);
  const reloaded = new MonsterEncounter(f.world, () => {}, {bellyRooms: f.rooms});
  f.world.absolute = 42; reloaded.tick(42);
  assert.equal(p.location.x, 8.5);
  assert.ok(p.getDynamicProperty(RETURN_PROPERTY));
});

test('belly-village guests can leave through the mouth, by sneaking, timeout, or missing room', () => {
  for (const reason of ['exit', 'sneak', 'timeout', 'missing']) {
    const f = bellyFixture(); f.tick(0); f.approach(); f.tick(40);
    const p = f.players[0];
    if (reason === 'exit') p.location.z = -21.5;
    if (reason === 'sneak') p.isSneaking = true;
    if (reason === 'missing') f.rooms.isReady = () => false;
    f.tick(reason === 'timeout' ? 40 + BELLY_ROOM_TIMEOUT : 41);
    assert.equal(p.location.y, 63, reason);
    assert.equal(p.getDynamicProperty(RETURN_PROPERTY), undefined, reason);
  }
});

test('village evacuation requires a verified room and never moves submarine passengers', () => {
  const f = bellyFixture(), p = f.players[0];
  f.rooms.entryFor = () => undefined;
  assert.equal(f.manager.evacuateVillagePlayer(p, {id: 'harborlight'}), false);
  assert.equal(p.teleports, 0);
  f.rooms.entryFor = () => f.entry;
  p.mount = {typeId: 'lumen_birds:submarine'};
  assert.equal(f.manager.evacuateVillagePlayer(p, {id: 'harborlight'}), true);
  assert.equal(p.teleports, 0);
  p.mount = undefined;
  assert.equal(f.manager.evacuateVillagePlayer(p, {id: 'harborlight'}), true);
  assert.deepEqual(p.location, f.entry.location);
});

test('belly emergency exits reach the sea below a former deck or beyond the protected harbor platform', () => {
  for (const origin of [{x: -11.5, y: 64, z: .5}, {x: .5, y: 64, z: .5}]) {
    const f = bellyFixture(), p = f.players[0];
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
      f.dim.blocks.set([x, 63, z].join(','), 'minecraft:oak_planks');
    }
    p.location = {...origin};
    assert.equal(f.manager.enterBellyRoom(p, f.entry, 0), true);
    p.location = {x: .5, y: -58, z: .5}; p.isSneaking = true;
    f.tick(1);
    assert.equal(p.getDynamicProperty(RETURN_PROPERTY), undefined);
    assert.equal(p.location.y, 63);
    assert.ok(Math.abs(p.location.x) > 3 || Math.abs(p.location.z) > 3);
  }
});

test('the surface feast replaces the ordinary giant within the shared single-entity budget', () => {
  const f = fixture(); f.tick(0);
  const previous = [...f.entities.keys()][0];
  const location = {x: 0, y: 67, z: -45}, rotation = {x: 0, y: 0};
  const giant = f.manager.acquireVillageMonster(location, rotation);
  assert.ok(giant);
  assert.equal(f.entities.size, 1);
  assert.equal(f.entities.has(previous), false);
  assert.deepEqual(giant.events, ['lumen_birds:begin_feast']);
  assert.equal(giant.properties.get('lumen_birds:feast_scale'), 3.5);
  f.tick(100);
  assert.deepEqual(giant.location, location);
  assert.equal(f.entities.size, 1);
  assert.equal(f.manager.acquireVillageMonster(location, rotation), undefined);
  f.manager.releaseVillageMonster();
  assert.equal(f.entities.size, 0);
});

function surfaceSwimmerFixture(yaw = 0, scale = 3.5) {
  const f = bellyFixture(), p = f.players[0];
  const pose = {location: {x: 0, y: 67, z: 0}, rotation: {x: 0, y: yaw}};
  const giant = f.manager.acquireVillageMonster(pose.location, pose.rotation);
  assert.ok(giant);
  assert.equal(f.manager.updateVillageMonster(giant, pose, 1, scale), true);
  const place = (forward = 7.6*scale, side = 0, y = 62) => {
    const angle = yaw*Math.PI/180;
    p.location = {x: -Math.sin(angle)*forward+Math.cos(angle)*side,
      y, z: Math.cos(angle)*forward+Math.sin(angle)*side};
  };
  place();
  return {...f, p, pose, giant, place};
}

test('swimmers inside an open surface mouth enter the village belly at every heading and scale', () => {
  for (const yaw of [0, 90, 180, -90, 37]) for (const scale of [2, 3.5]) {
    const f = surfaceSwimmerFixture(yaw, scale);
    const origin = {...f.p.location}; f.tick(1);
    assert.deepEqual(f.p.location, f.entry.location, `${yaw}/${scale}`);
    const saved = JSON.parse(f.p.getDynamicProperty(RETURN_PROPERTY));
    assert.equal(saved.kind, 'room'); assert.deepEqual(saved.location, origin);
    assert.equal(f.p.getEffect('resistance').amplifier, 4);
    assert.equal(f.manager.passenger, undefined);
    assert.equal(f.manager.villageMonster, f.giant);
  }
});

test('surface swallowing is limited to the actual open mouth and never stale or closed poses', () => {
  for (const reason of ['behind', 'ahead', 'side', 'deep', 'closed', 'missing_room', 'failed_pose', 'air']) {
    const f = surfaceSwimmerFixture();
    if (reason === 'behind') f.place(6*3.5);
    if (reason === 'ahead') f.place(8.4*3.5);
    if (reason === 'side') f.place(7.6*3.5, 2.6*3.5);
    if (reason === 'deep') f.place(7.6*3.5, 0, 56);
    if (reason === 'closed') f.manager.updateVillageMonster(f.giant, f.pose, 0, 3.5);
    if (reason === 'missing_room') f.rooms.entryFor = () => undefined;
    if (reason === 'failed_pose') {
      f.dim.failMove = true;
      assert.equal(f.manager.updateVillageMonster(f.giant, f.pose, 1, 3.5), false);
    }
    if (reason === 'air') f.dim.medium = 'minecraft:air';
    f.tick(1);
    assert.equal(f.p.teleports, 0, reason);
    assert.equal(f.p.getDynamicProperty(RETURN_PROPERTY), undefined, reason);
  }
});

test('surface swallowing respects passenger modes, submarines, recovery markers and escape cooldown', () => {
  for (const reason of ['Creative', 'Spectator', 'submarine', 'cooldown', 'recovery', 'dimension']) {
    const f = surfaceSwimmerFixture();
    if (['Creative', 'Spectator'].includes(reason)) f.p.mode = reason;
    if (reason === 'submarine') f.p.mount = {typeId: 'lumen_birds:submarine'};
    if (reason === 'cooldown') f.manager.cooldowns.set(f.p.id, 100);
    if (reason === 'dimension') f.p.dimension = {...f.dim, id: 'minecraft:nether'};
    if (reason === 'recovery') {
      f.p.setDynamicProperty(RETURN_PROPERTY, JSON.stringify({kind: 'room', siteId: 'harborlight',
        dimension: f.dim.id, time: 0, location: {...f.p.location}, effects: []}));
      f.rooms.contains = () => true;
    }
    f.tick(1);
    assert.equal(f.p.teleports, 0, reason);
  }
  const f = surfaceSwimmerFixture(); f.tick(1);
  f.p.isSneaking = true; f.tick(2);
  assert.equal(f.p.getDynamicProperty(RETURN_PROPERTY), undefined);
  f.p.isSneaking = false; f.place(); const teleports = f.p.teleports; f.tick(3);
  assert.equal(f.p.teleports, teleports);
  assert.equal(f.p.getDynamicProperty(RETURN_PROPERTY), undefined);
});

test('a failed giant removal or an ordinary belly passenger prevents a second giant', () => {
  for (const reason of ['removal', 'passenger']) {
    const f = fixture(); f.tick(0);
    if (reason === 'removal') f.dim.removalFails = true;
    else { f.approach(); f.tick(40); }
    assert.equal(f.manager.acquireVillageMonster({x: 0, y: 67, z: -45}, {x: 0, y: 0}), undefined);
    assert.equal(f.entities.size, 1);
  }
});

test('an external dimension change is respected rather than teleporting the player back', () => {
  const f = fixture(); f.tick(0); f.approach(); f.tick(40);
  f.players[0].dimension = {id: 'minecraft:nether'};
  const count = f.players[0].teleports; f.tick(41);
  assert.equal(f.players[0].teleports, count);
  assert.equal(f.players[0].getDynamicProperty(RETURN_PROPERTY), undefined);
});

test('long stronger effects are preserved and weaker resistance is restored after rescue', () => {
  const f = fixture(), p = f.players[0];
  p.effects.set('water_breathing', {duration: 2000, amplifier: 0});
  protectPassenger(p); assert.equal(p.effects.get('water_breathing').duration, 2000);
  p.effects.set('resistance', {duration: 2000, amplifier: 1});
  f.tick(0); f.approach(); f.tick(40);
  assert.equal(p.effects.get('resistance').duration, 120);
  p.isSneaking = true; f.tick(60);
  assert.deepEqual(p.effects.get('resistance'), {duration: 1980, amplifier: 1});
});

test('failed removals count against global cap and reloaded orphan giants get swept', () => {
  const f = fixture(3); f.tick(0); f.dim.removalFails = true; f.tick(900);
  assert.equal(f.entities.size, 1); assert.equal(f.manager.swimmers.size, 0);
  f.dim.removalFails = false; f.tick(1000); assert.equal(f.manager.swimmers.size, 1);
  const old = [...f.entities.keys()][0]; new MonsterEncounter(f.world).tick(1);
  assert.equal(f.entities.has(old), false); assert.equal(f.entities.size, 1);
});

test('invalid or obstructed water removes the giant and releases its passenger', () => {
  const f = fixture(); f.tick(0); f.approach(); f.tick(40);
  const at = f.manager.passenger.pose.location;
  f.dim.blocks.set([Math.floor(at.x + 10), Math.floor(at.y), Math.floor(at.z)].join(','), 'minecraft:stone');
  f.tick(45); f.tick(46);
  assert.equal(f.manager.passenger, undefined); assert.equal(f.players[0].location.y, 63);
});

test('only one passenger enters, cooldown prevents immediate recapture and walls preserve forward progress', () => {
  const f = fixture(2); f.tick(0); f.approach(); f.approach(f.players[1]); f.tick(40);
  const passenger = f.manager.passenger;
  assert.equal(f.players.filter(p => p.getDynamicProperty(RETURN_PROPERTY) !== undefined).length, 1);
  const p = f.players.find(p => p.id === passenger.playerId);
  const yaw = passenger.pose.rotation.y * Math.PI / 180;
  p.location = {x: passenger.pose.location.x - Math.sin(yaw) * 3 + Math.cos(yaw) * 8,
    y: passenger.pose.location.y + 3,
    z: passenger.pose.location.z + Math.cos(yaw) * 3 + Math.sin(yaw) * 8};
  f.tick(41);
  const dx = p.location.x - passenger.pose.location.x, dz = p.location.z - passenger.pose.location.z;
  assert.ok(Math.abs(-Math.sin(yaw)*dx + Math.cos(yaw)*dz - 3) < 1e-10);
  assert.ok(p.location.y < passenger.pose.location.y);
  p.isSneaking = true; f.tick(42); p.isSneaking = false;
  f.world.players = [p]; f.tick(45); f.tick(100);
  const swimmer = [...f.manager.swimmers.values()][0];
  const pose = monsterPositionAt('deepmaw', swimmer.group.habitat, 2, swimmer.phase);
  const facing = pose.rotation.y * Math.PI / 180;
  p.location = {x: pose.location.x-Math.sin(facing)*8, y: pose.location.y-.8,
    z: pose.location.z+Math.cos(facing)*8};
  f.tick(140); assert.equal(f.manager.passenger, undefined);
});

test('spawn failures and blocked first movement never leak a managed giant', () => {
  for (const option of ['failSpawn', 'failMove']) {
    const f = fixture(); f.dim[option] = true; f.tick(0);
    assert.equal(f.manager.swimmers.size, 0); assert.equal(f.entities.size, 0);
    f.dim[option] = false; f.tick(100); assert.equal(f.entities.size, 1);
  }
});

test('refused initial player teleport leaves a persistent rescue until a retry succeeds', () => {
  const f = fixture(); f.tick(0); f.approach(); f.players[0].failTeleport = true; f.tick(40);
  assert.equal(f.manager.passenger, undefined);
  assert.ok(f.players[0].getDynamicProperty(RETURN_PROPERTY));
  f.players[0].failTeleport = false; f.tick(41);
  assert.equal(f.players[0].getDynamicProperty(RETURN_PROPERTY), undefined);
});
