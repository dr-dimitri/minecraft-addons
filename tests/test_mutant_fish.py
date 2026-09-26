"""Model, combat entity and resource wiring for the two small deep-sea threats."""
import itertools
import json
import math
from pathlib import Path
import re
import struct
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from mutant_fish import SPECIES, assets, binary_assets
from generate import ROOT
from build import source_files


class MutantFishAssetsTests(unittest.TestCase):
    def test_animated_models_fit_the_entire_water_envelope_at_every_heading(self):
        documents = assets()
        source = (ROOT / 'src/mutant_fish.js').read_text()
        radius = float(re.search(r'MUTANT_HALF_WIDTH = ([\d.]+)', source)[1])
        height = float(re.search(r'MUTANT_HALF_HEIGHT = ([\d.]+)', source)[1])
        for species in SPECIES:
            animation = documents['resource_pack/animations/mutants.animation.json']['animations'][
                'animation.lumen_birds.' + species + '.swim']
            self.assertEqual(animation['bones'], {
                'tail': {'rotation': [0, 'math.sin(query.life_time * 220.0) * 18.0', 0]}})
            model = documents['resource_pack/models/entity/' + species + '.geo.json']['minecraft:geometry'][0]
            for bone in model['bones']:
                for cube in bone.get('cubes', []):
                    for corner in itertools.product((0, 1), repeat=3):
                        x, y, z = [cube['origin'][i] + cube['size'][i] * corner[i] for i in range(3)]
                        radial = math.hypot(x, z)
                        if bone['name'] == 'tail':
                            px, py, pz = bone['pivot']
                            radial = math.hypot(px, pz) + math.hypot(x-px, z-pz)
                        self.assertLess(radial / 16, radius, species + ':' + bone['name'])
                        self.assertLess(abs(y) / 16, height, species + ':' + bone['name'])

    def test_mutants_are_killable_without_loot_native_attacks_or_permanent_entities(self):
        documents = assets()
        for species, expected_health in (('abyss_biter', 8), ('lantern_maw', 12)):
            entity = documents['behavior_pack/entities/' + species + '.json']['minecraft:entity']
            components = entity['components']
            self.assertEqual(components['minecraft:health'], {'value': expected_health, 'max': expected_health})
            self.assertEqual(components['minecraft:type_family']['family'], ['lumen_mutant'])
            for forbidden in ('minecraft:damage_sensor', 'minecraft:loot', 'minecraft:experience_reward',
                              'minecraft:attack', 'minecraft:persistent'):
                self.assertNotIn(forbidden, components)
            timer = components['minecraft:timer']
            self.assertFalse(timer['looping'])
            self.assertLessEqual(timer['time'], 65)
            event = entity['events'][timer['time_down_event']['event']]
            for group in event['add']['component_groups']:
                self.assertIn('minecraft:instant_despawn', entity['component_groups'][group])

    def test_glowing_eyes_and_lure_use_only_the_inverse_emissive_mask(self):
        documents, textures = assets(), binary_assets()
        for species in SPECIES:
            path = 'resource_pack/textures/entity/lumen_birds/' + species + '.tga'
            texture = textures[path]
            self.assertEqual(struct.unpack_from('<HHB', texture, 12), (64, 8, 32))
            model = documents['resource_pack/models/entity/' + species + '.geo.json']['minecraft:geometry'][0]
            for bone in model['bones']:
                for cube in bone.get('cubes', []):
                    for face in cube['uv'].values():
                        u, v = face['uv']
                        for y in range(v, v + face['uv_size'][1]):
                            for x in range(u, u + face['uv_size'][0]):
                                self.assertEqual(texture[18 + 4 * (y * 64 + x) + 3],
                                                 3 if bone['name'] == 'glow' else 255)

    def test_generated_assets_and_controller_are_present_in_source_archive(self):
        archived = dict(source_files())
        for relative, expected in assets().items():
            with self.subTest(path=relative):
                self.assertEqual(json.loads((ROOT / relative).read_text()), expected)
                self.assertIn('lumen-silent-birds/' + relative, archived)
        for relative, expected in binary_assets().items():
            self.assertEqual(archived['lumen-silent-birds/' + relative], expected)
        for relative in ('scripts/mutant_fish.py', 'src/mutant_fish.js', 'tests/mutant_fish.test.js',
                         'tests/test_mutant_fish.py'):
            self.assertIn('lumen-silent-birds/' + relative, archived)


if __name__ == '__main__':
    unittest.main()
