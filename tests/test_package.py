from io import BytesIO
from pathlib import Path
import json
import shutil
import sys
import tempfile
import unittest
import zipfile

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
        self.assertEqual(validate(self.root), {"json_files": 21, "species": 5})

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
