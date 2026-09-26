"""Giant model clearance, gameplay wiring and standalone source distribution."""
import itertools
import math
from pathlib import Path
import re
import struct
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from generate import ROOT, PALETTES, monster_geometry, monster_animation
from validate import load, validate
from build import source_files


def rotated(point, pivot, rotation):
    """Rotate a model point around the cube/bone pivot, in XYZ order."""
    result = [point[i] - pivot[i] for i in range(3)]
    for axis, degrees in enumerate(rotation):
        a, b = (axis + 1) % 3, (axis + 2) % 3
        cosine, sine = math.cos(math.radians(degrees)), math.sin(math.radians(degrees))
        result[a], result[b] = (result[a] * cosine - result[b] * sine,
                                result[a] * sine + result[b] * cosine)
    return [result[i] + pivot[i] for i in range(3)]


def cube_corners(cube):
    for corner in itertools.product((0, 1), repeat=3):
        point = [cube['origin'][i] + cube['size'][i] * corner[i] for i in range(3)]
        yield rotated(point, cube.get('pivot', [0, 0, 0]), cube.get('rotation', [0, 0, 0]))


def swept_bounds(corners, axis=None, pivot=None, angles=(0, 0)):
    """Exact coordinate extrema of each corner over a continuous angle interval.

    Their union conservatively bounds the entire animated cuboid. It also
    catches small details between sampled animation frames.
    """
    candidates = []
    for point in corners:
        if axis is None:
            candidates.append(point)
            continue
        low, high = map(math.radians, angles)
        a, b = (axis + 1) % 3, (axis + 2) % 3
        u, v = point[a] - pivot[a], point[b] - pivot[b]
        extrema = [low, high]
        for cosine, sine in ((u, -v), (v, u)):
            # derivative of cosine*cos(t) + sine*sin(t) is zero here.
            first = math.atan2(sine, cosine)
            start = math.ceil((low - first) / math.pi)
            end = math.floor((high - first) / math.pi)
            extrema.extend(first + k * math.pi for k in range(start, end + 1))
        for angle in extrema:
            rotation = [0, 0, 0]
            rotation[axis] = math.degrees(angle)
            candidates.append(rotated(point, pivot, rotation))
    return [(min(p[i] for p in candidates), max(p[i] for p in candidates)) for i in range(3)]


class MonsterTests(unittest.TestCase):
    def animated_ancestor(self, bone, bones):
        # Geometry below these bones (including the separate lower teeth) must
        # inherit their movement. Reject unsupported hierarchies explicitly.
        moving = []
        while True:
            self.assertEqual(bone.get('rotation', [0, 0, 0]), [0, 0, 0])
            if bone['name'] in ('tail', 'fin_left', 'fin_right', 'jaw'):
                moving.append(bone)
            if 'parent' not in bone:
                break
            bone = bones[bone['parent']]
        self.assertLessEqual(len(moving), 1, 'Add composed transforms for a nested moving bone')
        return moving[0] if moving else None

    def animation_ranges(self):
        # Keep the analytic ranges tied to the actual Molang animation. A
        # changed expression must also update the clearance proof.
        animation = monster_animation()['bones']
        sway = 'math.sin(query.life_time * 90.0)'
        self.assertEqual(animation, {
            'root': {'scale': "math.clamp(query.life_time / 1.2, 0.01, 1.0) * query.property('lumen_birds:feast_scale')"},
            'tail': {'rotation': [0, f'{sway} * 12.0', 0]},
            'fin_left': {'rotation': [0, 0, f'{sway} * 12.0']},
            'fin_right': {'rotation': [0, 0, f'-({sway}) * 12.0']},
            'jaw': {'rotation': ["-5.0 - math.sin(query.life_time * 45.0) * 5.0 - query.property('lumen_birds:jaw_open') * 30.0", 0, 0]},
        })
        entity = load(ROOT / 'behavior_pack/entities/deepmaw.json')['minecraft:entity']
        properties = entity['description']['properties']
        # The ordinary swimming/inside-model tests use the actual default pose.
        self.assertEqual(properties['lumen_birds:feast_scale']['default'], 1)
        self.assertEqual(properties['lumen_birds:jaw_open']['default'], 0)
        return {'tail': (1, (-12, 12)), 'fin_left': (2, (-12, 12)),
                'fin_right': (2, (-12, 12)), 'jaw': (0, (-10, 0))}

    def test_all_animated_corners_fit_water_envelope_at_every_heading(self):
        source = (ROOT / 'src/sea_monster.js').read_text()
        horizontal = float(re.search(r'MONSTER_HALF_WIDTH = ([\d.]+)', source)[1])
        vertical = float(re.search(r'MONSTER_HALF_HEIGHT = ([\d.]+)', source)[1])
        bones = {b['name']: b for b in monster_geometry()['minecraft:geometry'][0]['bones']}
        # Analytic bounds for any angle (stronger than sampling animation frames).
        # Root scales only 0..1. Include inherited motion for child geometry.
        self.animation_ranges()
        for bone in bones.values():
            animated = self.animated_ancestor(bone, bones)
            pivot = animated['pivot'] if animated else bone['pivot']
            moving_name = animated['name'] if animated else None
            for cube in bone.get('cubes', []):
                for x, y, z in cube_corners(cube):
                    radius, height = math.hypot(x, z), abs(y)
                    if moving_name == 'tail':
                        radius = math.hypot(pivot[0], pivot[2]) + math.hypot(x-pivot[0], z-pivot[2])
                    elif moving_name in ('fin_left', 'fin_right'):
                        r = math.hypot(x-pivot[0], y-pivot[1])
                        radius = math.hypot(abs(pivot[0])+r, z)
                        height = abs(pivot[1])+r
                    elif moving_name == 'jaw':
                        r = math.hypot(y-pivot[1], z-pivot[2])
                        radius = math.hypot(x, abs(pivot[2])+r)
                        height = abs(pivot[1])+r
                    self.assertLess(radius / 16, horizontal, bone['name'])
                    self.assertLess(height / 16, vertical, bone['name'])

    def test_hat_hollow_belly_and_giant_size_are_present(self):
        bones = {b['name']: b for b in monster_geometry()['minecraft:geometry'][0]['bones']}
        self.assertEqual(bones['party_hat']['parent'], 'head')
        self.assertGreaterEqual(len(bones['party_hat']['cubes']), 6)
        all_cubes = [c for b in bones.values() for c in b.get('cubes', [])]
        z0 = min(c['origin'][2] for c in all_cubes)
        z1 = max(c['origin'][2]+c['size'][2] for c in all_cubes)
        self.assertAlmostEqual((z1-z0)/16, 16)

    def test_surface_feast_properties_timer_and_visible_bounds_cover_the_larger_pose(self):
        entity = load(ROOT / 'behavior_pack/entities/deepmaw.json')['minecraft:entity']
        properties = entity['description']['properties']
        self.assertEqual(properties['lumen_birds:feast_scale'], {
            'type': 'float', 'range': [1, 3.5], 'default': 1, 'client_sync': True})
        self.assertEqual(properties['lumen_birds:jaw_open'], {
            'type': 'float', 'range': [0, 1], 'default': 0, 'client_sync': True})
        group = entity['events']['lumen_birds:begin_feast']['add']['component_groups'][0]
        timer = entity['component_groups'][group]['minecraft:timer']
        self.assertEqual(timer['time'], 180)
        self.assertEqual(timer['time_down_event']['event'], 'lumen_birds:expire')
        model = monster_geometry()['minecraft:geometry'][0]
        self.assertGreaterEqual(model['description']['visible_bounds_width'], 23 * 3.5)
        self.assertGreaterEqual(model['description']['visible_bounds_height'], 16 * 3.5)

    def test_whole_player_corridor_stays_clear_through_jaw_animation(self):
        # Scope numeric extraction to ordinary passenger confinement. The
        # separate surface mouth uses a different, scaled entry envelope.
        source = (ROOT / 'src/monster_encounter.js').read_text().split('  tick(tick) {', 1)[1]
        number = r'(-?(?:\d+(?:\.\d+)?|\.\d+))'
        def limit(expression):
            match = re.search(expression + number, source)
            self.assertIsNotNone(match, expression)
            return float(match[1])
        side = limit(r'Math\.abs\(at\.side\) > ')
        back = limit(r'at\.forward < ')
        front = limit(r'const escape = at\.forward >= ')
        feet_low = limit(r'at\.y < ')
        feet_high = limit(r'at\.y > ')
        # Include the whole 0.6 x 1.8-block player, even when upright in water,
        # throughout every allowed foot position and past the escape trigger.
        half_width, player_height = .3, 1.8
        corridor = [(-side-half_width, side+half_width),
                    (feet_low, feet_high+player_height),
                    (-front-half_width, -back+half_width)]
        corridor = [(low*16, high*16) for low, high in corridor]
        bones = {b['name']: b for b in monster_geometry()['minecraft:geometry'][0]['bones']}
        ranges = self.animation_ranges()
        # Swallowing starts at age >=40 ticks, after root scale reaches 1 at 1.2s.
        self.assertIn('if (age < 40 || age > 480) continue;', source)
        for bone in bones.values():
            animated = self.animated_ancestor(bone, bones)
            for index, cube in enumerate(bone.get('cubes', [])):
                if animated:
                    axis, angles = ranges[animated['name']]
                    bounds = swept_bounds(cube_corners(cube), axis, animated['pivot'], angles)
                else:
                    bounds = swept_bounds(cube_corners(cube))
                separated = any(high <= corridor[i][0] or low >= corridor[i][1]
                                for i, (low, high) in enumerate(bounds))
                self.assertTrue(separated, f"{bone['name']} cube {index} crosses player corridor: {bounds}")

    def test_every_tooth_face_uses_opaque_white_texture_pixels(self):
        bones = {b['name']: b for b in monster_geometry()['minecraft:geometry'][0]['bones']}
        texture = (ROOT / 'resource_pack/textures/entity/lumen_birds/deepmaw.tga').read_bytes()
        width, height, depth = struct.unpack_from('<HHB', texture, 12)
        self.assertEqual((width, height, depth), (64, 16, 32))
        self.assertEqual(texture[:3], b'\x00\x00\x02')  # No ID/color map, uncompressed true color.
        self.assertEqual(texture[17], 0x28)  # Top-left origin with eight alpha bits.
        for name, parent in (('teeth_upper', 'head'), ('teeth_lower', 'jaw')):
            self.assertIn(name, bones.keys())
            self.assertEqual(bones[name]['parent'], parent)
            self.assertGreater(len(bones[name]['cubes']), 0)
            for cube in bones[name]['cubes']:
                self.assertEqual(set(cube['uv']), {'north', 'south', 'east', 'west', 'up', 'down'})
                for face in cube['uv'].values():
                    u, v = face['uv']
                    du, dv = face['uv_size']
                    for x in range(math.floor(min(u, u+du)), math.ceil(max(u, u+du))):
                        for y in range(math.floor(min(v, v+dv)), math.ceil(max(v, v+dv))):
                            self.assertTrue(0 <= x < width and 0 <= y < height)
                            offset = 18 + 4 * (y * width + x)
                            blue, green, red, alpha = texture[offset:offset+4]
                            self.assertEqual(alpha, 255, name)
                            self.assertGreaterEqual(min(red, green, blue), 240, name)
                            self.assertLessEqual(max(red, green, blue)-min(red, green, blue), 8, name)
                            slot = (y // 8) * 8 + x // 8
                            self.assertEqual(bytes((red, green, blue)), bytes.fromhex(PALETTES['deepmaw'][slot]))

    def test_upper_tooth_tips_are_exposed_outside_the_head(self):
        bones = {b['name']: b for b in monster_geometry()['minecraft:geometry'][0]['bones']}
        teeth = bones['teeth_upper']['cubes']
        tips = []
        for tooth in teeth:
            x = tooth['origin'][0] + tooth['size'][0]/2
            # A fang narrows downwards. Its lowest segment at this lateral
            # position must protrude from the roof/lips, not sit inside them.
            if not any(other['origin'][1] < tooth['origin'][1]
                       and other['origin'][0] < x < other['origin'][0]+other['size'][0]
                       for other in teeth):
                tips.append(tooth)
        self.assertGreaterEqual(len(tips), 6)
        for tip in tips:
            tip_bounds = swept_bounds(cube_corners(tip))
            for index, cube in enumerate(bones['head']['cubes']):
                head_bounds = swept_bounds(cube_corners(cube))
                separated = any(high <= head_bounds[i][0] or low >= head_bounds[i][1]
                                for i, (low, high) in enumerate(tip_bounds))
                self.assertTrue(separated, f"Tooth tip {tip['origin']} hidden by head cube {index}")

    def test_generated_encounter_and_original_assets_are_in_source_archive(self):
        validate()
        paths = dict(source_files())
        for path in ('src/sea_monster.js', 'src/monster_encounter.js', 'tests/monster.test.js',
                     'tests/test_monster.py', 'docs/MONSTER_VALIDATION.md',
                     'behavior_pack/entities/deepmaw.json', 'resource_pack/entity/deepmaw.entity.json',
                     'resource_pack/models/entity/deepmaw.geo.json',
                     'resource_pack/textures/entity/lumen_birds/deepmaw.tga'):
            self.assertIn('lumen-silent-birds/' + path, paths)
        main = (ROOT / 'behavior_pack/scripts/main.js').read_text()
        self.assertIn('new MonsterEncounter(', main)
        self.assertIn('seaMonster.tick(system.currentTick)', main)
        entity = load(ROOT / 'behavior_pack/entities/deepmaw.json')['minecraft:entity']
        self.assertEqual(entity['components']['minecraft:type_family']['family'], ['lumen_monster'])
        self.assertNotIn('minecraft:attack', entity['components'])


if __name__ == '__main__':
    unittest.main()
