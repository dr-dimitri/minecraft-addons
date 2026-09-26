"""Check pack wiring and silence invariants. Not a replacement for Bedrock."""
from pathlib import Path
import json
import re
import struct
import uuid
import zlib
from generate import ROOT, SPECIES, AQUATIC_SPECIES, MONSTER_SPECIES, NOCTURNAL_SPECIES, EMISSIVE_SPECIES, VERSION, ENGINE, RP_UUID, BP_UUID
from deep_sea import assets as deep_sea_assets
from diving import assets as diving_assets, binary_assets as diving_textures
from mutant_fish import assets as mutant_assets, binary_assets as mutant_textures, SPECIES as MUTANTS


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def check_png(path, dimensions):
    data = path.read_bytes()
    require(data[:8] == b"\x89PNG\r\n\x1a\n", f"PNG signature: {path}")
    at, compressed, ended = 8, b"", False
    while at < len(data):
        length = struct.unpack(">I", data[at:at + 4])[0]
        tag = data[at + 4:at + 8]
        payload = data[at + 8:at + 8 + length]
        crc = struct.unpack(">I", data[at + 8 + length:at + 12 + length])[0]
        require(zlib.crc32(tag + payload) == crc, f"PNG CRC: {path}")
        if tag == b"IHDR":
            require(struct.unpack(">II", payload[:8]) == dimensions, f"PNG size: {path}")
            require(payload[8:] == bytes((8, 2, 0, 0, 0)), f"PNG RGB format: {path}")
        if tag == b"IDAT":
            compressed += payload
        if tag == b"IEND":
            ended = True
        at += 12 + length
    require(ended and at == len(data), f"PNG structure: {path}")
    require(len(zlib.decompress(compressed)) == dimensions[1] * (1 + dimensions[0] * 3), f"PNG pixels: {path}")


def check_emissive_texture(path, species):
    """Check the uncompressed BGRA texture and its inverse-alpha glow mask."""
    label = "Deepmaw" if species == "deepmaw" else "Pike" if species == "pike" else "Owl"
    data = path.read_bytes()
    require(len(data) == 18 + 64 * 16 * 4, f"TGA pixels: {path}")
    header = struct.unpack("<BBBHHBHHHHBB", data[:18])
    require(header == (0, 0, 2, 0, 0, 0, 0, 0, 64, 16, 32, 0x28), f"TGA RGBA format: {path}")
    for y in range(16):
        for x in range(64):
            start = 18 + (y * 64 + x) * 4
            blue, green, red, alpha = data[start:start + 4]
            eye = x >= 56
            require(alpha == (3 if eye else 255), f"{label} eye alpha mask: {path}")
            if eye:
                if species == "deepmaw":
                    require(min(blue, green) >= 128 and min(blue, green) > red * 2,
                            f"Deepmaw eyes must be cyan: {path}")
                elif species == "pike":
                    require(min(red, green) >= 128 and max(red, green) <= min(red, green) * 1.5
                            and min(red, green) > blue * 2, f"Pike eyes must be yellow: {path}")
                else:
                    require(red >= 128 and red > green * 2 and red > blue * 2, f"Owl eyes must be red: {path}")


def validate(root=ROOT):
    bp, rp = root / "behavior_pack", root / "resource_pack"
    for relative, expected in deep_sea_assets().items():
        path = root / relative
        require(path.is_file(), f"Missing deep-sea asset: {relative}")
        require(load(path) == expected, f"Stale deep-sea asset: {relative}")
    for relative, expected in {**diving_assets(), **mutant_assets()}.items():
        path = root / relative
        require(path.is_file(), f"Missing diving asset: {relative}")
        require(load(path) == expected, f"Stale diving asset: {relative}")
    for relative, expected in {**diving_textures(), **mutant_textures()}.items():
        path = root / relative
        require(path.is_file() and path.read_bytes() == expected, f"Stale diving texture: {relative}")
    bm, rm = load(bp / "manifest.json"), load(rp / "manifest.json")
    all_uuids = []
    for manifest in (bm, rm):
        require(manifest["format_version"] == 2, "Stable manifest format 2 required")
        require(manifest["header"]["version"] == VERSION, "Pack version mismatch")
        require(manifest["header"]["min_engine_version"] == ENGINE, "Engine version mismatch")
        for entry in [manifest["header"], *manifest["modules"]]:
            all_uuids.append(str(uuid.UUID(entry["uuid"])))
            require(entry["version"] == VERSION, "Module version mismatch")
    require(len(all_uuids) == len(set(all_uuids)), "UUID collision")
    require(bm["header"]["uuid"] == BP_UUID and rm["header"]["uuid"] == RP_UUID, "Pack identity changed")
    require(bm["dependencies"] == [{"uuid": RP_UUID, "version": VERSION},
                                  {"module_name": "@minecraft/server", "version": "2.0.0"}], "Pack dependency wiring")
    require({m["type"] for m in bm["modules"]} == {"data", "script"}, "Behavior modules")
    script = next(m for m in bm["modules"] if m["type"] == "script")
    require(script["language"] == "javascript" and (bp / script["entry"]).is_file(), "Script entry missing")
    require((bp / script["entry"]).resolve().is_relative_to(bp.resolve()), "Script entry outside pack")
    for source in (root / "src").glob("*.js"):
        generated = bp / "scripts" / source.name
        require(generated.is_file(), f"Missing generated script: {source.name}")
        require(source.read_bytes() == generated.read_bytes(), f"Stale script: {source.name}")
    scripts = "\n".join(p.read_text() for p in (bp / "scripts").glob("*.js"))
    require(not re.search(r"\b(playSound|runCommand|playMusic|stopMusic|setBlock)\b", scripts), "Unexpected world/audio mutation")
    settings = (bp / "scripts" / "world_settings.js").read_text()
    require(re.search(r"export\s+const\s+ADVENTURE_WORLD\s*=\s*false\s*;", settings),
            "Ordinary add-on must not build the adventure village")
    for path in (bp / "scripts").glob("*.js"):
        if path.name not in {"ocean_village.js", "village_feast.js", "belly_rooms.js"}:
            require(not re.search(r"\b(setType|setPermutation)\b", path.read_text()), "Block changes outside adventure village")
        for target in re.findall(r"from\s+['\"]([^'\"]+)", path.read_text()):
            if target.startswith("."):
                require((path.parent / target).is_file(), f"Missing JS import: {target}")
            else:
                require(target == "@minecraft/server", f"Unexpected module: {target}")
    animations = load(rp / "animations" / "birds.animation.json")["animations"]
    pose_controllers = load(rp / "animation_controllers" / "nocturnal.animation_controllers.json")["animation_controllers"]
    controllers = load(rp / "render_controllers" / "birds.render_controllers.json")["render_controllers"]
    require(len(list((bp / "entities").glob("*.json"))) == len(SPECIES) + len(MUTANTS) + 1, "Unexpected server entities")
    require(len(list((rp / "entity").glob("*.json"))) == len(SPECIES) + len(MUTANTS) + 1, "Unexpected client entities")
    for species in SPECIES:
        nocturnal = species in NOCTURNAL_SPECIES
        fish = species in AQUATIC_SPECIES
        emissive = species in EMISSIVE_SPECIES
        label = "Deepmaw" if species == "deepmaw" else "Pike" if species == "pike" else "Owl"
        identifier = "lumen_birds:" + species
        server = load(bp / "entities" / (species + ".json"))["minecraft:entity"]
        client = load(rp / "entity" / (species + ".entity.json"))["minecraft:client_entity"]["description"]
        require(server["description"]["identifier"] == client["identifier"] == identifier, "Entity ID mismatch")
        require(server["description"].get("is_summonable") is True, "Script spawns require summonability")
        require(server["description"].get("is_spawnable") is False, "Unexpected spawn egg")
        if nocturnal:
            require(server["description"].get("properties", {}).get("lumen_birds:perched") == {
                "type": "bool", "default": False, "client_sync": True,
            }, "Missing/unsynchronized perch property")
        if fish:
            require("lumen_birds:perched" not in server["description"].get("properties", {}),
                    "Fish cannot use a perch property")
        comp = server["components"]
        require(comp["minecraft:type_family"]["family"] == ["lumen_monster" if species in MONSTER_SPECIES else "lumen_fish" if fish else "lumen_birds"],
                "Entity family mismatch")
        require(comp["minecraft:physics"] == {"has_gravity": False, "has_collision": False}, "Physics mismatch")
        require(comp["minecraft:damage_sensor"]["triggers"] == [{"deals_damage": "no"}], "Damage suppression missing")
        require(comp["minecraft:timer"] == {"looping": False, "time": 60,
                "time_down_event": {"event": "lumen_birds:expire", "target": "self"}}, "Native cleanup timer missing")
        require(server["events"]["lumen_birds:expire"]["add"]["component_groups"] == ["lumen_birds:retire"], "Retire event wiring")
        require(server["component_groups"]["lumen_birds:retire"] == {"minecraft:instant_despawn": {}}, "No native despawn")
        require(not any(k.startswith("minecraft:behavior.") or k in ("minecraft:loot", "minecraft:experience_reward") for k in comp), "Gameplay AI/loot added")
        geo = load(rp / "models" / "entity" / (species + ".geo.json"))["minecraft:geometry"][0]
        require(client["geometry"]["default"] == geo["description"]["identifier"], "Geometry reference mismatch")
        bones = {b["name"] for b in geo["bones"]}
        require(len(bones) == len(geo["bones"]), "Duplicate bone")
        parents = {b["name"]: b.get("parent") for b in geo["bones"]}
        for bone in geo["bones"]:
            ancestor, seen = bone["name"], set()
            while ancestor is not None:
                require(ancestor in bones and ancestor not in seen, "Missing/cyclic bone parent")
                seen.add(ancestor); ancestor = parents[ancestor]
            for cube in bone.get("cubes", []):
                require(all(v > 0 for v in cube["size"]), "Invalid cube size")
                for face in cube["uv"].values():
                    require(all(0 <= u and u + s <= bound for u, s, bound in zip(face["uv"], face["uv_size"], (64, 16))), "Texture UV out of bounds")
        if emissive:
            require(client["materials"] == {"default": "entity_alphatest", "eyes": "entity_emissive"},
                    "Missing emissive eye material")
            eyes = next((bone for bone in geo["bones"] if bone["name"] == "eyes"), None)
            require(eyes is not None and eyes.get("parent") == "head" and len(eyes.get("cubes", [])) == 2,
                    f"Missing {label.lower()} eye geometry")
            for bone in geo["bones"]:
                for cube in bone.get("cubes", []):
                    for face in cube["uv"].values():
                        x, width = face["uv"][0], face["uv_size"][0]
                        require((56 <= x and x + width <= 64) if bone["name"] == "eyes" else x + width <= 56,
                                f"{label} eye texture mapping")
            check_emissive_texture(rp / (client["textures"]["default"] + ".tga"), species)
            require(client["render_controllers"] == ["controller.render.lumen_birds.nocturnal"],
                    f"{label} render controller wiring")
            require(controllers.get("controller.render.lumen_birds.nocturnal") == {
                "geometry": "Geometry.default",
                "materials": [{"*": "Material.default"}, {"eyes": "Material.eyes"}],
                "textures": ["Texture.default"],
            }, f"{label} emissive eye render mapping")
        else:
            require(client["materials"] == {"default": "entity_alphatest"}, "Unexpected material")
            check_png(rp / (client["textures"]["default"] + ".png"), (64, 16))
        if nocturnal:
            require(client["animations"] == {
                "flight": "animation.lumen_birds." + species + ".flight",
                "perch": "animation.lumen_birds." + species + ".perch",
                "pose": "controller.animation.lumen_birds.nocturnal",
            }, "Owl flight/perch animation wiring")
            require(client["scripts"]["animate"] == ["pose"], "Owl perch animation switch")
            require(pose_controllers.get("controller.animation.lumen_birds.nocturnal") == {
                "initial_state": "flight", "states": {
                    "flight": {"animations": ["flight"],
                               "transitions": [{"perch": "query.property('lumen_birds:perched')"}],
                               "blend_transition": .35},
                    "perch": {"animations": ["perch"],
                              "transitions": [{"flight": "!query.property('lumen_birds:perched')"}],
                              "blend_transition": .35},
                },
            }, "Owl pose controller wiring")
        if fish:
            require(client["animations"] == {"swim": "animation.lumen_birds." + species + ".swim"},
                    "Fish swim animation wiring")
            require(client["scripts"]["animate"] == ["swim"], "Fish swim animation inactive")
        for entry in client["scripts"]["animate"]:
            for alias in [entry] if isinstance(entry, str) else entry:
                require(alias in client["animations"] and (client["animations"][alias] in animations
                        or client["animations"][alias] in pose_controllers),
                        "Missing animation reference")
        for reference in client["animations"].values():
            if reference in pose_controllers:
                continue
            require(reference in animations, "Missing animation reference")
            animation = animations[reference]
            require(set(animation["bones"]) <= bones, "Animation references missing bone")
        require(all(c in controllers for c in client["render_controllers"]), "Missing render controller")
    for directory in (bp, rp):
        check_png(directory / "pack_icon.png", (128, 128))
        for path in directory.rglob("*"):
            require(path.suffix not in (".ogg", ".wav", ".mp3"), "Audio asset is forbidden")
            require("sounds" not in path.parts and "spawn_rules" not in path.parts, "Unexpected sounds/spawn rules")
            if path.suffix == ".json":
                text = path.read_text()
                load(path)
                require(not re.search(r'"[^"\n]*(?:sound|runtime_identifier)[^"\n]*"\s*:', text), f"Audio/inheritance key: {path}")
    return {"json_files": sum(1 for d in (bp, rp) for _ in d.rglob("*.json")), "species": len(SPECIES) + len(MUTANTS)}


if __name__ == "__main__":
    print("Pack checks passed:", validate())
