from io import BytesIO
from pathlib import Path
import json
import shutil
import struct
import sys
import tempfile
import unittest
import zipfile
import zlib

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from generate import ROOT
from validate import validate
from build import archive


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for name in ("behavior_pack", "resource_pack", "src"):
            shutil.copytree(ROOT / name, self.root / name)

    def tearDown(self):
        self.temp.cleanup()

    def edit_json(self, relative, change):
        path = self.root / relative
        data = json.loads(path.read_text())
        change(data)
        path.write_text(json.dumps(data))

    def test_valid_package(self):
        self.assertEqual(validate(self.root), {"json_files": 28, "species": 7})

    def test_missing_texture_is_rejected(self):
        (self.root / "resource_pack/textures/entity/lumen_birds/eagle.png").unlink()
        with self.assertRaises(FileNotFoundError):
            validate(self.root)

    def test_broken_model_reference_is_rejected(self):
        self.edit_json("resource_pack/entity/eagle.entity.json", lambda data:
                       data["minecraft:client_entity"]["description"]["geometry"].update(default="geometry.missing"))
        with self.assertRaisesRegex(ValueError, "Geometry reference"):
            validate(self.root)

    def test_missing_entry_is_rejected(self):
        (self.root / "behavior_pack/scripts/main.js").unlink()
        with self.assertRaisesRegex(ValueError, "Script entry"):
            validate(self.root)

    def test_disabled_summonability_is_rejected(self):
        self.edit_json("behavior_pack/entities/eagle.json", lambda data:
                       data["minecraft:entity"]["description"].update(is_summonable=False))
        with self.assertRaisesRegex(ValueError, "summonability"):
            validate(self.root)

    def test_missing_native_cleanup_is_rejected(self):
        self.edit_json("behavior_pack/entities/eagle.json", lambda data:
                       data["minecraft:entity"]["components"]["minecraft:timer"].update(looping=True))
        with self.assertRaisesRegex(ValueError, "Native cleanup"):
            validate(self.root)

    def test_audio_event_is_rejected(self):
        self.edit_json("resource_pack/animations/birds.animation.json", lambda data:
                       data["animations"]["animation.lumen_birds.eagle.flight"].update(sound_effects={"0": {"effect": "bird"}}))
        with self.assertRaisesRegex(ValueError, "Audio/inheritance"):
            validate(self.root)

    def test_corrupt_texture_is_rejected(self):
        path = self.root / "resource_pack/textures/entity/lumen_birds/eagle.png"
        data = bytearray(path.read_bytes()); data[50] ^= 1; path.write_bytes(data)
        with self.assertRaisesRegex(ValueError, "PNG CRC"):
            validate(self.root)

    def test_daytime_texture_must_remain_rgb(self):
        path = self.root / "resource_pack/textures/entity/lumen_birds/eagle.png"
        data = bytearray(path.read_bytes())
        data[25] = 6  # RGBA advertised for an RGB texture; update the IHDR CRC.
        data[29:33] = struct.pack(">I", zlib.crc32(data[12:29]))
        path.write_bytes(data)
        with self.assertRaisesRegex(ValueError, "PNG RGB format"):
            validate(self.root)

    def test_missing_or_unsynchronized_perch_property_is_rejected(self):
        path = "behavior_pack/entities/owl.json"
        for change in (lambda properties: properties.clear(),
                       lambda properties: properties["lumen_birds:perched"].update(client_sync=False)):
            with self.subTest(change=change):
                shutil.copyfile(ROOT / path, self.root / path)
                self.edit_json(path, lambda data: change(data["minecraft:entity"]["description"]["properties"]))
                with self.assertRaisesRegex(ValueError, "perch property"):
                    validate(self.root)

    def test_missing_perch_animation_is_rejected(self):
        self.edit_json("resource_pack/animations/birds.animation.json", lambda data:
                       data["animations"].pop("animation.lumen_birds.eagle_owl.perch"))
        with self.assertRaisesRegex(ValueError, "Missing animation reference"):
            validate(self.root)

    def test_disabled_perch_animation_switch_is_rejected(self):
        self.edit_json("resource_pack/entity/owl.entity.json", lambda data:
                       data["minecraft:client_entity"]["description"]["scripts"].update(animate=["flight"]))
        with self.assertRaisesRegex(ValueError, "perch animation switch"):
            validate(self.root)

    def test_missing_takeoff_transition_is_rejected(self):
        self.edit_json("resource_pack/animation_controllers/nocturnal.animation_controllers.json", lambda data:
                       data["animation_controllers"]["controller.animation.lumen_birds.nocturnal"]
                           ["states"]["perch"].update(transitions=[]))
        with self.assertRaisesRegex(ValueError, "Owl pose controller wiring"):
            validate(self.root)

    def test_non_emissive_eyes_are_rejected(self):
        self.edit_json("resource_pack/entity/owl.entity.json", lambda data:
                       data["minecraft:client_entity"]["description"]["materials"].update(eyes="entity_alphatest"))
        with self.assertRaisesRegex(ValueError, "emissive eye material"):
            validate(self.root)

    def test_missing_eye_render_mapping_is_rejected(self):
        self.edit_json("resource_pack/render_controllers/birds.render_controllers.json", lambda data:
                       data["render_controllers"]["controller.render.lumen_birds.nocturnal"].update(
                           materials=[{"*": "Material.default"}]))
        with self.assertRaisesRegex(ValueError, "emissive eye render mapping"):
            validate(self.root)

    def test_missing_eye_geometry_is_rejected(self):
        self.edit_json("resource_pack/models/entity/owl.geo.json", lambda data:
                       data["minecraft:geometry"][0].update(bones=[bone for bone in
                           data["minecraft:geometry"][0]["bones"] if bone["name"] != "eyes"]))
        with self.assertRaisesRegex(ValueError, "Missing owl eye geometry"):
            validate(self.root)

    def test_glow_mask_must_cover_only_the_eyes(self):
        path = self.root / "resource_pack/textures/entity/lumen_birds/owl.tga"
        original = path.read_bytes()
        for x, alpha in ((57, 255), (1, 3)):
            with self.subTest(x=x, alpha=alpha):
                data = bytearray(original)
                data[18 + (64 + x) * 4 + 3] = alpha  # Pixel (x, 1), BGRA.
                path.write_bytes(data)
                with self.assertRaisesRegex(ValueError, "Owl eye alpha mask"):
                    validate(self.root)

    def test_non_red_eyes_are_rejected(self):
        path = self.root / "resource_pack/textures/entity/lumen_birds/eagle_owl.tga"
        data = bytearray(path.read_bytes())
        start = 18 + (64 + 57) * 4
        data[start:start + 3] = bytes((0, 255, 0))
        path.write_bytes(data)
        with self.assertRaisesRegex(ValueError, "Owl eyes must be red"):
            validate(self.root)

    def test_archive_is_reproducible_and_contains_two_independent_packs(self):
        packs = []
        for directory in ("behavior_pack", "resource_pack"):
            folder = self.root / directory
            files = [(p.relative_to(folder).as_posix(), p.read_bytes()) for p in folder.rglob("*") if p.is_file()]
            self.assertEqual(archive(files), archive(list(reversed(files))))
            data = archive(files)
            with zipfile.ZipFile(BytesIO(data)) as package:
                self.assertIn("manifest.json", package.namelist())
                self.assertIsNone(package.testzip())
            packs.append((directory + ".mcpack", data))
        with zipfile.ZipFile(BytesIO(archive(packs))) as addon:
            self.assertEqual(len(addon.namelist()), 2)
            for name in addon.namelist():
                with zipfile.ZipFile(BytesIO(addon.read(name))) as package:
                    self.assertIsNone(package.testzip())


if __name__ == "__main__":
    unittest.main()
