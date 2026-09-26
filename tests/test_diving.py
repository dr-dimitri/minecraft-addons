"""Diving gear references and submarine clearance, independent of Bedrock."""
import itertools
import json
import math
from pathlib import Path
import re
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from diving import assets, binary_assets, translations
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

    def test_suit_uses_player_armor_hierarchy_and_visible_first_person_sleeves(self):
        documents = assets()
        expected = {'waist': None, 'body': 'waist', 'head': 'body',
                    'rightArm': 'body', 'leftArm': 'body', 'rightLeg': 'body', 'leftLeg': 'body'}
        for part in ('helmet', 'chestplate', 'leggings', 'boots'):
            with self.subTest(part=part):
                model = documents['resource_pack/models/entity/diving_' + part + '.geo.json']['minecraft:geometry'][0]
                bones = {bone['name']: bone for bone in model['bones']}
                self.assertEqual({name: bone.get('parent') for name, bone in bones.items()}, expected)
                for bone in bones.values():
                    self.assertNotIn('binding', bone, 'Armor copies player bones; do not also bind them a second time')
                attachment = documents['resource_pack/attachables/diving_' + part + '.json']['minecraft:attachable']['description']
                self.assertEqual(attachment['materials']['default'], 'armor')
                self.assertIn('parent_setup', attachment['scripts'])
        controller = documents['resource_pack/render_controllers/diving.render_controllers.json']['render_controllers']['controller.render.lumen_birds.diving_suit']
        visibility = dict(pair for rule in controller['part_visibility'] for pair in rule.items())
        self.assertEqual(visibility['*'], True)
        for name in ('head', 'body', 'rightLeg', 'leftLeg'):
            self.assertEqual(visibility[name], '!context.is_first_person')
        self.assertNotIn('rightArm', visibility)
        self.assertNotIn('leftArm', visibility)

    def test_boots_are_named_and_extend_outside_leggings_without_long_fins(self):
        documents = assets()
        self.assertEqual(translations('de_DE')['item.lumen_birds:diving_boots.name'], 'Taucherstiefel')
        self.assertEqual(translations('en_US')['item.lumen_birds:diving_boots.name'], 'Diving boots')
        model = documents['resource_pack/models/entity/diving_boots.geo.json']['minecraft:geometry'][0]
        for side in ('rightLeg', 'leftLeg'):
            cubes = next(bone['cubes'] for bone in model['bones'] if bone['name'] == side)
            self.assertLessEqual(min(cube['origin'][2] for cube in cubes), -3)
            self.assertGreaterEqual(min(cube['origin'][2] for cube in cubes), -4)
            self.assertGreater(max(cube['origin'][1] + cube['size'][1] for cube in cubes), 5)
            self.assertGreater(max(cube['size'][0] for cube in cubes), 4.6)

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
