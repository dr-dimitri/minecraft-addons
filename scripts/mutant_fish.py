"""Original small hostile deep-sea fish; no third-party assets or dependencies."""
import struct
from diving import cube, geometry

SPECIES = {
    'abyss_biter': {'names': ('Tiefenbeißer', 'Abyss biter'), 'health': 8,
                    'colors': ('3b535e', '78918b', '1c2b37', '865076', 'd3dcb8', '293641', 'f5f7f4', 'ff5f57')},
    'lantern_maw': {'names': ('Laternenmaul', 'Lantern maw'), 'health': 12,
                    'colors': ('3a405a', '666780', '222539', '755372', 'b4a890', '24273d', 'f5f7f4', '82ffdc')},
}


def model(species):
    biter = species == 'abyss_biter'
    bones = [{'name': 'root', 'pivot': [0, 0, 0]}]
    if biter:
        body = [cube([-4, -3, -8], [8, 6, 15], 0), cube([-3, -4, -7], [6, 2, 12], 1),
                cube([-5, -3.5, -12], [10, 7, 7], 0), cube([-4, -2, -12.3], [8, 3, .5], 5),
                cube([-1, 3, -5], [2, 4, 9], 3), cube([-7, -2, -1], [3, 1, 6], 3),
                cube([4, -2, -1], [3, 1, 6], 3)]
        for x in (-3.2, -1.2, .8, 2.8):
            body.extend([cube([x, -.1, -12.7], [.8, 2, 1], 6), cube([x, -2.7, -12.7], [.8, 1.5, 1], 6)])
        glow = [cube([-5.2, 1, -10], [.4, 1.5, 2], 7), cube([4.8, 1, -10], [.4, 1.5, 2], 7)]
    else:
        body = [cube([-6, -5, -6], [12, 10, 12], 0), cube([-5, -6, -4], [10, 2, 9], 1),
                cube([-5.5, -4, -10], [11, 8, 5], 0), cube([-4.5, -3, -10.3], [9, 5, .5], 5),
                cube([-1, 5, -1], [2, 6, 2], 3), cube([-1, 10, -6], [2, 2, 7], 3),
                cube([-1, 8, -7], [2, 3, 2], 3),
                cube([-8, -3, 0], [2, 1, 7], 3), cube([6, -3, 0], [2, 1, 7], 3)]
        for x in (-3.5, -1.5, .5, 2.5):
            body.extend([cube([x, .5, -10.8], [1, 1.8, 1], 6), cube([x, -3.3, -10.8], [1, 1.8, 1], 6)])
        glow = [cube([-2, 6.5, -8], [4, 3, 3], 7),
                cube([-6.2, 1, -7], [.4, 2, 2], 7), cube([5.8, 1, -7], [.4, 2, 2], 7)]
    bones.extend([
        {'name': 'body', 'parent': 'root', 'pivot': [0, 0, 0], 'cubes': body},
        {'name': 'glow', 'parent': 'body', 'pivot': [0, 0, 0], 'cubes': glow},
        {'name': 'tail', 'parent': 'root', 'pivot': [0, 0, 6], 'cubes': [
            cube([-2, -2, 6], [4, 4, 4], 0), cube([-1, -4, 10], [2, 8, 5], 3)]},
    ])
    result = geometry(species, bones, width=3, height=3)
    result['minecraft:geometry'][0]['description']['visible_bounds_offset'] = [0, 0, 0]
    return result


def assets():
    output, animations = {}, {}
    for species, config in SPECIES.items():
        identifier = 'lumen_birds:' + species
        output['behavior_pack/entities/' + species + '.json'] = {
            'format_version': '1.21.0', 'minecraft:entity': {
                'description': {'identifier': identifier, 'is_spawnable': False, 'is_summonable': True},
                'component_groups': {'lumen_birds:retire': {'minecraft:instant_despawn': {}}},
                'components': {
                    'minecraft:type_family': {'family': ['lumen_mutant']},
                    'minecraft:health': {'value': config['health'], 'max': config['health']},
                    'minecraft:physics': {'has_gravity': False, 'has_collision': True},
                    'minecraft:collision_box': {'width': .9, 'height': .7},
                    'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
                    'minecraft:breathable': {'total_supply': 15, 'suffocate_time': 0,
                                            'breathes_water': True, 'breathes_air': False, 'generates_bubbles': False},
                    'minecraft:timer': {'looping': False, 'time': 65,
                                        'time_down_event': {'event': 'lumen_birds:expire', 'target': 'self'}},
                }, 'events': {'lumen_birds:expire': {'add': {'component_groups': ['lumen_birds:retire']}}}}}
        output['resource_pack/entity/' + species + '.entity.json'] = {
            'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
                'identifier': identifier,
                'materials': {'default': 'entity_alphatest', 'glow': 'entity_emissive'},
                'textures': {'default': 'textures/entity/lumen_birds/' + species},
                'geometry': {'default': 'geometry.lumen_birds.' + species},
                'animations': {'swim': 'animation.lumen_birds.' + species + '.swim'},
                'scripts': {'animate': ['swim']},
                'render_controllers': ['controller.render.lumen_birds.mutant'],
            }}}
        output['resource_pack/models/entity/' + species + '.geo.json'] = model(species)
        animations['animation.lumen_birds.' + species + '.swim'] = {
            'loop': True, 'bones': {'tail': {'rotation': [0, 'math.sin(query.life_time * 220.0) * 18.0', 0]}}}
    output['resource_pack/animations/mutants.animation.json'] = {'format_version': '1.8.0', 'animations': animations}
    output['resource_pack/render_controllers/mutants.render_controllers.json'] = {
        'format_version': '1.8.0', 'render_controllers': {'controller.render.lumen_birds.mutant': {
            'geometry': 'Geometry.default', 'materials': [{'*': 'Material.default'}, {'glow': 'Material.glow'}],
            'textures': ['Texture.default'],
        }}}
    return output


def binary_assets():
    output = {}
    for species, config in SPECIES.items():
        colors = [bytes.fromhex(color) for color in config['colors']]
        header = struct.pack('<BBBHHBHHHHBB', 0, 0, 2, 0, 0, 0, 0, 0, 64, 8, 32, 0x28)
        pixels = bytearray()
        for y in range(8):
            for x in range(64):
                red, green, blue = colors[x // 8]
                # Match the project's existing Mojang-style inverse glow mask.
                pixels.extend((blue, green, red, 3 if x // 8 == 7 else 255))
        output['resource_pack/textures/entity/lumen_birds/' + species + '.tga'] = header + pixels
    return output


def translations(language):
    index = 0 if language == 'de_DE' else 1
    return {'entity.lumen_birds:' + species + '.name': config['names'][index] for species, config in SPECIES.items()}
