"""Build inputs for a new, unplayed Bedrock ocean world, using only stdlib.

This writes new metadata and an empty LevelDB, never copies somebody else's
world. Minecraft must generate the chunks and execute the opt-in adventure
initializer on first play. Binary/archive checks do not verify engine import.

Format references (inspected 2026-09-26):
https://learn.microsoft.com/minecraft/creator/documents/createaworldtemplate
https://github.com/microsoft/minecraft-samples/blob/main/jigsaws/basic_dungeon/packs/structures_world/level.dat
https://github.com/Mojang/leveldb/blob/master/db/db_impl.cc
https://github.com/Mojang/leveldb/blob/master/db/version_edit.cc
https://github.com/Mojang/leveldb/blob/master/db/log_writer.cc
"""
from pathlib import Path
import copy
import json
import re
import struct


WORLD_NAME = "Lumen · Tiefsee-Abenteuer"
WORLD_BP_UUID = "2a05e0c5-e4ec-49f0-896f-556ae4d6e59f"
WORLD_DATA_UUID = "5c38e820-c7b2-446c-98de-b9a1b7401d53"
WORLD_SCRIPT_UUID = "f6f6b75c-6cb8-442c-a17b-2cb9850ebca9"
MIN_ENGINE_VERSION = [1, 21, 110]
WORLD_VERSION = [1, 21, 110, 0, 0]
BP_DIRECTORY = "behavior_packs/lumen_bp"
RP_DIRECTORY = "resource_packs/lumen_rp"
SETTINGS_PATH = "scripts/world_settings.js"
ADVENTURE_SETTINGS = (
    "// Enabled only in the separately packaged Lumen adventure world.\n"
    "export const ADVENTURE_WORLD = true;\n"
).encode("utf-8")

# Post-1.18 flat worlds begin at Y=-64. Bedrock is at -64, deepslate at
# -63..-39, gravel at -38, and exactly 100 water blocks at -37..62.
FLAT_LAYERS = (
    ("minecraft:bedrock", 1),
    ("minecraft:deepslate", 25),
    ("minecraft:gravel", 1),
    ("minecraft:water", 100),
)


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def flat_world_settings():
    return {
        "biome_id": 24,  # Vanilla deep_ocean; custom IDs are not numeric IDs.
        "block_layers": [{"block_name": name, "count": count} for name, count in FLAT_LAYERS],
        "encoding_version": 6,
        "structure_options": None,
        "world_version": "version.post_1_18",
    }


def _string(value):
    encoded = value.encode("utf-8")
    return struct.pack("<H", len(encoded)) + encoded


def _payload(tag, value):
    if tag in (1, 3, 4, 5):
        return struct.pack({1: "<b", 3: "<i", 4: "<q", 5: "<f"}[tag], value)
    if tag == 8:
        return _string(value)
    if tag == 9:
        child, items = value
        return bytes([child]) + struct.pack("<i", len(items)) + b"".join(_payload(child, item) for item in items)
    if tag == 10:
        return b"".join(bytes([child]) + _string(name) + _payload(child, item)
                        for name, (child, item) in sorted(value.items())) + b"\0"
    raise ValueError(f"Unsupported world NBT tag: {tag}")


def level_dat():
    """Return a new little-endian Bedrock level.dat, with no player identity."""
    data = {
        "BiomeOverride": (8, ""),
        "Difficulty": (3, 1),
        "FlatWorldLayers": (8, json.dumps(flat_world_settings(), separators=(",", ":"))),
        "ForceGameType": (1, 0),
        "GameType": (3, 0),
        "Generator": (3, 2),
        "HasUncompleteWorldFileOnDisk": (1, 0),
        "InventoryVersion": (8, "1.21.110"),
        "IsHardcore": (1, 0),
        "LANBroadcast": (1, 0),
        "LANBroadcastIntent": (1, 0),
        "LastPlayed": (4, 0),
        "LevelName": (8, WORLD_NAME),
        "LimitedWorldOriginX": (3, 0),
        "LimitedWorldOriginY": (3, 32767),
        "LimitedWorldOriginZ": (3, 0),
        "MinimumCompatibleClientVersion": (9, (3, WORLD_VERSION)),
        "MultiplayerGame": (1, 1),
        "MultiplayerGameIntent": (1, 1),
        "NetherScale": (3, 8),
        "Platform": (3, 2),
        "PlatformBroadcastIntent": (3, 0),
        "RandomSeed": (4, 20260926),
        "SpawnX": (3, 0),
        "SpawnY": (3, 65),
        "SpawnZ": (3, 0),
        "StorageVersion": (3, 10),
        "Time": (4, 6000),
        "WorldVersion": (3, 1),
        "XBLBroadcastIntent": (3, 0),
        "baseGameVersion": (8, "*"),
        "bonusChestEnabled": (1, 0),
        "bonusChestSpawned": (1, 0),
        "cheatsEnabled": (1, 0),
        "commandblocksenabled": (1, 0),
        "commandsEnabled": (1, 0),
        "currentTick": (4, 0),
        "dodaylightcycle": (1, 1),
        "doentitydrops": (1, 1),
        "dofiretick": (1, 1),
        "domobloot": (1, 1),
        "domobspawning": (1, 1),
        "dotiledrops": (1, 1),
        "doweathercycle": (1, 1),
        "drowningdamage": (1, 1),
        "eduOffer": (3, 0),
        "educationFeaturesEnabled": (1, 0),
        "experiments": (10, {"experiments_ever_used": (1, 0), "saved_with_toggled_experiments": (1, 0)}),
        "falldamage": (1, 1),
        "firedamage": (1, 1),
        "hasBeenLoadedInCreative": (1, 0),
        "hasLockedBehaviorPack": (1, 0),
        "hasLockedResourcePack": (1, 0),
        "immutableWorld": (1, 0),
        "isFromLockedTemplate": (1, 0),
        "isFromWorldTemplate": (1, 0),
        "isWorldTemplateOptionLocked": (1, 0),
        "keepinventory": (1, 0),
        "lastOpenedWithVersion": (9, (3, WORLD_VERSION)),
        "lightningLevel": (5, 0.0),
        "lightningTime": (3, 100000),
        "naturalregeneration": (1, 1),
        "playerPermissionsLevel": (3, 1),
        "rainLevel": (5, 0.0),
        "rainTime": (3, 100000),
        "randomtickspeed": (3, 1),
        "serverChunkTickRange": (3, 4),
        "showcoordinates": (1, 1),
        "spawnMobs": (1, 1),
        "spawnradius": (3, 0),
        "texturePacksRequired": (1, 1),
        "worldStartCount": (4, 0),
        "world_policies": (10, {}),
    }
    nbt = b"\x0a\0\0" + _payload(10, data)
    return struct.pack("<II", 10, len(nbt)) + nbt


def read_level_dat(data):
    """Read the NBT subset emitted here; used by package integrity checks."""
    if len(data) < 11:
        raise ValueError("Truncated level.dat")
    version, length = struct.unpack_from("<II", data)
    if version != 10 or length != len(data) - 8:
        raise ValueError("Invalid level.dat header or length")
    offset = 8

    def take(count):
        nonlocal offset
        if count < 0 or offset + count > len(data):
            raise ValueError("Truncated level.dat NBT")
        result = data[offset:offset + count]
        offset += count
        return result

    def number(fmt):
        return struct.unpack(fmt, take(struct.calcsize(fmt)))[0]

    def string():
        return take(number("<H")).decode("utf-8")

    def payload(tag):
        if tag in (1, 3, 4, 5):
            return number({1: "<b", 3: "<i", 4: "<q", 5: "<f"}[tag])
        if tag == 8:
            return string()
        if tag == 9:
            child, count = number("<B"), number("<i")
            if count < 0 or count > len(data):
                raise ValueError("Invalid NBT list length")
            return [payload(child) for _ in range(count)]
        if tag == 10:
            result = {}
            while True:
                child = number("<B")
                if child == 0:
                    return result
                name = string()
                if name in result:
                    raise ValueError("Duplicate NBT name")
                result[name] = payload(child)
        raise ValueError(f"Unsupported world NBT tag: {tag}")

    if number("<B") != 10 or string() != "":
        raise ValueError("Expected unnamed root NBT compound")
    result = payload(10)
    if offset != len(data):
        raise ValueError("Trailing level.dat data")
    return result


def crc32c(data):
    """Castagnoli CRC used by LevelDB, not zlib's different CRC-32."""
    crc = 0xFFFFFFFF
    for byte in data:
        crc ^= byte
        for _ in range(8):
            crc = (crc >> 1) ^ (0x82F63B78 if crc & 1 else 0)
    return crc ^ 0xFFFFFFFF


def empty_database_files():
    """Match Mojang LevelDB DBImpl::NewDB before the first database write."""
    comparator = b"leveldb.BytewiseComparator"
    # VersionEdit: comparator, log number 0, next file number 2, sequence 0.
    record = b"\x01" + bytes([len(comparator)]) + comparator + b"\x02\x00\x03\x02\x04\x00"
    crc = crc32c(b"\x01" + record)  # FULL record type followed by payload.
    masked = (((crc >> 15) | (crc << 17)) + 0xA282EAD8) & 0xFFFFFFFF
    manifest = struct.pack("<IHB", masked, len(record), 1) + record
    return {"db/CURRENT": b"MANIFEST-000001\n", "db/MANIFEST-000001": manifest}


def _pack_files(directory):
    directory = Path(directory)
    if directory.is_symlink():
        raise ValueError(f"World archive cannot include symlinks: {directory.name}")
    files = {}
    for path in sorted(directory.rglob("*")):
        relative = path.relative_to(directory)
        if path.is_symlink():
            raise ValueError(f"World archive cannot include symlinks: {relative}")
        if any(part.startswith(".") for part in relative.parts):
            continue
        if path.is_file():
            if path.suffix not in {".json", ".js", ".lang", ".png", ".tga"}:
                raise ValueError(f"Unexpected world pack input: {relative}")
            files[relative.as_posix()] = path.read_bytes()
    return files


def world_files(root):
    """Return .mcworld entries for build.archive(files.items()).

    The normal add-on must ship world_settings.js with ADVENTURE_WORLD=false.
    Only this embedded, separately identified behavior pack enables the village
    and other adventure initialization. Input packs are never modified.
    """
    root = Path(root)
    behavior = _pack_files(root / "behavior_pack")
    resources = _pack_files(root / "resource_pack")
    settings = behavior.get(SETTINGS_PATH, b"").decode("utf-8")
    if not re.search(r"export\s+const\s+ADVENTURE_WORLD\s*=\s*false\s*;", settings):
        raise ValueError("Normal add-on must explicitly disable ADVENTURE_WORLD in world_settings.js")
    manifest = copy.deepcopy(json.loads(behavior["manifest.json"]))
    manifest["header"]["uuid"] = WORLD_BP_UUID
    manifest["header"]["name"] = WORLD_NAME
    manifest["header"]["description"] = "Tiefsee-Abenteuer mit vier schwimmenden Dörfern und begehbarem Monsterbauch."
    module_ids = {"data": WORLD_DATA_UUID, "script": WORLD_SCRIPT_UUID}
    for module in manifest["modules"]:
        if module["type"] not in module_ids:
            raise ValueError(f"Unexpected adventure behavior module: {module['type']}")
        module["uuid"] = module_ids[module["type"]]
    behavior["manifest.json"] = json_bytes(manifest)
    behavior[SETTINGS_PATH] = ADVENTURE_SETTINGS
    resource_manifest = json.loads(resources["manifest.json"])
    result = {
        "level.dat": level_dat(),
        "levelname.txt": (WORLD_NAME + "\n").encode("utf-8"),
        "world_behavior_packs.json": json_bytes([{
            "pack_id": WORLD_BP_UUID, "version": manifest["header"]["version"],
        }]),
        "world_resource_packs.json": json_bytes([{
            "pack_id": resource_manifest["header"]["uuid"],
            "version": resource_manifest["header"]["version"],
        }]),
        **empty_database_files(),
    }
    result.update((f"{BP_DIRECTORY}/{name}", data) for name, data in behavior.items())
    result.update((f"{RP_DIRECTORY}/{name}", data) for name, data in resources.items())
    validate_world_files(result)
    return result


def validate_world_files(files):
    """Validate packaging and deterministic initial state, not Bedrock import."""
    required = {"level.dat", "levelname.txt", "db/CURRENT", "db/MANIFEST-000001",
                "world_behavior_packs.json", "world_resource_packs.json",
                f"{BP_DIRECTORY}/manifest.json", f"{RP_DIRECTORY}/manifest.json",
                f"{BP_DIRECTORY}/{SETTINGS_PATH}"}
    if not required.issubset(files):
        raise ValueError("Missing adventure world files: " + ", ".join(sorted(required - files.keys())))
    for name in files:
        if name.startswith("/") or "\\" in name or any(part in {"", ".", ".."} for part in name.split("/")):
            raise ValueError(f"Unsafe adventure archive path: {name}")
    level = read_level_dat(files["level.dat"])
    if level["Generator"] != 2 or json.loads(level["FlatWorldLayers"]) != flat_world_settings():
        raise ValueError("World must use the 100-block post-1.18 ocean layers")
    if (level["SpawnX"], level["SpawnY"], level["SpawnZ"], level["spawnradius"]) != (0, 65, 0, 0):
        raise ValueError("Adventure spawn must be directly above the village origin")
    if level["MinimumCompatibleClientVersion"] != WORLD_VERSION or any(level["experiments"].values()):
        raise ValueError("Unexpected world compatibility or experiment settings")
    if any(files.get(name) != data for name, data in empty_database_files().items()):
        raise ValueError("Invalid or nonempty initial LevelDB manifest")
    if {name for name in files if name.startswith("db/")} != {"db/CURRENT", "db/MANIFEST-000001"}:
        raise ValueError("World archive must not contain preexisting chunk or player data")
    manifests = [json.loads(files[f"{folder}/manifest.json"]) for folder in (BP_DIRECTORY, RP_DIRECTORY)]
    bp, rp = manifests
    if bp["header"]["uuid"] != WORLD_BP_UUID or files[f"{BP_DIRECTORY}/{SETTINGS_PATH}"] != ADVENTURE_SETTINGS:
        raise ValueError("Adventure behavior pack identity or opt-in is missing")
    if {module["uuid"] for module in bp["modules"]} != {WORLD_DATA_UUID, WORLD_SCRIPT_UUID}:
        raise ValueError("Adventure module UUIDs are not isolated")
    for manifest, kind in zip(manifests, ("behavior", "resource")):
        header = manifest["header"]
        if json.loads(files[f"world_{kind}_packs.json"]) != [{"pack_id": header["uuid"], "version": header["version"]}]:
            raise ValueError("World pack activation does not match the embedded manifest")
        if header["min_engine_version"] != MIN_ENGINE_VERSION:
            raise ValueError("Unexpected adventure pack minimum engine version")
    if not any(item.get("uuid") == rp["header"]["uuid"] and item.get("version") == rp["header"]["version"]
               for item in bp["dependencies"]):
        raise ValueError("Adventure behavior pack does not depend on its resource pack")
    return "Adventure metadata, 100 water layers, empty LevelDB and embedded packs verified; engine import untested."
