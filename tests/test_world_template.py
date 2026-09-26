"""Verify the portable world container without claiming Minecraft executed it."""
import copy
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import world_template as world


class WorldMetadataTests(unittest.TestCase):
    def test_post_caves_cliffs_layers_have_exact_depth_and_spawn_clearance(self):
        data = world.read_level_dat(world.level_dat())
        settings = json.loads(data["FlatWorldLayers"])
        self.assertEqual(data["Generator"], 2)
        self.assertEqual(settings["world_version"], "version.post_1_18")
        self.assertEqual(settings["biome_id"], 24)
        heights = []
        current = -64
        for layer in settings["block_layers"]:
            heights.append((layer["block_name"], current, current + layer["count"] - 1))
            current += layer["count"]
        self.assertEqual(heights[-2:], [("minecraft:gravel", -38, -38), ("minecraft:water", -37, 62)])
        self.assertEqual(data["SpawnY"], 65)
        self.assertEqual(data["spawnradius"], 0)
        self.assertEqual(data["experiments"], {"experiments_ever_used": 0, "saved_with_toggled_experiments": 0})
        self.assertNotIn("~local_player", data)
        self.assertNotIn("Player", data)

    def test_level_dat_is_little_endian_nbt_with_exact_payload_length(self):
        encoded = world.level_dat()
        storage, size = struct.unpack("<II", encoded[:8])
        self.assertEqual(storage, 10)
        self.assertEqual(size, len(encoded) - 8)
        self.assertEqual(encoded[8:11], b"\x0a\0\0")
        self.assertEqual(encoded[-1], 0)
        self.assertIn(b"\x03\t\x00Generator\x02\x00\x00\x00", encoded)
        self.assertEqual(world.read_level_dat(encoded)["LevelName"], world.WORLD_NAME)
        with self.assertRaises(ValueError):
            world.read_level_dat(encoded[:-1])
        with self.assertRaises(ValueError):
            world.read_level_dat(encoded + b"\0")

    def test_empty_database_has_a_valid_leveldb_record_and_no_chunks(self):
        self.assertEqual(world.crc32c(b"123456789"), 0xE3069283)
        files = world.empty_database_files()
        self.assertEqual(set(files), {"db/CURRENT", "db/MANIFEST-000001"})
        name = files["db/CURRENT"].decode("ascii").rstrip("\n")
        record = files["db/" + name]
        masked, size, record_type = struct.unpack("<IHB", record[:7])
        self.assertEqual(record_type, 1)  # Full record, no fragments.
        self.assertEqual(size, len(record) - 7)
        rotated = (masked - 0xA282EAD8) & 0xFFFFFFFF
        checksum = ((rotated >> 17) | (rotated << 15)) & 0xFFFFFFFF
        self.assertEqual(checksum, world.crc32c(bytes([record_type]) + record[7:]))
        payload = record[7:]
        self.assertEqual(payload[0], 1)  # Comparator field.
        count = payload[1]
        self.assertEqual(payload[2:2 + count], b"leveldb.BytewiseComparator")
        # Empty database: log 0, next available file 2, sequence 0.
        self.assertEqual(payload[2 + count:], bytes([2, 0, 3, 2, 4, 0]))


class WorldArchiveTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.bp = {
            "format_version": 2,
            "header": {"uuid": "original-bp", "name": "Lumen", "version": [0, 1, 1],
                       "min_engine_version": [1, 21, 110]},
            "modules": [{"type": "data", "uuid": "original-data", "version": [0, 1, 1]},
                        {"type": "script", "uuid": "original-script", "version": [0, 1, 1],
                         "entry": "scripts/main.js", "language": "javascript"}],
            "dependencies": [{"uuid": "original-rp", "version": [0, 1, 1]},
                             {"module_name": "@minecraft/server", "version": "2.0.0"}],
        }
        self.rp = {
            "format_version": 2,
            "header": {"uuid": "original-rp", "name": "Lumen Resources", "version": [0, 1, 1],
                       "min_engine_version": [1, 21, 110]},
            "modules": [{"type": "resources", "uuid": "original-resources", "version": [0, 1, 1]}],
        }
        self.write("behavior_pack/manifest.json", world.json_bytes(self.bp))
        self.write("resource_pack/manifest.json", world.json_bytes(self.rp))
        self.write("behavior_pack/scripts/main.js", b"// Existing project entry point\n")
        self.write("behavior_pack/scripts/world_settings.js", b"export const ADVENTURE_WORLD = false;\n")
        self.write("resource_pack/textures/example.tga", b"example texture bytes")

    def write(self, relative, data):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path

    def test_world_is_reproducible_and_isolates_only_behavior_identity_and_flag(self):
        before = {p.relative_to(self.root).as_posix(): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        files = world.world_files(self.root)
        self.assertEqual(files, world.world_files(self.root))
        after = {p.relative_to(self.root).as_posix(): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        self.assertEqual(before, after)
        self.assertIn("engine import untested", world.validate_world_files(files))
        bp = json.loads(files[f"{world.BP_DIRECTORY}/manifest.json"])
        self.assertNotEqual(bp["header"]["uuid"], self.bp["header"]["uuid"])
        self.assertTrue({m["uuid"] for m in bp["modules"]}.isdisjoint({m["uuid"] for m in self.bp["modules"]}))
        self.assertEqual(bp["dependencies"], self.bp["dependencies"])
        self.assertEqual(files[f"{world.RP_DIRECTORY}/manifest.json"], before["resource_pack/manifest.json"])
        self.assertEqual(files[f"{world.BP_DIRECTORY}/scripts/main.js"], before["behavior_pack/scripts/main.js"])
        self.assertIn(b"ADVENTURE_WORLD = true", files[f"{world.BP_DIRECTORY}/scripts/world_settings.js"])
        self.assertNotIn("manifest.json", files)  # .mcworld, not a template pack.

    def test_validator_rejects_mismatched_activation_and_unrelated_database(self):
        valid = world.world_files(self.root)
        files = copy.copy(valid)
        files["world_behavior_packs.json"] = world.json_bytes([{"pack_id": "original-bp", "version": [0, 1, 1]}])
        with self.assertRaisesRegex(ValueError, "activation"):
            world.validate_world_files(files)
        files = copy.copy(valid)
        files["db/000005.ldb"] = b"saved chunks"
        with self.assertRaisesRegex(ValueError, "preexisting"):
            world.validate_world_files(files)
        files = copy.copy(valid)
        files["db/MANIFEST-000001"] = files["db/MANIFEST-000001"][:-1]
        with self.assertRaisesRegex(ValueError, "LevelDB"):
            world.validate_world_files(files)

    def test_normal_addon_must_have_explicitly_disabled_adventure_generation(self):
        self.write("behavior_pack/scripts/world_settings.js", b"export const ADVENTURE_WORLD = true;\n")
        with self.assertRaisesRegex(ValueError, "explicitly disable"):
            world.world_files(self.root)

    def test_world_packs_do_not_capture_private_files_or_symlinks(self):
        self.write("resource_pack/.DS_Store", b"local finder information")
        self.assertNotIn(f"{world.RP_DIRECTORY}/.DS_Store", world.world_files(self.root))
        secret = self.write("private.json", b'{"private":true}')
        (self.root / "resource_pack/private.json").symlink_to(secret)
        with self.assertRaisesRegex(ValueError, "symlinks"):
            world.world_files(self.root)

    def test_unexpected_pack_files_require_explicit_packaging_support(self):
        self.write("resource_pack/session.log", b"local session log")
        with self.assertRaisesRegex(ValueError, "Unexpected world pack input"):
            world.world_files(self.root)


if __name__ == "__main__":
    unittest.main()
