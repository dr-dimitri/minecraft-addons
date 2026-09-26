"""Generate original cuboid animal models and both Bedrock packs, using only stdlib."""
from pathlib import Path
import json
import shutil
import struct
import zlib
from deep_sea import assets as deep_sea_assets
from diving import assets as diving_assets, binary_assets as diving_textures, translations as diving_translations
from mutant_fish import assets as mutant_assets, binary_assets as mutant_textures, translations as mutant_translations

ROOT = Path(__file__).resolve().parents[1]
VERSION = [0, 2, 0]
ENGINE = [1, 21, 110]  # Stable custom biome replacement; Script API stays 2.0.0.
RP_UUID = "5ab6115a-55e8-4ba6-8c9a-d2f707667af4"
BP_UUID = "142232de-2028-4b6e-8048-c41d5ecda537"
NOCTURNAL_SPECIES = ("owl", "eagle_owl")
BIRD_SPECIES = ("raven", "blue_tit", "robin", "goldfinch", "eagle", *NOCTURNAL_SPECIES)
FISH_SPECIES = ("trout", "carp", "pike")
MONSTER_SPECIES = ("deepmaw",)
AQUATIC_SPECIES = (*FISH_SPECIES, *MONSTER_SPECIES)
EMISSIVE_SPECIES = (*NOCTURNAL_SPECIES, "pike", *MONSTER_SPECIES)
SPECIES = (*BIRD_SPECIES, *AQUATIC_SPECIES)
NAMES = {
    "deepmaw": ("Tiefenmaul", "Deepmaw"),
    "raven": ("Rabe", "Raven"), "blue_tit": ("Blaumeise", "Blue tit"),
    "robin": ("Rotkehlchen", "Robin"), "goldfinch": ("Stieglitz", "Goldfinch"),
    "eagle": ("Steinadler", "Golden eagle"),
    "owl": ("Eule", "Owl"), "eagle_owl": ("Uhu", "Eagle owl"),
    "trout": ("Forelle", "Trout"), "carp": ("Karpfen", "Carp"), "pike": ("Hecht", "Pike"),
}
# Body, breast, crown, wing, flight feathers, tail, beak, eye.
PALETTES = {
    # Two palette rows: white enamel (6), gold hat (8), skin and mouth detail.
    "deepmaw": ["254b59", "52747b", "18343f", "dc6494", "081820", "397383", "f4f6f6", "63ffe6",
                "f0d078", "365c68", "72948e", "85445c", "4b8a92", "193843", "b7c8b5", "63ffe6"],
    "raven": ["202b37", "17212c", "2e3c4b", "26364a", "111a26", "182535", "2b3036", "090c12"],
    "blue_tit": ["72895c", "e3cf58", "4484bf", "386c9d", "e4e1cc", "466f92", "414b52", "141b25"],
    "robin": ["827665", "c86935", "81705d", "685c4c", "a39883", "655743", "423e38", "141518"],
    "goldfinch": ["aa906d", "d8c8a0", "c24832", "3b3934", "ebc943", "3e3b32", "d4bd85", "161716"],
    "eagle": ["644c38", "78563b", "ad864f", "574438", "352e29", "695241", "b99b52", "171b1b"],
    "owl": ["75675c", "d0c3a8", "8f8071", "605950", "423e39", "63574a", "514330", "ff2525"],
    "eagle_owl": ["745037", "c9a477", "926a45", "62432f", "392e26", "735336", "4a3829", "ff2525"],
    # Fish: flank, belly, back, fins, markings, tail, mouth/barbels/teeth, eyes.
    "trout": ["a0b1aa", "d4d9c4", "536c61", "748f85", "39463f", "657e73", "b4beb0", "151d1b"],
    "carp": ["a47b43", "d8bb77", "816237", "79542d", "5c4328", "947042", "c4a469", "191b15"],
    "pike": ["24382f", "485349", "17271f", "26392f", "111b18", "2d4436", "b9b894", "ffd34b"],
}


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def png(width, height, pixel):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    rows = b"".join(b"\x00" + b"".join(bytes(pixel(x, y)) for x in range(width)) for y in range(height))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))


def tga(width, height, pixel):
    """Uncompressed BGRA32; top-left origin, eight alpha bits, no color map."""
    header = struct.pack("<BBBHHBHHHHBB", 0, 0, 2, 0, 0, 0, 0, 0, width, height, 32, 0x28)
    pixels = bytearray()
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixel(x, y)
            pixels.extend((b, g, r, a))
    return header + pixels


def cube(origin, size, color, rotation=None, pivot=None):
    result = {"origin": origin, "size": size, "uv": {
        face: {"uv": [(color % 8) * 8 + 1, (color // 8) * 8 + 1], "uv_size": [6, 6]}
        for face in ("north", "south", "east", "west", "up", "down")
    }}
    if rotation is not None:
        result.update(rotation=rotation, pivot=pivot)
    return result


def geometry(species):
    if species in MONSTER_SPECIES:
        return monster_geometry()
    if species in FISH_SPECIES:
        return fish_geometry(species)
    if species in NOCTURNAL_SPECIES:
        return owl_geometry(species)
    eagle, raven = species == "eagle", species == "raven"
    w, h, length = (5.5, 4.5, 11) if eagle else (3.8, 3.6, 8) if raven else (2.8, 2.8, 4.8)
    wing = 16 if eagle else 10 if raven else 5.8
    tail = 6 if eagle else 5 if raven else 3.4
    head = 3.6 if eagle else 3.1 if raven else 2.4
    shoulder_y, shoulder_z = h * .8, -length * .22
    bones = [{"name": "root", "pivot": [0, 0, 0]}]
    bones.append({"name": "body", "parent": "root", "pivot": [0, h / 2, 0], "cubes": [
        cube([-w / 2, 0, -length / 2], [w, h, length], 0),
        cube([-w * .43, -.15, -length / 2 - .1], [w * .86, h * .52, length * .63], 1),
        cube([-w * .34, h * .76, -length * .33], [w * .68, h * .32, length * .75], 0),
    ]})
    head_z = -length / 2 - head * .4
    head_y = h * .62
    beak_len = 2.5 if eagle else 2.8 if raven else 1.2
    head_cubes = [
        cube([-head / 2, head_y, head_z - head / 2], [head, head * .83, head], 2),
        cube([-head * .24, head_y + head * .15, head_z - head / 2 - beak_len],
             [head * .48, head * .26, beak_len], 6),
    ]
    # A hooked bill distinguishes the eagle; ravens have a strong straight bill.
    if eagle:
        head_cubes.append(cube([-head * .2, head_y - .05, head_z - head / 2 - beak_len],
                               [head * .4, head * .32, .65], 4))
    if species == "blue_tit":
        head_cubes.append(cube([-head / 2 - .06, head_y + .2, head_z - head / 2 - .03],
                               [head + .12, head * .4, head + .05], 4))
    for side in (-1, 1):
        head_cubes.append(cube([side * head / 2 - (.02 if side > 0 else .18),
                                head_y + head * .45, head_z - head * .32], [.2, .38, .4], 7))
    bones.append({"name": "head", "parent": "body", "pivot": [0, head_y, head_z], "cubes": head_cubes})
    # Articulated wings: tapered shoulder + hand wing + individually splayed tips.
    for side, name in ((1, "wing_left"), (-1, "wing_right")):
        def span(start, end, z, depth, color, dy=0, thick=.42):
            low = w / 2 + start if side > 0 else -w / 2 - end
            return cube([low, shoulder_y + dy, z], [end - start, thick, depth], color)
        feathers = 5 if eagle else 4
        wing_cubes = [
            span(0, wing * .48, shoulder_z - 1, length * .69, 3, thick=.8),
            span(wing * .36, wing * .78, shoulder_z - .8, length * .52, 3, thick=.6),
            span(wing * .34, wing * .79, shoulder_z + length * .24, length * .13, 4, dy=.62, thick=.15),
        ]
        for i in range(feathers):
            end = wing * (.87 + .13 * (1 - abs(i - 1) / feathers))
            wing_cubes.append(span(wing * .69, end, shoulder_z - .8 + i * length * .12,
                                    length * .105, 4, dy=-i * .025, thick=.32))
        bones.append({"name": name, "parent": "root", "pivot": [side * w / 2, shoulder_y, shoulder_z],
                      "cubes": wing_cubes})
    tail_cubes = []
    for i in range(5):
        x = (i - 2) * w * .21
        feather_length = tail * (1 - abs(i - 2) * (.13 if raven else .025))
        tail_cubes.append(cube([x - w * .12, h * .32, length * .38], [w * .24, .35, feather_length],
                               5, [0, (i - 2) * (6 if eagle else 4), 0], [0, h * .32, length * .4]))
    bones.append({"name": "tail", "parent": "root", "pivot": [0, h * .32, length * .4], "cubes": tail_cubes})
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.lumen_birds." + species,
                        "texture_width": 64, "texture_height": 16,
                        "visible_bounds_width": 4, "visible_bounds_height": 4,
                        "visible_bounds_offset": [0, .25, 0]}, "bones": bones,
    }]}


def monster_geometry():
    """Original sculpted sea giant; all detail stays outside the playable belly."""
    body = [
        # The inner shell keeps a continuous, player-sized route to the mouth.
        cube([-18, -12, -24], [3, 26, 48], 0),
        cube([15, -12, -24], [3, 26, 48], 0),
        cube([-15, 11, -24], [30, 3, 48], 0),
        cube([-15, -12, -24], [30, 3, 48], 1),
        cube([-15, -9, 21], [30, 20, 3], 0),
        # Successive layers round the shoulders and taper toward the tail.
        cube([-16, -15, -22], [32, 5, 42], 1),
        cube([-12, -17, -16], [24, 3, 30], 10),
        cube([-16, 13, -22], [32, 6, 38], 0),
        cube([-12, 19, -18], [24, 5, 29], 2),
        cube([-8, 24, -12], [16, 2, 19], 9),
        cube([-13, -9, 23], [26, 18, 8], 0),
        cube([-10, -7, 30], [20, 14, 5], 9),
    ]
    for side in (-1, 1):
        def flank(near, width, y, height, z, length, color):
            return cube([near if side > 0 else -near-width, y, z], [width, height, length], color)
        body += [flank(18, 5, -8, 20, -22, 37, 0),
                 flank(23, 2, -4, 13, -17, 25, 9),
                 flank(17, 5, -11, 4, -20, 32, 10),
                 flank(17, 4, 12, 5, -18, 30, 2)]
        # Broken rows of raised plates, with smaller contrasting scale marks.
        for row in range(3):
            for i in range(5):
                z = -15 + i * 5 + (row % 2) * 1.3
                body.append(flank(25, .35, -3 + row * 4, 2.6, z, 3.2, 12 if (i+row) % 3 == 0 else 0))
                body.append(flank(25.35, .15, -2.7 + row * 4, .6, z + .4, 1.4, 9))
        for z in (11, 16):
            body.append(flank(23 if z == 11 else 18, .4, -2, 9, z, 2.4, 9))
    # Ventral grooves stop outside the belly floor.
    for z in range(-16, 17, 5):
        body.append(cube([-11, -17.2, z], [22, .3, .7], 9))
    bones = [{"name": "root", "pivot": [0, 0, 0]},
             {"name": "body", "parent": "root", "pivot": [0, 0, 0], "cubes": body}]
    head = [cube([-19, 14, -48], [38, 4, 27], 0),
            cube([-17, 18, -46], [34, 3, 25], 2),
            cube([-13, 21, -40], [26, 3, 19], 9),
            cube([-17, 13.5, -48], [34, 2, 3], 9),
            # Mouth lining follows the roof, leaving the escape corridor open.
            cube([-15, 13.3, -44], [30, .6, 20], 11)]
    for side in (-1, 1):
        def cheek(near, width, y, height, z, length, color):
            return cube([near if side > 0 else -near-width, y, z], [width, height, length], color)
        head += [cheek(16, 6, -12, 26, -46, 25, 0),
                 cheek(22, 4, -7, 18, -42, 21, 9),
                 cheek(17, 3, -9, 18, -48, 3, 1),
                 cheek(15.6, .5, -8, 16, -44, 19, 11),
                 # Dark sockets, arched brows and a small dark pupil overlay.
                 cheek(25.8, 1.2, 1, 10, -39, 11, 4),
                 cheek(25, 3.1, 10, 3, -40, 13, 2),
                 cheek(26.8, 1.2, 5.4, 2, -34.8, 2, 4),
                 cheek(26, 1, -.2, 1.4, -38, 9, 10)]
        for i in range(3):
            # Recessed-looking slits and offset lip edges across each gill cover.
            head.append(cheek(26, .3, -5 + i*.7, 12-i, -27 + i*2.3, .8, 4))
            head.append(cheek(26.3, .25, -4 + i*.7, 10-i, -26.3 + i*2.3, .5, 12))
        for z in (-42, -37, -31):
            head.append(cheek(22, .3, 14, 2, z, 3, 12))
    bones.append({"name": "head", "parent": "body", "pivot": [0, 0, -24], "cubes": head})
    bones.append({"name": "eyes", "parent": "head", "pivot": [0, 0, -24], "cubes": [
        cube([26.9 if side > 0 else -27.7, 3, -37.8], [.8, 5.7, 7.8], 7) for side in (-1, 1)
    ]})
    # Separate enamel bones keep white teeth independent of the golden party hat.
    upper_teeth = []
    for x in (-13, -8, -3, 3, 8, 13):
        upper_teeth += [cube([x-1.5, 12, -46.5], [3, 2, 3.4], 6),
                        cube([x-1, 10, -46.3], [2, 2, 3], 6),
                        cube([x-.5, 9, -46], [1, 1, 2.4], 6)]
    for x in (-16.2, 16.2):
        upper_teeth += [cube([x-1.4, 9, -48], [2.8, 5, 2], 6),
                        cube([x-.7, 5.5, -48], [1.4, 3.5, 2], 6)]
    bones.append({"name": "teeth_upper", "parent": "head", "pivot": [0, 0, -24], "cubes": upper_teeth})
    bones.append({"name": "jaw", "parent": "head", "pivot": [0, -8, -26], "cubes": [
        cube([-20, -16, -48], [40, 4, 24], 1),
        cube([-17, -19, -45], [34, 3, 19], 10),
        cube([-12, -21, -40], [24, 2, 13], 9),
        cube([-18, -12.2, -47], [36, 1, 21], 11),
        cube([-20, -13, -48], [40, 2, 2], 9),
    ]})
    lower_teeth = []
    for x in (-13, -8, -3, 3, 8, 13):
        lower_teeth += [cube([x-1.4, -12, -45.5], [2.8, 2, 3], 6),
                        cube([x-.7, -10, -45.2], [1.4, 1, 2.4], 6)]
    bones.append({"name": "teeth_lower", "parent": "jaw", "pivot": [0, -8, -26], "cubes": lower_teeth})
    for side, name in ((1, "fin_left"), (-1, "fin_right")):
        def fin(start, end, y, thick, z, length, color):
            return cube([start if side > 0 else -end, y, z], [end-start, thick, length], color)
        parts = [fin(16, 26, -7, 3, -10, 24, 0), fin(24, 35, -7, 2.8, -6, 23, 5),
                 fin(33, 42, -7, 2.4, 0, 20, 5), fin(40, 44, -7, 1.8, 8, 14, 9)]
        for i in range(4):
            parts.append(fin(24+i*4, 27+i*4, -4.1, .35, -4+i*3, 15-i, 12))
        bones.append({"name": name, "parent": "body", "pivot": [side*16, -6, -8], "cubes": parts})
    tail = [cube([-7, -6, 28], [14, 12, 12], 0),
            cube([-5, -4, 37], [10, 8, 7], 9)]
    for side in (-1, 1):
        for near, far, z, length in ((3, 13, 39, 7), (11, 22, 41, 7), (20, 28, 44, 4)):
            tail.append(cube([near if side > 0 else -far, -2, z], [far-near, 4, length], 5))
        for x in (9, 15, 21):
            tail.append(cube([side*x-.4, 2, 42], [.8, .3, 5.5], 12))
    bones.append({"name": "tail", "parent": "body", "pivot": [0, 0, 24], "cubes": tail})
    bones.append({"name": "dorsal", "parent": "body", "pivot": [0, 16, 0], "cubes": [
        cube([-3, 18, 0], [6, 9, 17], 2), cube([-2, 27, 6], [4, 6, 10], 5),
        cube([-1.3, 33, 11], [2.6, 2, 5], 9),
        cube([-3.2, 24, 3], [.3, 2, 12], 12), cube([2.9, 24, 3], [.3, 2, 12], 12),
    ]})
    # Pink and gold remain independent from enamel; small studs decorate the brim.
    hat = [cube([-10, 24, -41], [20, 1.5, 20], 8)]
    for i, width in enumerate((16, 13, 10, 7, 4)):
        hat.append(cube([-width/2, 25.5+i*3, -31-width/2], [width, 3, width], 3 if i % 2 == 0 else 8))
    hat += [cube([-.9, 40.5, -31.9], [1.8, 1.5, 1.8], 8),
            cube([-2.5, 42, -33.5], [5, 3, 5], 3)]
    for x in (-7, -3, 3, 7):
        hat.append(cube([x-.5, 24.4, -41.15], [1, .8, .3], 3))
    bones.append({"name": "party_hat", "parent": "head", "pivot": [0, 24, -31], "cubes": hat})
    # Scale geometry, including pivots, so the server envelope uses real blocks.
    for bone in bones:
        bone["pivot"] = [v * 8 / 3 for v in bone["pivot"]]
        for part in bone.get("cubes", []):
            for key in ("origin", "size", "pivot"):
                if key in part:
                    part[key] = [v * 8 / 3 for v in part[key]]
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.lumen_birds.deepmaw",
                        "texture_width": 64, "texture_height": 16,
                        "visible_bounds_width": 81, "visible_bounds_height": 58,
                        "visible_bounds_offset": [0, 0, 0]}, "bones": bones,
    }]}

def monster_animation():
    sway = "math.sin(query.life_time * 90.0)"
    return {"loop": True, "animation_length": 1, "bones": {
        "root": {"scale": "math.clamp(query.life_time / 1.2, 0.01, 1.0) * query.property('lumen_birds:feast_scale')"},
        "tail": {"rotation": [0, f"{sway} * 12.0", 0]},
        "fin_left": {"rotation": [0, 0, f"{sway} * 12.0"]},
        "fin_right": {"rotation": [0, 0, f"-({sway}) * 12.0"]},
        "jaw": {"rotation": ["-5.0 - math.sin(query.life_time * 45.0) * 5.0 - query.property('lumen_birds:jaw_open') * 30.0", 0, 0]},
    }}


def fish_geometry(species):
    """Centered fish; even animated fins fit the controller's water clearance."""
    w, h = {"trout": (2.8, 3.0), "carp": (3.9, 4.6), "pike": (2.4, 2.5)}[species]
    body = [cube([-w / 2, -h / 2, -3.5], [w, h, 7.0], 0),
            cube([-w * .40, -h * .52, -2.8], [w * .8, h * .28, 5.5], 1),
            cube([-w * .38, h * .34, -2.9], [w * .76, h * .2, 5.7], 2)]
    if species == "carp":
        # A deep belly and raised shoulder make a visibly rounder silhouette.
        body += [cube([-w * .43, h * .31, -2.3], [w * .86, 1.1, 3.8], 0),
                 cube([-w * .34, -h * .58, -1.9], [w * .68, .7, 3.8], 1)]
    for side in (-1, 1):
        x = side * w / 2 - (.02 if side > 0 else .10)
        for row in (-1, 1):
            for i in range(5 if species == "trout" else 4):
                # Original small spot/scales/streak quads, not borrowed textures.
                y = row * h * .19 + (i % 2) * .15
                z = -2.7 + i * 1.25 + (.35 if row > 0 else 0)
                body.append(cube([x, y, z], [.12, .32 if species == "trout" else .65,
                                                            .38 if species == "trout" else .19],
                                 4 if species != "pike" else 1))
    bones = [{"name": "root", "pivot": [0, 0, 0]},
             {"name": "body", "parent": "root", "pivot": [0, 0, 0], "cubes": body}]
    if species == "pike":
        head_w, head_z, eye_z = 2.5, -6.8, -6.25
        head = [cube([-head_w / 2, -.85, head_z], [head_w, 1.9, 3.6], 0),
                cube([-1.06, .25, -10.2], [2.12, .68, 3.6], 2),
                cube([-.94, -.80, -10.1], [1.88, .40, 3.5], 0)]
        for side in (-1, 1):
            for z in (-9.5, -8.5, -7.5):
                head.append(cube([side * .78 - .10, -.11, z], [.20, .39, .23], 6))
            head.append(cube([side * head_w / 2 - (.02 if side > 0 else .12), .17, eye_z - .14],
                             [.14, .82, 1.06], 4))
    else:
        head_w = w * .82
        head_z, eye_z = (-5.9, -5.38) if species == "trout" else (-5.5, -4.95)
        head_h = h * .72
        head = [cube([-head_w / 2, -head_h / 2, head_z], [head_w, head_h, -3.25 - head_z], 0),
                cube([-head_w * .4, -head_h * .43, head_z - .6], [head_w * .8, head_h * .54, .75], 6),
                cube([-head_w * .34, -head_h * .14, head_z - .64], [head_w * .68, .14, .1], 4)]
        if species == "carp":
            for side in (-1, 1):
                head.append(cube([side * head_w * .31 - .09, -1.75, head_z - .69], [.18, 1.36, .22],
                                 6, [0, 0, side * 17], [side * head_w * .31, -.39, head_z - .58]))
    bones.append({"name": "head", "parent": "body", "pivot": [0, 0, -3.3], "cubes": head})
    bones.append({"name": "eyes", "parent": "head", "pivot": [0, 0, -3.3], "cubes": [
        cube([side * head_w / 2 - (.01 if side > 0 else .16), .33, eye_z], [.17, .49, .66], 7)
        for side in (-1, 1)
    ]})
    # A narrow peduncle leads to the forked, vertically spread tail fin.
    tail_height = 3.15 if species == "carp" else 2.6
    bones.append({"name": "tail", "parent": "body", "pivot": [0, 0, 3.2], "cubes": [
        cube([-w * .25, -h * .31, 3.1], [w * .5, h * .62, 2.65], 0),
        cube([-.24, -1.15, 5.55], [.48, 2.3, 1.8], 5),
        cube([-.20, .65, 7.05], [.4, tail_height - .65, 2.05], 5),
        cube([-.20, -tail_height, 7.05], [.4, tail_height - .65, 2.05], 5),
    ]})
    for side, name in ((1, "fin_left"), (-1, "fin_right")):
        x = w * .36 if side > 0 else -w * .36 - 1.8
        bones.append({"name": name, "parent": "body", "pivot": [side * w * .36, -h * .22, -1.75],
                      "cubes": [cube([x, -h * .22, -1.85], [1.8, .23, 2.35], 3)]})
    dorsal_y = h * .31 + 1.1 if species == "carp" else h * .54
    dorsal_z = 1.8 if species == "pike" else -.5
    bones.append({"name": "dorsal", "parent": "body", "pivot": [0, dorsal_y, dorsal_z], "cubes": [
        cube([-.13, dorsal_y - .08, dorsal_z], [.26, 1.35, 2.7], 3),
        cube([-.12, dorsal_y + .65, dorsal_z + .45], [.24, 1.10, 1.65], 3),
    ]})
    bones.append({"name": "anal", "parent": "body", "pivot": [0, -h * .44, 1.65], "cubes": [
        cube([-.13, -h * .44 - 1.05, 1.65], [.26, 1.2, 2.0], 3),
    ]})
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.lumen_birds." + species,
                        "texture_width": 64, "texture_height": 16,
                        "visible_bounds_width": 3, "visible_bounds_height": 2,
                        "visible_bounds_offset": [0, 0, 0]}, "bones": bones,
    }]}


def swim_animation(species):
    frequency = {"trout": 210, "carp": 150, "pike": 120}[species]
    tail_angle = 14 if species == "pike" else 18
    sway = f"math.sin(query.life_time * {frequency}.0)"
    return {"loop": True, "animation_length": 1, "bones": {
        "root": {"scale": "math.clamp(query.life_time / 1.2, 0.01, 1.0)"},
        "body": {"rotation": [0, f"{sway} * 2.0", 0]},
        "tail": {"rotation": [0, f"{sway} * {tail_angle}.0", 0]},
        "fin_left": {"rotation": [0, 0, f"{sway} * 9.0"]},
        "fin_right": {"rotation": [0, 0, f"-({sway}) * 9.0"]},
        "dorsal": {"rotation": [0, 0, f"{sway} * 3.0"]},
        "anal": {"rotation": [0, 0, f"-({sway}) * 3.0"]},
    }}


def owl_geometry(species):
    """Original broad-faced owls, with feet at y=0 in their upright perch pose."""
    large = species == "eagle_owl"
    w, h, head, wing = (6.1, 7.8, 6.6, 7.8) if large else (4.6, 6.0, 5.2, 6.0)
    depth = w * .82
    base, shoulder_y = 1.1, h + .25
    head_y, head_z = h * .82, -depth * .12
    face_z = head_z - head * .45
    bones = [{"name": "root", "pivot": [0, 0, 0]},
             {"name": "body", "parent": "root", "pivot": [0, base, 0], "cubes": [
                 cube([-w / 2, base, -depth / 2], [w, h, depth], 0),
                 cube([-w * .4, base + .4, -depth / 2 - .12], [w * .8, h * .8, .24], 1),
             ]}]
    # Broken vertical breast markings distinguish the owls from the day birds.
    for row in range(3):
        for column in (-1, 0, 1):
            bones[1]["cubes"].append(cube([column * w * .23 - .12, base + 1 + row * h * .19,
                                           -depth / 2 - .16], [.24, h * .12, .12], 0))
    head_cubes = [cube([-head / 2, head_y, head_z - head * .42], [head, head * .78, head * .8], 2)]
    for side in (-1, 1):
        # A pale facial disc surrounds each forward-facing eye.
        head_cubes.append(cube([side * head * .24 - head * .23, head_y + head * .12, face_z],
                               [head * .46, head * .54, .3], 1))
        head_cubes.append(cube([side * head * .24 - head * .14, head_y + head * .30, face_z - .08],
                               [head * .28, head * .23, .14], 4))
        if large:
            head_cubes.append(cube([side * head * .36 - .48, head_y + head * .70, head_z - head * .32],
                                   [.96, head * .40, 1.3], 4,
                                   [0, 0, -side * 16], [side * head * .36, head_y + head * .70, head_z]))
    head_cubes += [cube([-head * .08, head_y + head * .19, face_z - .58],
                        [head * .16, head * .22, .65], 6),
                   cube([-head * .045, head_y + head * .10, face_z - .6],
                        [head * .09, head * .15, .3], 6)]
    bones.append({"name": "head", "parent": "body", "pivot": [0, head_y, head_z], "cubes": head_cubes})
    bones.append({"name": "eyes", "parent": "head", "pivot": [0, head_y, head_z], "cubes": [
        cube([side * head * .24 - head * .09, head_y + head * .34, face_z - .17],
             [head * .18, head * .15, .12], 7) for side in (-1, 1)
    ]})
    for side, name in ((1, "wing_left"), (-1, "wing_right")):
        def span(start, end, z, length, color, thickness=.38):
            x = w / 2 + start if side > 0 else -w / 2 - end
            return cube([x, shoulder_y, z], [end - start, thickness, length], color)
        wing_cubes = [span(0, wing * .52, -.5, depth * .85, 3, .65),
                      span(wing * .4, wing * .78, -.35, depth * .75, 3, .48)]
        for i in range(5):
            wing_cubes.append(span(wing * .68, wing * (1 - abs(i - 2) * .035),
                                   -.35 + i * depth * .15, depth * .14, 4))
        bones.append({"name": name, "parent": "body", "pivot": [side * w / 2, shoulder_y, 0],
                      "cubes": wing_cubes})
    bones.append({"name": "tail", "parent": "body", "pivot": [0, 2.3, depth * .33], "cubes": [
        cube([(i - 1) * w * .24 - w * .13, 2.3, depth * .33], [w * .26, .36, 2.7], 5)
        for i in range(3)
    ]})
    feet = []
    for side in (-1, 1):
        x = side * w * .23
        feet.append(cube([x - .25, .15, -.15], [.5, base + .2, .5], 6))
        for toe in (-1, 0, 1):
            feet.append(cube([x + toe * .24 - .1, 0, -.85], [.2, .22, 1.0], 6))
    bones.append({"name": "feet", "parent": "body", "pivot": [0, base, 0], "cubes": feet})
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.lumen_birds." + species,
                        "texture_width": 64, "texture_height": 16,
                        "visible_bounds_width": 4, "visible_bounds_height": 4,
                        "visible_bounds_offset": [0, .5, 0]}, "bones": bones,
    }]}


def perch_animation():
    # The longest folded feather stays above y=0; the feet alone touch the tree.
    return {"loop": True, "animation_length": 1, "bones": {
        "root": {"rotation": [0, 0, 0], "scale": "math.clamp(query.life_time / 1.2, 0.01, 1.0)"},
        "wing_left": {"rotation": [0, 12, -78]},
        "wing_right": {"rotation": [0, -12, 78]},
        "tail": {"rotation": [45, 0, 0]},
    }}


def animation(species):
    if species in MONSTER_SPECIES:
        return monster_animation()
    if species in FISH_SPECIES:
        return swim_animation(species)
    if species in NOCTURNAL_SPECIES:
        frequency = 540 if species == "eagle_owl" else 660
        wing = f"math.mod(query.life_time, 6.0) < 3.2 ? math.sin(query.life_time * {frequency}.0) * 32.0 : 5.0"
        return {"loop": True, "animation_length": 1, "bones": {
            "root": {"rotation": [-18, 0, -4], "scale": "math.clamp(query.life_time / 1.2, 0.01, 1.0)"},
            "wing_left": {"rotation": [0, 0, wing]},
            "wing_right": {"rotation": [0, 0, f"-({wing})"]},
            "tail": {"rotation": ["math.sin(query.life_time * 90.0) * 3.0", 0, 0]},
        }}
    if species == "eagle":
        wing = "math.mod(query.life_time, 9.0) < 1.2 ? math.sin(query.life_time * 720.0) * 20.0 : 5.0 + math.sin(query.life_time * 90.0) * 2.0"
        bank = -9
    elif species == "raven":
        wing = "math.mod(query.life_time, 5.0) < 2.4 ? math.sin(query.life_time * 1080.0) * 32.0 : 7.0 + math.sin(query.life_time * 120.0) * 3.0"
        bank = -5
    else:
        frequency = {"blue_tit": 2016, "robin": 1800, "goldfinch": 2160}[species]
        wing = f"math.sin(query.life_time * {frequency}.0) * 43.0"
        bank = -3
    # Fade in by scale only. No age-based fade out: client lifetime restarts when
    # entering view, whereas the server controls the actual 45-second lifetime.
    return {"loop": True, "animation_length": 1, "bones": {
        "root": {"rotation": [0, 0, bank], "scale": "math.clamp(query.life_time / 1.2, 0.01, 1.0)"},
        "wing_left": {"rotation": [0, 0, wing]},
        "wing_right": {"rotation": [0, 0, f"-({wing})"]},
        "tail": {"rotation": ["math.sin(query.life_time * 120.0) * 3.0", 0, 0]},
    }}


def generate(root=ROOT):
    bp, rp = root / "behavior_pack", root / "resource_pack"
    # Only these generated output directories are replaced; src/docs stay intact.
    for directory in (bp, rp):
        if directory.exists():
            shutil.rmtree(directory)
        directory.mkdir(parents=True)
    common = {"name": "Lumen · Stumme Himmelsvögel", "description":
              "Stumme Vögel und Fische, Tiefsee und Tiefenmaul mit Geburtstagshut; Tauchausrüstung und U-Boot für das Meeresabenteuer.",
              "version": VERSION, "min_engine_version": ENGINE}
    write_json(rp / "manifest.json", {"format_version": 2, "header": {**common, "uuid": RP_UUID},
        "modules": [{"type": "resources", "uuid": "e8a4612a-1414-41b6-92f4-025cd544ed04", "version": VERSION}]})
    write_json(bp / "manifest.json", {"format_version": 2, "header": {**common, "uuid": BP_UUID},
        "modules": [
            {"type": "data", "uuid": "4946519a-4f7d-41cd-bdb0-726d5e7225d1", "version": VERSION},
            {"type": "script", "language": "javascript", "entry": "scripts/main.js",
             "uuid": "d49d11b0-91f2-476d-9d31-d95d4d93bc7a", "version": VERSION},
        ], "dependencies": [{"uuid": RP_UUID, "version": VERSION},
                             {"module_name": "@minecraft/server", "version": "2.0.0"}]})
    (bp / "scripts").mkdir()
    for source in (root / "src").glob("*.js"):
        shutil.copyfile(source, bp / "scripts" / source.name)
    for relative, document in {**deep_sea_assets(), **diving_assets(), **mutant_assets()}.items():
        write_json(root / relative, document)
    for relative, data in {**diving_textures(), **mutant_textures()}.items():
        destination = root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    animations = {}
    for species in SPECIES:
        identifier = "lumen_birds:" + species
        nocturnal = species in NOCTURNAL_SPECIES
        fish = species in AQUATIC_SPECIES
        emissive = species in EMISSIVE_SPECIES
        animation_name = "swim" if fish else "flight"
        description = {"identifier": identifier, "is_spawnable": False, "is_summonable": True}
        if nocturnal:
            description["properties"] = {"lumen_birds:perched": {"type": "bool", "default": False, "client_sync": True}}
        if species in MONSTER_SPECIES:
            description["properties"] = {
                "lumen_birds:feast_scale": {"type": "float", "range": [1, 3.5], "default": 1, "client_sync": True},
                "lumen_birds:jaw_open": {"type": "float", "range": [0, 1], "default": 0, "client_sync": True},
            }
        write_json(bp / "entities" / (species + ".json"), {"format_version": "1.21.0", "minecraft:entity": {
            # Script spawnEntity also needs summonability in Bedrock. No egg or
            # spawn rules; the controller removes manually summoned orphans.
            "description": description,
            "component_groups": {"lumen_birds:retire": {"minecraft:instant_despawn": {}}, **({
                "lumen_birds:feasting": {"minecraft:timer": {"looping": False, "time": 180,
                    "time_down_event": {"event": "lumen_birds:expire", "target": "self"}}},
            } if species in MONSTER_SPECIES else {})},
            "components": {
                "minecraft:type_family": {"family": ["lumen_monster" if species in MONSTER_SPECIES else "lumen_fish" if fish else "lumen_birds"]},
                "minecraft:health": {"value": 1, "max": 1},
                "minecraft:physics": {"has_gravity": False, "has_collision": False},
                "minecraft:collision_box": {"width": .25, "height": .25},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:damage_sensor": {"triggers": [{"deals_damage": "no"}]},
                "minecraft:fire_immune": {},
                "minecraft:timer": {"looping": False, "time": 60,
                                    "time_down_event": {"event": "lumen_birds:expire", "target": "self"}},
            },
            "events": {"lumen_birds:expire": {"add": {"component_groups": ["lumen_birds:retire"]}}, **({
                "lumen_birds:begin_feast": {"add": {"component_groups": ["lumen_birds:feasting"]}},
            } if species in MONSTER_SPECIES else {})},
        }})
        client = {"identifier": identifier,
                "materials": {"default": "entity_alphatest"},
                "textures": {"default": "textures/entity/lumen_birds/" + species},
                "geometry": {"default": "geometry.lumen_birds." + species},
                "animations": {animation_name: "animation.lumen_birds." + species + "." + animation_name},
                "scripts": {"animate": [animation_name]},
                "render_controllers": ["controller.render.lumen_birds"],
        }
        if emissive:
            client["materials"]["eyes"] = "entity_emissive"
            client["render_controllers"] = ["controller.render.lumen_birds.nocturnal"]
        if nocturnal:
            client["animations"].update(perch="animation.lumen_birds." + species + ".perch",
                                         pose="controller.animation.lumen_birds.nocturnal")
            client["scripts"]["animate"] = ["pose"]
            animations["animation.lumen_birds." + species + ".perch"] = perch_animation()
        write_json(rp / "entity" / (species + ".entity.json"), {"format_version": "1.10.0", "minecraft:client_entity": {
            "description": client}})
        write_json(rp / "models" / "entity" / (species + ".geo.json"), geometry(species))
        animations["animation.lumen_birds." + species + "." + animation_name] = animation(species)
        colors = [bytes.fromhex(color) for color in PALETTES[species]]
        texture = rp / "textures" / "entity" / "lumen_birds" / (species + (".tga" if emissive else ".png"))
        texture.parent.mkdir(parents=True, exist_ok=True)
        if emissive:
            # Vanilla entity_emissive requires TGA and interprets alpha inversely.
            # Alpha 3 matches the glow pixels in Mojang's enderman.tga sample;
            # other palette slots remain opaque under entity_alphatest.
            # https://learn.microsoft.com/minecraft/creator/documents/material-files
            # https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/textures/entity/enderman/enderman.tga
            def emissive_pixel(x, y):
                slot = (y // 8) * 8 + x // 8 if len(colors) > 8 else x // 8
                return (*colors[slot], 3 if x // 8 == 7 else 255)
            texture.write_bytes(tga(64, 16, emissive_pixel))
        else:
            texture.write_bytes(png(64, 16, lambda x, y: colors[x // 8]))
    write_json(rp / "animations" / "birds.animation.json", {"format_version": "1.8.0", "animations": animations})
    write_json(rp / "render_controllers" / "birds.render_controllers.json", {
        "format_version": "1.8.0", "render_controllers": {"controller.render.lumen_birds": {
            "geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"],
        }, "controller.render.lumen_birds.nocturnal": {
            "geometry": "Geometry.default", "materials": [{"*": "Material.default"}, {"eyes": "Material.eyes"}],
            "textures": ["Texture.default"],
        }}})
    write_json(rp / "animation_controllers" / "nocturnal.animation_controllers.json", {
        "format_version": "1.10.0", "animation_controllers": {"controller.animation.lumen_birds.nocturnal": {
            "initial_state": "flight", "states": {
                "flight": {"animations": ["flight"], "blend_transition": .35,
                           "transitions": [{"perch": "query.property('lumen_birds:perched')"}]},
                "perch": {"animations": ["perch"], "blend_transition": .35,
                          "transitions": [{"flight": "!query.property('lumen_birds:perched')"}]},
            },
        }}})
    write_json(rp / "textures" / "texture_list.json", ["textures/entity/lumen_birds/" + s for s in SPECIES]
               + [Path(path).relative_to("resource_pack").with_suffix("").as_posix()
                  for path in {**diving_textures(), **mutant_textures()}])
    write_json(rp / "texts" / "languages.json", ["de_DE", "en_US"])
    for index, lang in enumerate(("de_DE", "en_US")):
        (rp / "texts" / (lang + ".lang")).write_text(
            "\n".join([*("entity.lumen_birds:" + s + ".name=" + NAMES[s][index] for s in SPECIES),
                       *(key + "=" + value for key, value in
                         {**diving_translations(lang), **mutant_translations(lang)}.items())]) + "\n", encoding="utf-8")
    # Small code-native pack icon: amber bird silhouette on a teal sky.
    def icon_pixel(x, y):
        sky = (15 + y // 9, 40 + y // 5, 58 + y // 6)
        xx, yy = abs(x - 64), y - 53
        wing_shape = 4 < xx < 49 and abs(yy + xx * .28) < 5 + (49 - xx) * .075
        body_shape = xx < 5 and -7 < yy < 21
        head_shape = (x - 65) ** 2 + (y - 43) ** 2 < 43
        return (224, 186, 104) if wing_shape or body_shape or head_shape else sky
    for directory in (bp, rp):
        (directory / "pack_icon.png").write_bytes(png(128, 128, icon_pixel))
    print(f"Generated {len(BIRD_SPECIES)} original bird and {len(FISH_SPECIES)} fish models, {len(MONSTER_SPECIES)} sea monster, animations and both packs.")


if __name__ == "__main__":
    generate()
