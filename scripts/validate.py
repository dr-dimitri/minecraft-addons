"""Check pack wiring and silence invariants. Not a replacement for Bedrock."""
from pathlib import Path
import json
import re
import struct
import uuid
import zlib
from generate import ROOT, SPECIES, VERSION, ENGINE, RP_UUID, BP_UUID


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
        if tag == b"IDAT":
            compressed += payload
        if tag == b"IEND":
            ended = True
        at += 12 + length
    require(ended and at == len(data), f"PNG structure: {path}")
    require(len(zlib.decompress(compressed)) == dimensions[1] * (1 + dimensions[0] * 3), f"PNG pixels: {path}")


def validate(root=ROOT):
    bp, rp = root / "behavior_pack", root / "resource_pack"
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
        require(source.read_bytes() == (bp / "scripts" / source.name).read_bytes(), f"Stale script: {source.name}")
    scripts = "\n".join(p.read_text() for p in (bp / "scripts").glob("*.js"))
    require(not re.search(r"\b(playSound|runCommand|playMusic|stopMusic|setBlock|setType)\b", scripts), "Unexpected world/audio mutation")
    for path in (bp / "scripts").glob("*.js"):
        for target in re.findall(r"from\s+['\"]([^'\"]+)", path.read_text()):
            if target.startswith("."):
                require((path.parent / target).is_file(), f"Missing JS import: {target}")
            else:
                require(target == "@minecraft/server", f"Unexpected module: {target}")
    animations = load(rp / "animations" / "birds.animation.json")["animations"]
    controllers = load(rp / "render_controllers" / "birds.render_controllers.json")["render_controllers"]
    require(len(list((bp / "entities").glob("*.json"))) == len(SPECIES), "Unexpected server entities")
    require(len(list((rp / "entity").glob("*.json"))) == len(SPECIES), "Unexpected client entities")
    for species in SPECIES:
        identifier = "lumen_birds:" + species
        server = load(bp / "entities" / (species + ".json"))["minecraft:entity"]
        client = load(rp / "entity" / (species + ".entity.json"))["minecraft:client_entity"]["description"]
        require(server["description"]["identifier"] == client["identifier"] == identifier, "Entity ID mismatch")
        require(server["description"].get("is_summonable") is True, "Script spawns require summonability")
        require(server["description"].get("is_spawnable") is False, "Unexpected spawn egg")
        comp = server["components"]
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
        require(client["materials"] == {"default": "entity_alphatest"}, "Unexpected material")
        check_png(rp / (client["textures"]["default"] + ".png"), (64, 16))
        for alias in client["scripts"]["animate"]:
            animation = animations[client["animations"][alias]]
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
    return {"json_files": sum(1 for d in (bp, rp) for _ in d.rglob("*.json")), "species": len(SPECIES)}


if __name__ == "__main__":
    print("Pack checks passed:", validate())
