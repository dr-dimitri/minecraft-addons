import test from 'node:test';
import assert from 'node:assert/strict';
import {MutantFishManager, MAX_MUTANTS, MUTANT_LIFETIME, mutantWaterPath} from '../src/mutant_fish.js';

function fixture() {
  let serial = 0;
  const entities = new Map();
  const dim = {id: 'minecraft:overworld', heightRange: {min: -64, max: 320}, loaded: true,
    blocks: new Map(), removalFails: false, medium: 'minecraft:water',
    getBlock(at) {
      if (!this.loaded) throw new Error('Unloaded chunk');
      return {typeId: this.blocks.get([at.x, at.y, at.z].join(',')) ?? this.medium,
        permutation: {getState: () => 0}};
    },
    getEntities({type}) { return [...entities.values()].filter(entity => entity.typeId === type); },
    spawnEntity(typeId, location) {
      if (this.spawnFails) throw new Error('Spawn failure');
      const entity = {id: String(++serial), typeId, location: {...location}, dimension: dim, health: 8,
        getComponent(name) { assert.equal(name, 'minecraft:health'); return {currentValue: this.health}; },
        tryTeleport(at, options) {
          if (dim.moveFails) return false;
          this.location = {...at}; this.rotation = options.rotation; return true;
        },
        remove() { if (dim.removalFails) throw new Error('Removal failure'); entities.delete(this.id); },
      };
      entities.set(entity.id, entity); return entity;
    },
  };
  const player = {id: 'p1', typeId: 'minecraft:player', dimension: dim, location: {x: 0, y: 0, z: 0},
    mode: 'Survival', hits: [], attempts: 0, invulnerable: false,
    getGameMode() { return this.mode; },
    getComponent(name) { assert.equal(name, 'minecraft:riding'); return this.mount ? {entityRidingOn: this.mount} : undefined; },
    applyDamage(amount, options) {
      this.attempts++;
      if (this.invulnerable) return false;
      this.hits.push({amount, options}); return true;
    },
  };
  const world = {players: [player], difficulty: 'Normal',
    getPlayers() { return this.players; }, getDifficulty() { return this.difficulty; },
    getDimension(name) { assert.equal(name, 'overworld'); return dim; }};
  const manager = new MutantFishManager(world);
  const near = record => { player.location = {x: record.entity.location.x,
    y: record.entity.location.y-.8, z: record.entity.location.z}; };
  return {world, dim, entities, player, manager, near};
}

test('mutants require an explicitly active adventure, deep water and eligible player mode', () => {
  const f = fixture();
  f.manager.tick(0); assert.equal(f.entities.size, 0);
  for (const mode of ['Creative', 'Spectator']) {
    f.player.mode = mode; f.manager.tick(100, true); assert.equal(f.entities.size, 0);
    f.manager.lastReconcile = -Infinity;
  }
  f.player.mode = 'Survival'; f.player.location.y = 21; f.manager.tick(200, true);
  assert.equal(f.entities.size, 0);
  f.player.location.y = 0; f.manager.tick(300, true); assert.equal(f.entities.size, MAX_MUTANTS);
  assert.equal(new Set([...f.entities.values()].map(entity => entity.typeId)).size, 2);
});

test('the global loaded cap includes failed removals and excludes decorative species', () => {
  const f = fixture();
  const bird = f.dim.spawnEntity('lumen_birds:raven', {x: 0, y: 60, z: 0});
  const fish = f.dim.spawnEntity('lumen_birds:trout', {x: 0, y: 0, z: 0});
  f.manager.tick(0, true); assert.equal(f.entities.size, MAX_MUTANTS + 2);
  f.dim.removalFails = true;
  const reloaded = new MutantFishManager(f.world); reloaded.tick(0, true);
  assert.equal(reloaded.fish.size, 0); assert.equal(f.entities.size, MAX_MUTANTS + 2);
  assert.ok(f.entities.has(bird.id)); assert.ok(f.entities.has(fish.id));
});

test('a close mutant uses native entity attack damage and its attack cooldown', () => {
  const f = fixture(); f.manager.tick(0, true);
  const first = [...f.manager.fish.values()][0]; f.near(first); f.manager.tick(5, true);
  assert.equal(f.player.hits.length, 1);
  assert.equal(f.player.hits[0].amount, 2);
  assert.deepEqual(f.player.hits[0].options, {cause: 'entityAttack', damagingEntity: first.entity});
  // Keep only this predator to check its own 40-tick cooldown.
  for (const [id] of f.manager.fish) if (id !== first.entity.id) f.manager.retire(id);
  f.manager.tick(10, true); f.manager.tick(40, true); assert.equal(f.player.hits.length, 1);
  f.manager.tick(45, true); assert.equal(f.player.hits.length, 2);
});

test('several close mutants cannot bypass the shared one-hit-per-second limit', () => {
  const f = fixture(); f.manager.tick(0, true);
  for (const record of f.manager.fish.values()) record.entity.location = {x: 0, y: .8, z: 0};
  f.manager.tick(5, true); assert.equal(f.player.hits.length, 1);
  f.manager.tick(10, true); assert.equal(f.player.hits.length, 1);
  f.manager.tick(25, true); assert.equal(f.player.hits.length, 2);
});

test('native invulnerability is respected without retrying damage every movement tick', () => {
  const f = fixture(); f.manager.tick(0, true);
  const first = [...f.manager.fish.values()][0]; f.near(first); f.player.invulnerable = true;
  f.manager.tick(5, true); assert.equal(f.player.attempts, 1); assert.equal(f.player.hits.length, 0);
  f.manager.tick(10, true); assert.equal(f.player.attempts, 1);
});

test('only the actual submarine protects passengers; ordinary mounts do not grant immunity', () => {
  const f = fixture(); f.manager.tick(0, true);
  const first = [...f.manager.fish.values()][0]; f.near(first);
  f.player.mount = {typeId: 'lumen_birds:submarine'};
  f.manager.tick(5, true); assert.equal(f.player.hits.length, 0);
  assert.equal(f.manager.fish.size, MAX_MUTANTS, 'Submarine explorers can still see predators');
  f.player.mount = {typeId: 'minecraft:boat'}; f.near(first);
  f.manager.tick(10, true); assert.equal(f.player.hits.length, 1);
});

test('dead mutants cannot move or attack and disappear without resurrection', () => {
  const f = fixture(); f.manager.tick(0, true);
  const first = [...f.manager.fish.values()][0]; f.near(first); first.entity.health = 0;
  f.manager.tick(5, true);
  assert.equal(f.player.hits.length, 0); assert.equal(f.entities.has(first.entity.id), false);
});

test('spawn and complete swept bodies reject air, lava, waterlogged solids and missing chunks', () => {
  for (const medium of ['minecraft:air', 'minecraft:lava', 'minecraft:oak_stairs']) {
    const f = fixture(); f.dim.medium = medium; f.manager.tick(0, true); assert.equal(f.entities.size, 0);
  }
  const f = fixture();
  const a = {x: .6, y: 0, z: 0}, b = {x: 1.2, y: 0, z: 0};
  assert.equal(mutantWaterPath(f.dim, a, b), true);
  f.dim.blocks.set('2,0,0', 'minecraft:stone'); assert.equal(mutantWaterPath(f.dim, a, b), false);
  f.dim.blocks.clear(); f.dim.loaded = false; f.manager.tick(0, true); assert.equal(f.entities.size, 0);
});

test('changing water clears existing predators using fresh per-tick checks', () => {
  const f = fixture(); f.manager.tick(0, true); f.dim.medium = 'minecraft:lava';
  f.manager.tick(5, true); assert.equal(f.entities.size, 0); assert.equal(f.player.hits.length, 0);
});

test('peaceful, disabled adventure, dimensions and disconnects retire only mutants', () => {
  for (const reason of ['Peaceful', 'disabled', 'dimension', 'disconnect']) {
    const f = fixture(); f.manager.tick(0, true);
    if (reason === 'Peaceful') f.world.difficulty = reason;
    if (reason === 'dimension') f.player.dimension = {id: 'minecraft:nether'};
    if (reason === 'disconnect') f.world.players = [];
    f.manager.tick(5, reason !== 'disabled');
    assert.equal(f.entities.size, 0, reason); assert.equal(f.player.hits.length, 0, reason);
  }
});

test('reload sweeps loaded orphans and the script lifetime remains finite', () => {
  const f = fixture(); f.manager.tick(0, true);
  const previous = [...f.entities.keys()];
  const reloaded = new MutantFishManager(f.world); reloaded.tick(0, true);
  assert.ok(previous.every(id => !f.entities.has(id))); assert.equal(f.entities.size, MAX_MUTANTS);
  reloaded.tick(MUTANT_LIFETIME, true); assert.equal(f.entities.size, 0);
});

test('spawn and movement failures do not accumulate fish outside management', () => {
  const f = fixture(); f.dim.spawnFails = true; f.manager.tick(0, true); assert.equal(f.entities.size, 0);
  f.dim.spawnFails = false; f.dim.moveFails = true; f.manager.tick(100, true);
  assert.equal(f.entities.size, 0); assert.equal(f.manager.fish.size, 0);
});
