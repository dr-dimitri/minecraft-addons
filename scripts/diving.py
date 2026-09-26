"""Original diving equipment and a rideable yellow submarine, stdlib only."""
import struct
import zlib

ITEMS = {
    'diving_helmet': ('head', 'Taucherhelm', 'Diving helmet'),
    'diving_chestplate': ('chest', 'Tauchanzug mit Luftflaschen', 'Diving suit with air tanks'),
    'diving_leggings': ('legs', 'Taucherhose', 'Diving leggings'),
    'diving_boots': ('feet', 'Schwimmflossen', 'Diving fins'),
}
PALETTE = ('eebd36', 'ffe07b', '283f50', '75d9dd', 'f4f3dc', 'a0772c', '172934', 'df7557')


def cube(origin, size, color):
    return {'origin': origin, 'size': size, 'uv': {
        face: {'uv': [color * 8 + 1, 1], 'uv_size': [6, 6]}
        for face in ('north', 'south', 'east', 'west', 'up', 'down')}}


def geometry(name, bones, width=5, height=4):
    return {'format_version': '1.16.0', 'minecraft:geometry': [{
        'description': {'identifier': 'geometry.lumen_birds.' + name,
                        'texture_width': 64, 'texture_height': 8,
                        'visible_bounds_width': width, 'visible_bounds_height': height,
                        'visible_bounds_offset': [0, 1, 0]}, 'bones': bones}]}


def submarine_geometry():
    return geometry('submarine', [
        {'name': 'root', 'pivot': [0, 0, 0]},
        {'name': 'hull', 'parent': 'root', 'pivot': [0, 10, 0], 'cubes': [
            cube([-13, 2, -23], [26, 18, 46], 0),
            cube([-10, 0, -20], [20, 23, 40], 0),
            cube([-9, 5, -28], [18, 13, 5], 1),
            cube([-9, 5, 23], [18, 13, 5], 5),
            cube([-14, 7, -16], [1, 8, 11], 2), cube([13, 7, -16], [1, 8, 11], 2),
            cube([-14.2, 8, -15], [.3, 6, 9], 3), cube([13.9, 8, -15], [.3, 6, 9], 3),
            cube([-7, 19, -11], [14, 9, 19], 2),
            cube([-6, 21, -11.3], [12, 6, .5], 3),
            cube([-7.3, 21, -8], [.5, 6, 12], 3), cube([6.8, 21, -8], [.5, 6, 12], 3),
            cube([-8, 28, -12], [16, 2, 21], 1),
            cube([4, 30, 4], [3, 5, 3], 2), cube([4, 33, 0], [3, 2, 4], 2),
            cube([-18, 3, 8], [5, 2, 15], 5), cube([13, 3, 8], [5, 2, 15], 5),
            cube([-10, 7, -29], [4, 4, 2], 4), cube([6, 7, -29], [4, 4, 2], 4),
            cube([-2, 8, 28], [4, 4, 4], 2),
        ]},
        {'name': 'propeller', 'parent': 'root', 'pivot': [0, 10, 33], 'cubes': [
            cube([-8, 9, 32], [16, 2, 2], 2), cube([-1, 2, 32], [2, 16, 2], 2),
            cube([-2, 8, 32], [4, 4, 3], 5),
        ]},
    ])


def suit_geometry(name):
    # Direct model binding follows the player's pose without copying its skin.
    def bone(label, pivot, cubes):
        return {'name': 'diving_' + label, 'binding': "'" + label + "'", 'pivot': pivot, 'cubes': cubes}
    if name == 'diving_helmet':
        bones = [bone('head', [0, 24, 0], [
            cube([-4.7, 23.5, -4.7], [9.4, 9.4, 9.4], 0),
            cube([-3.7, 25, -5.1], [7.4, 5.5, .5], 2),
            cube([-3, 25.7, -5.2], [6, 4.1, .2], 3),
            cube([-2, 23, -5.2], [4, 2.1, 1], 5),
        ])]
    elif name == 'diving_chestplate':
        bones = [bone('body', [0, 24, 0], [
            cube([-4.5, 11.5, -2.5], [9, 13, 5], 2),
            cube([-4.6, 19, -2.7], [9.2, 2, .4], 0),
            cube([-4.4, 12, 2.5], [3.5, 11, 4], 0), cube([.9, 12, 2.5], [3.5, 11, 4], 0),
            cube([-3.8, 22, 3], [2.3, 2, 2.5], 5), cube([1.5, 22, 3], [2.3, 2, 2.5], 5),
        ])]
        for side, x in (('rightArm', -8.4), ('leftArm', 3.6)):
            bones.append(bone(side, [-5 if side == 'rightArm' else 5, 22, 0],
                              [cube([x, 11.6, -2.4], [4.8, 12.8, 4.8], 2)]))
    else:
        bones = []
        for side, x in (('rightLeg', -4.3), ('leftLeg', -.3)):
            cubes = ([cube([x, -.3, -2.3], [4.6, 12.6, 4.6], 2)] if name == 'diving_leggings' else
                     [cube([x, -.5, -7], [4.6, 2, 9.7], 0), cube([x, -.4, -2.4], [4.6, 4, 4.8], 2)])
            bones.append(bone(side, [-2 if side == 'rightLeg' else 2, 12, 0], cubes))
    return geometry(name, bones, width=3, height=4)


def assets():
    output = {}
    for name, (slot, german, english) in ITEMS.items():
        identifier = 'lumen_birds:' + name
        output['behavior_pack/items/' + name + '.json'] = {
            'format_version': '1.21.110', 'minecraft:item': {
                'description': {'identifier': identifier, 'menu_category': {'category': 'equipment'}},
                'components': {
                    'minecraft:display_name': {'value': 'item.' + identifier + '.name'},
                    'minecraft:icon': {'textures': {'default': 'lumen_' + name}},
                    'minecraft:wearable': {'slot': 'slot.armor.' + slot, 'protection': 2},
                    'minecraft:tags': {'tags': ['minecraft:is_armor']},
                }}}
        output['resource_pack/attachables/' + name + '.json'] = {
            'format_version': '1.20.30', 'minecraft:attachable': {'description': {
                'identifier': identifier,
                'materials': {'default': 'entity_alphatest'},
                'textures': {'default': 'textures/entity/lumen_birds/diving_palette'},
                'geometry': {'default': 'geometry.lumen_birds.' + name},
                'render_controllers': ['controller.render.lumen_birds.diving_suit'],
            }}}
        output['resource_pack/models/entity/' + name + '.geo.json'] = suit_geometry(name)
    output['resource_pack/textures/item_texture.json'] = {
        'resource_pack_name': 'lumen_silent_birds', 'texture_name': 'atlas.items',
        'texture_data': {'lumen_' + name: {'textures': 'textures/items/' + name} for name in ITEMS}}
    output['behavior_pack/entities/submarine.json'] = {
        'format_version': '1.21.0', 'minecraft:entity': {
            'description': {'identifier': 'lumen_birds:submarine', 'is_spawnable': True, 'is_summonable': True},
            'components': {
                'minecraft:type_family': {'family': ['lumen_submarine']},
                'minecraft:health': {'value': 40, 'max': 40},
                'minecraft:damage_sensor': {'triggers': [{'cause': 'all', 'deals_damage': 'no'}]},
                'minecraft:collision_box': {'width': 2.2, 'height': 1.8},
                'minecraft:physics': {'has_gravity': False, 'has_collision': True},
                'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
                'minecraft:persistent': {},
                'minecraft:breathable': {'total_supply': 15, 'suffocate_time': 0, 'breathes_water': True,
                                        'breathes_air': True, 'generates_bubbles': False},
                'minecraft:rideable': {'seat_count': 1, 'family_types': ['player'], 'pull_in_entities': False,
                                       'rider_can_interact': False, 'interact_text': 'action.interact.ride.minecart',
                                       'seats': [{'position': [0, .4, .1]}]},
            }}}
    output['resource_pack/entity/submarine.entity.json'] = {
        'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
            'identifier': 'lumen_birds:submarine', 'materials': {'default': 'entity_alphatest'},
            'textures': {'default': 'textures/entity/lumen_birds/diving_palette'},
            'geometry': {'default': 'geometry.lumen_birds.submarine'},
            'animations': {'propeller': 'animation.lumen_birds.submarine.propeller'},
            'scripts': {'animate': ['propeller']},
            'render_controllers': ['controller.render.lumen_birds.submarine'],
            'spawn_egg': {'base_color': '#eebd36', 'overlay_color': '#283f50'},
        }}}
    output['resource_pack/models/entity/submarine.geo.json'] = submarine_geometry()
    output['resource_pack/animations/submarine.animation.json'] = {
        'format_version': '1.8.0', 'animations': {'animation.lumen_birds.submarine.propeller': {
            'loop': True, 'bones': {'propeller': {'rotation': [0, 0, 'query.life_time * 180.0']}}}}}
    controller = {'geometry': 'Geometry.default', 'materials': [{'*': 'Material.default'}],
                  'textures': ['Texture.default']}
    output['resource_pack/render_controllers/diving.render_controllers.json'] = {
        'format_version': '1.8.0', 'render_controllers': {
            'controller.render.lumen_birds.submarine': controller,
            'controller.render.lumen_birds.diving_suit': {
                **controller, 'part_visibility': [{'*': '!context.is_first_person'}]},
        }}
    return output


def png(width, height, pixel):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))
    rows = b''.join(b'\x00' + b''.join(bytes(pixel(x, y)) for x in range(width)) for y in range(height))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b''))


def binary_assets():
    colors = [tuple(bytes.fromhex(color)) + (255,) for color in PALETTE]
    output = {'resource_pack/textures/entity/lumen_birds/diving_palette.png':
              png(64, 8, lambda x, y: colors[x // 8])}
    for name in ITEMS:
        def pixel(x, y):
            if name == 'diving_helmet':
                if 3 <= x <= 12 and 3 <= y <= 12:
                    return colors[3 if 5 <= x <= 10 and 5 <= y <= 9 else 0]
            elif name == 'diving_chestplate':
                if 4 <= x <= 11 and 3 <= y <= 13 or 1 <= x <= 14 and 3 <= y <= 6:
                    return colors[0 if x in (5, 6, 9, 10) else 2]
            elif name == 'diving_leggings':
                if 3 <= x <= 12 and 2 <= y <= 5 or (3 <= x <= 6 or 9 <= x <= 12) and 5 <= y <= 13:
                    return colors[0 if y == 3 else 2]
            else:
                if (2 <= x <= 6 or 9 <= x <= 13) and 4 <= y <= 13:
                    return colors[2 if y < 8 else 0]
            return (0, 0, 0, 0)
        output['resource_pack/textures/items/' + name + '.png'] = png(16, 16, pixel)
    return output


def translations(language):
    index = 1 if language == 'de_DE' else 2
    result = {'item.lumen_birds:' + name + '.name': values[index] for name, values in ITEMS.items()}
    result['entity.lumen_birds:submarine.name'] = 'Gelbes U-Boot' if language == 'de_DE' else 'Yellow submarine'
    return result
