"""Check the generated basin coordinates and references without running Bedrock.

The small interpreter below evaluates only the deterministic feature types used
by this biome. It proves the emitted placement volume, not engine generation or
the eventual in-game appearance.
"""
from collections import Counter
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build import source_files
from deep_sea import assets
from generate import ROOT


def feature_index(documents):
    result = {}
    for path, document in documents.items():
        if not path.startswith('behavior_pack/features/'):
            continue
        kinds = [key for key in document if key.startswith('minecraft:')]
        if len(kinds) != 1:
            raise ValueError('Every feature file must define exactly one feature')
        kind = kinds[0]
        feature = document[kind]
        identifier = feature['description']['identifier']
        if identifier in result:
            raise ValueError('Duplicate feature identifier: ' + identifier)
        if Path(path).stem != identifier.split(':', 1)[1]:
            raise ValueError('Feature identifier must match filename: ' + path)
        result[identifier] = (kind, feature)
    return result


def offsets(distribution):
    """Interpret single-axis fixed grids, with inclusive bounds and offsets."""
    iterations = distribution['iterations']
    if type(iterations) is not int or iterations < 1:
        raise ValueError('Expected a positive integer iteration count')
    if distribution.get('scatter_chance', 100) != 100:
        raise ValueError('A probabilistic scatter cannot guarantee basin depth')
    axes = []
    for axis in 'xyz':
        coordinate = distribution[axis]
        if type(coordinate) is int:
            axes.append([coordinate] * iterations)
            continue
        if not isinstance(coordinate, dict) or coordinate['distribution'] != 'fixed_grid':
            raise ValueError('Only integer coordinates and fixed grids are supported')
        low, high = coordinate['extent']
        step = coordinate.get('step_size', 1)
        offset = coordinate.get('grid_offset', 0)
        if any(type(value) is not int for value in (low, high, step, offset)) or step <= 0:
            raise ValueError('Expected integer grid bounds and a positive step')
        values = list(range(low + offset, high + 1, step))
        if len(values) != iterations:
            raise ValueError('Grid extent must cover exactly its iteration count')
        axes.append(values)
    if sum(isinstance(distribution[axis], dict) for axis in 'xyz') > 1:
        raise ValueError('Nested single-axis grids are required for this proof')
    return zip(*axes)


def placements(features, identifier, origin=(0, 0, 0), ancestry=()):
    """Yield every (position, block identifier) requested by the feature tree."""
    if identifier in ancestry:
        raise ValueError('Recursive feature reference: ' + identifier)
    kind, feature = features[identifier]
    ancestry = ancestry + (identifier,)
    if kind == 'minecraft:single_block_feature':
        block = feature['places_block']
        yield origin, block if isinstance(block, str) else block['name']
    elif kind == 'minecraft:aggregate_feature':
        if feature.get('early_out', 'none') != 'none':
            raise ValueError('All basin branches must run')
        for child in feature['features']:
            yield from placements(features, child, origin, ancestry)
    elif kind == 'minecraft:scatter_feature':
        if feature.get('project_input_to_floor', False):
            raise ValueError('Basin depth must be independent of the old floor')
        for offset in offsets(feature.get('distribution', feature)):
            position = tuple(base + delta for base, delta in zip(origin, offset))
            yield from placements(features, feature['places_feature'], position, ancestry)
    else:
        raise ValueError('Uninterpreted feature type: ' + kind)


def matches_tags(condition, tags):
    """Evaluate the simple biome tag filter independently of its JSON layout."""
    if 'all_of' in condition:
        return all(matches_tags(child, tags) for child in condition['all_of'])
    if 'any_of' in condition:
        return any(matches_tags(child, tags) for child in condition['any_of'])
    if 'none_of' in condition:
        return not any(matches_tags(child, tags) for child in condition['none_of'])
    if condition['test'] != 'has_biome_tag':
        raise ValueError('Uninterpreted biome filter: ' + condition['test'])
    result = condition['value'] in tags
    operator = condition.get('operator', '==')
    if operator in ('==', 'equals'):
        return result
    if operator in ('!=', 'not'):
        return not result
    raise ValueError('Uninterpreted biome tag operator: ' + operator)


class DeepSeaTests(unittest.TestCase):
    def setUp(self):
        self.documents = {str(path): data for path, data in assets().items()}
        self.features = feature_index(self.documents)
        self.rule = self.documents['behavior_pack/feature_rules/deep_sea_basin.json']['minecraft:feature_rules']

    def test_each_column_has_exactly_100_water_blocks_and_a_floor(self):
        for chunk_x, chunk_z in ((0, 0), (-32, -48), (48, -16)):
            with self.subTest(chunk=(chunk_x, chunk_z)):
                placed = []
                for offset in offsets(self.rule['distribution']):
                    origin = (chunk_x + offset[0], offset[1], chunk_z + offset[2])
                    placed.extend(placements(self.features, self.rule['description']['places_feature'], origin))
                counts = Counter(position for position, block in placed)
                self.assertEqual(len(placed), 16 * 16 * 101)
                self.assertEqual(set(counts.values()), {1}, 'Overlapping or duplicate placements')
                water = {position for position, block in placed if block == 'minecraft:water'}
                expected = {(x, y, z) for x in range(chunk_x, chunk_x + 16)
                            for z in range(chunk_z, chunk_z + 16) for y in range(-37, 63)}
                self.assertEqual(water, expected)
                floor = {position for position, block in placed if block != 'minecraft:water'}
                self.assertEqual(floor, {(x, -38, z) for x in range(chunk_x, chunk_x + 16)
                                         for z in range(chunk_z, chunk_z + 16)})
                self.assertTrue(all(block not in ('minecraft:air', 'minecraft:lava', 'minecraft:bedrock')
                                    for position, block in placed))
                # The exact volume also excludes every adjacent chunk and the
                # bottom bedrock layers; negative coordinates must not wrap.
                self.assertGreater(min(y for x, y, z in counts), -59)

    def test_basin_runs_once_after_surface_generation_only_in_its_own_biome(self):
        self.assertEqual(self.rule['conditions']['placement_pass'], 'after_surface_pass')
        self.assertEqual(list(offsets(self.rule['distribution'])), [(0, 0, 0)])
        condition = self.rule['conditions']['minecraft:biome_filter']
        self.assertTrue(matches_tags(condition, {'lumen_deep_sea', 'ocean', 'deep', 'overworld'}))
        for tags in (set(), {'ocean', 'deep', 'overworld'}, {'ocean', 'overworld'}, {'nether'}):
            with self.subTest(tags=tags):
                self.assertFalse(matches_tags(condition, tags))

    def test_replacement_is_limited_to_nonfrozen_deep_overworld_oceans(self):
        document = self.documents['behavior_pack/biomes/deep_sea.biome.json']
        self.assertEqual(document['format_version'], '1.21.110')
        biome = document['minecraft:biome']
        self.assertEqual(biome['description']['identifier'], 'lumen_birds:deep_sea')
        components = biome['components']
        self.assertTrue({'lumen_deep_sea', 'ocean', 'deep', 'overworld'} <= set(components['minecraft:tags']['tags']))
        replacements = components['minecraft:replace_biomes']['replacements']
        self.assertEqual(len(replacements), 1)
        self.assertEqual(replacements[0]['dimension'], 'minecraft:overworld')
        self.assertEqual(set(replacements[0]['targets']), {'deep_ocean', 'deep_cold_ocean', 'deep_lukewarm_ocean'})
        self.assertEqual(replacements[0]['amount'], .18)
        self.assertGreater(replacements[0]['noise_frequency_scale'], 0)

    def test_all_feature_references_resolve_and_are_reachable(self):
        visited = set()
        def visit(identifier, ancestry=()):
            self.assertNotIn(identifier, ancestry, 'Feature references form a cycle')
            self.assertIn(identifier, self.features)
            visited.add(identifier)
            kind, feature = self.features[identifier]
            if kind == 'minecraft:aggregate_feature':
                children = feature['features']
            elif kind == 'minecraft:scatter_feature':
                children = [feature['places_feature']]
            else:
                self.assertEqual(kind, 'minecraft:single_block_feature')
                children = []
            for child in children:
                visit(child, ancestry + (identifier,))
        visit(self.rule['description']['places_feature'])
        self.assertEqual(visited, set(self.features), 'Unreachable generated feature')

    def test_client_biome_uses_its_own_fog(self):
        client = self.documents['resource_pack/biomes/deep_sea.client_biome.json']['minecraft:client_biome']
        self.assertEqual(client['description']['identifier'], 'lumen_birds:deep_sea')
        fog = self.documents['resource_pack/fogs/deep_sea.json']['minecraft:fog_settings']
        self.assertEqual(client['components']['minecraft:fog_appearance']['fog_identifier'],
                         fog['description']['identifier'])
        water = fog['distance']['water']
        self.assertGreater(water['fog_end'], water['fog_start'])
        self.assertGreaterEqual(water['fog_start'], 0)

    def test_manifests_require_the_stable_biome_version_and_keep_server_api(self):
        for pack in ('behavior_pack', 'resource_pack'):
            manifest = json.loads((ROOT / pack / 'manifest.json').read_text())
            self.assertGreaterEqual(manifest['header']['min_engine_version'], [1, 21, 110])
        behavior = json.loads((ROOT / 'behavior_pack/manifest.json').read_text())
        server = [dependency for dependency in behavior['dependencies']
                  if dependency.get('module_name') == '@minecraft/server']
        self.assertEqual(server, [{'module_name': '@minecraft/server', 'version': '2.0.0'}])

    def test_generated_assets_match_sources_and_are_in_standalone_archive(self):
        archived = dict(source_files())
        for relative, expected in self.documents.items():
            with self.subTest(path=relative):
                source = ROOT / relative
                self.assertEqual(json.loads(source.read_text()), expected)
                self.assertEqual(archived['lumen-silent-birds/' + relative], source.read_bytes())
        for relative in ('scripts/deep_sea.py', 'tests/test_deep_sea.py'):
            self.assertIn('lumen-silent-birds/' + relative, archived)


if __name__ == '__main__':
    unittest.main()
