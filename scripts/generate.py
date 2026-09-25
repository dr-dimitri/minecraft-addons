"""Generate original cuboid bird models and both Bedrock packs, using only stdlib."""
from pathlib import Path
import json
import shutil
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
VERSION = [0, 1, 1]
ENGINE = [1, 21, 90]  # First Bedrock release with stable @minecraft/server 2.0.0.
RP_UUID = "5ab6115a-55e8-4ba6-8c9a-d2f707667af4"
BP_UUID = "142232de-2028-4b6e-8048-c41d5ecda537"
NOCTURNAL_SPECIES = ("owl", "eagle_owl")
SPECIES = ("raven", "blue_tit", "robin", "goldfinch", "eagle", *NOCTURNAL_SPECIES)
NAMES = {
    "raven": ("Rabe", "Raven"), "blue_tit": ("Blaumeise", "Blue tit"),
    "robin": ("Rotkehlchen", "Robin"), "goldfinch": ("Stieglitz", "Goldfinch"),
    "eagle": ("Steinadler", "Golden eagle"),
    "owl": ("Eule", "Owl"), "eagle_owl": ("Uhu", "Eagle owl"),
}
# Body, breast, crown, wing, flight feathers, tail, beak, eye.
PALETTES = {
    "raven": ["202b37", "17212c", "2e3c4b", "26364a", "111a26", "182535", "2b3036", "090c12"],
    "blue_tit": ["72895c", "e3cf58", "4484bf", "386c9d", "e4e1cc", "466f92", "414b52", "141b25"],
    "robin": ["827665", "c86935", "81705d", "685c4c", "a39883", "655743", "423e38", "141518"],
    "goldfinch": ["aa906d", "d8c8a0", "c24832", "3b3934", "ebc943", "3e3b32", "d4bd85", "161716"],
    "eagle": ["644c38", "78563b", "ad864f", "574438", "352e29", "695241", "b99b52", "171b1b"],
    "owl": ["75675c", "d0c3a8", "8f8071", "605950", "423e39", "63574a", "514330", "ff2525"],
    "eagle_owl": ["745037", "c9a477", "926a45", "62432f", "392e26", "735336", "4a3829", "ff2525"],
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
        face: {"uv": [color * 8 + 1, 1], "uv_size": [6, 6]}
        for face in ("north", "south", "east", "west", "up", "down")
    }}
    if rotation is not None:
        result.update(rotation=rotation, pivot=pivot)
    return result


def geometry(species):
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
              "Sieben stumme Vogelarten: fünf am Tag, Eulen und Uhus in Dämmerung und Nacht mit roten Leuchtaugen und Baumsitzplätzen.",
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
    animations = {}
    for species in SPECIES:
        identifier = "lumen_birds:" + species
        nocturnal = species in NOCTURNAL_SPECIES
        description = {"identifier": identifier, "is_spawnable": False, "is_summonable": True}
        if nocturnal:
            description["properties"] = {"lumen_birds:perched": {"type": "bool", "default": False, "client_sync": True}}
        write_json(bp / "entities" / (species + ".json"), {"format_version": "1.21.0", "minecraft:entity": {
            # Script spawnEntity also needs summonability in Bedrock. No egg or
            # spawn rules; the controller removes manually summoned orphans.
            "description": description,
            "component_groups": {"lumen_birds:retire": {"minecraft:instant_despawn": {}}},
            "components": {
                "minecraft:type_family": {"family": ["lumen_birds"]},
                "minecraft:health": {"value": 1, "max": 1},
                "minecraft:physics": {"has_gravity": False, "has_collision": False},
                "minecraft:collision_box": {"width": .25, "height": .25},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:damage_sensor": {"triggers": [{"deals_damage": "no"}]},
                "minecraft:fire_immune": {},
                "minecraft:timer": {"looping": False, "time": 60,
                                    "time_down_event": {"event": "lumen_birds:expire", "target": "self"}},
            },
            "events": {"lumen_birds:expire": {"add": {"component_groups": ["lumen_birds:retire"]}}},
        }})
        client = {"identifier": identifier,
                "materials": {"default": "entity_alphatest"},
                "textures": {"default": "textures/entity/lumen_birds/" + species},
                "geometry": {"default": "geometry.lumen_birds." + species},
                "animations": {"flight": "animation.lumen_birds." + species + ".flight"},
                "scripts": {"animate": ["flight"]},
                "render_controllers": ["controller.render.lumen_birds"],
        }
        if nocturnal:
            client["materials"]["eyes"] = "entity_emissive"
            client["animations"].update(perch="animation.lumen_birds." + species + ".perch",
                                         pose="controller.animation.lumen_birds.nocturnal")
            client["scripts"]["animate"] = ["pose"]
            client["render_controllers"] = ["controller.render.lumen_birds.nocturnal"]
            animations["animation.lumen_birds." + species + ".perch"] = perch_animation()
        write_json(rp / "entity" / (species + ".entity.json"), {"format_version": "1.10.0", "minecraft:client_entity": {
            "description": client}})
        write_json(rp / "models" / "entity" / (species + ".geo.json"), geometry(species))
        animations["animation.lumen_birds." + species + ".flight"] = animation(species)
        colors = [bytes.fromhex(color) for color in PALETTES[species]]
        texture = rp / "textures" / "entity" / "lumen_birds" / (species + (".tga" if nocturnal else ".png"))
        texture.parent.mkdir(parents=True, exist_ok=True)
        if nocturnal:
            # Vanilla entity_emissive requires TGA and interprets alpha inversely.
            # Alpha 3 matches the glow pixels in Mojang's enderman.tga sample;
            # other palette slots remain opaque under entity_alphatest.
            # https://learn.microsoft.com/minecraft/creator/documents/material-files
            # https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/textures/entity/enderman/enderman.tga
            texture.write_bytes(tga(64, 16, lambda x, y: (*colors[x // 8], 3 if x // 8 == 7 else 255)))
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
    write_json(rp / "textures" / "texture_list.json", ["textures/entity/lumen_birds/" + s for s in SPECIES])
    write_json(rp / "texts" / "languages.json", ["de_DE", "en_US"])
    for index, lang in enumerate(("de_DE", "en_US")):
        (rp / "texts" / (lang + ".lang")).write_text(
            "\n".join("entity.lumen_birds:" + s + ".name=" + NAMES[s][index] for s in SPECIES) + "\n", encoding="utf-8")
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
    print(f"Generated {len(SPECIES)} original bird models, animations and both packs.")


if __name__ == "__main__":
    generate()
