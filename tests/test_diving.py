"""Diving gear references and submarine clearance, independent of Bedrock."""
import itertools
import json
import math
from pathlib import Path
import re
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from diving import assets, binary_assets
from generate import ROOT
from build import source_files


class DivingAssetsTests(unittest.TestCase):
    def test_all_wearable_items_have_matching_icons_attachables_and_models(self):
        documents, images = assets(), binary_assets()
        atlas = documents['resource_pack/textures/item_texture.json']['texture_data']
        for name, slot in (('helmet', 'head'), ('chestplate', 'chest'), ('leggings', 'legs'), ('boots', 'feet')):
            base = 'diving_' + name
            item = documents['behavior_pack/items/' + base + '.json']['minecraft:item']
            self.assertEqual(item['description']['identifier'], 'lumen_birds:' + base)
            components = item['components']
            self.assertEqual(components['minecraft:wearable']['slot'], 'slot.armor.' + slot)
            icon = components['minecraft:icon']['textures']['default']
            self.assertIn('resource_pack/' + atlas[icon]['textures'] + '.png', images)
            attachment = documents['resource_pack/attachables/' + base + '.json']['minecraft:attachable']['description']
            self.assertEqual(attachment['identifier'], item['description']['identifier'])
            geometry = documents['resource_pack/models/entity/' + base + '.geo.json']['minecraft:geometry'][0]
            self.assertEqual(attachment['geometry']['default'], geometry['description']['identifier'])
            self.assertIn('resource_pack/' + attachment['textures']['default'] + '.png', images)
            for bone in geometry['bones']:
                self.assertIn(bone['binding'], ["'" + target + "'" for target in
                              ('head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg')])

    def test_complete_rotating_submarine_and_seated_player_fit_water_envelope(self):
        documents = assets()
        source = (ROOT / 'src/diving.js').read_text()
        radius = float(re.search(r'SUBMARINE_RADIUS = ([\d.]+)', source)[1])
        height = float(re.search(r'SUBMARINE_HEIGHT = ([\d.]+)', source)[1])
        animation = documents['resource_pack/animations/submarine.animation.json']['animations']
        self.assertEqual(animation['animation.lumen_birds.submarine.propeller']['bones'], {
            'propeller': {'rotation': [0, 0, 'query.life_time * 180.0']}})
        model = documents['resource_pack/models/entity/submarine.geo.json']['minecraft:geometry'][0]
        for bone in model['bones']:
            for cube in bone.get('cubes', []):
                for corner in itertools.product((0, 1), repeat=3):
                    x, y, z = [cube['origin'][i] + cube['size'][i] * corner[i] for i in range(3)]
                    if bone['name'] == 'propeller':
                        px, py, pz = bone['pivot']
                        sweep_radius = math.hypot(x - px, y - py)
                        radial = math.hypot(abs(px) + sweep_radius, z)
                        vertical = abs(py) + sweep_radius
                    else:
                        radial, vertical = math.hypot(x, z), abs(y)
                    self.assertLess(radial / 16, radius, bone['name'])
                    self.assertLess(vertical / 16, height, bone['name'])
        entity = documents['behavior_pack/entities/submarine.json']['minecraft:entity']
        rideable = entity['components']['minecraft:rideable']
        self.assertEqual(rideable['seat_count'], 1)
        self.assertEqual(rideable['family_types'], ['player'])
        seat = rideable['seats'][0]['position']
        self.assertLess(seat[1] + 1.8, height)
        self.assertLess(math.hypot(seat[0], seat[2]) + .3, radius)
        self.assertEqual(entity['components']['minecraft:physics'], {'has_gravity': False, 'has_collision': True})

    def test_generated_diving_assets_are_available_in_standalone_source_archive(self):
        archived = dict(source_files())
        for relative, expected in assets().items():
            with self.subTest(path=relative):
                generated = json.loads((ROOT / relative).read_text())
                if relative.endswith('item_texture.json'):
                    # Other adventure equipment can share this atlas.
                    for name, texture in expected['texture_data'].items():
                        self.assertEqual(generated['texture_data'][name], texture)
                else:
                    self.assertEqual(generated, expected)
                self.assertIn('lumen-silent-birds/' + relative, archived)
        for relative, expected in binary_assets().items():
            self.assertEqual(archived['lumen-silent-birds/' + relative], expected)
        for relative in ('scripts/diving.py', 'src/diving.js', 'tests/diving.test.js', 'tests/test_diving.py'):
            self.assertIn('lumen-silent-birds/' + relative, archived)


if __name__ == '__main__':
    unittest.main()
