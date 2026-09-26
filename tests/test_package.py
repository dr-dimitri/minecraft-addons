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
from build import archive, source_files


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
        self.assertEqual(validate(self.root), {"json_files": 77, "species": 13})

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

    def test_fish_have_independent_swim_animation_references(self):
        self.edit_json("resource_pack/entity/carp.entity.json", lambda data:
                       data["minecraft:client_entity"]["description"]["animations"].update(
                           swim="animation.lumen_birds.trout.swim"))
        with self.assertRaisesRegex(ValueError, "Fish swim animation wiring"):
            validate(self.root)

    def test_missing_fish_swim_animation_is_rejected(self):
        self.edit_json("resource_pack/animations/birds.animation.json", lambda data:
                       data["animations"].pop("animation.lumen_birds.trout.swim"))
        with self.assertRaisesRegex(ValueError, "Missing animation reference"):
            validate(self.root)

    def test_fish_animation_cannot_reference_missing_bones(self):
        self.edit_json("resource_pack/animations/birds.animation.json", lambda data:
                       data["animations"]["animation.lumen_birds.pike.swim"]["bones"].update(
                           missing_fin={"rotation": [0, 5, 0]}))
        with self.assertRaisesRegex(ValueError, "Animation references missing bone"):
            validate(self.root)

    def test_fish_cannot_use_bird_family_or_perch_state(self):
        path = "behavior_pack/entities/pike.json"
        changes = (("Entity family mismatch", lambda entity:
                    entity["components"]["minecraft:type_family"].update(family=["lumen_birds"])),
                   ("Fish cannot use a perch property", lambda entity:
                    entity["description"].update(properties={"lumen_birds:perched": {
                        "type": "bool", "default": False, "client_sync": True}})))
        for message, change in changes:
            with self.subTest(message=message):
                shutil.copyfile(ROOT / path, self.root / path)
                self.edit_json(path, lambda data: change(data["minecraft:entity"]))
                with self.assertRaisesRegex(ValueError, message):
                    validate(self.root)

    def test_fish_native_cleanup_is_required(self):
        self.edit_json("behavior_pack/entities/pike.json", lambda data:
                       data["minecraft:entity"]["components"]["minecraft:timer"].update(time=600))
        with self.assertRaisesRegex(ValueError, "Native cleanup timer"):
            validate(self.root)

    def test_fish_swimming_cannot_emit_audio(self):
        self.edit_json("resource_pack/animations/birds.animation.json", lambda data:
                       data["animations"]["animation.lumen_birds.carp.swim"].update(
                           sound_effects={"0": {"effect": "swim"}}))
        with self.assertRaisesRegex(ValueError, "Audio/inheritance"):
            validate(self.root)

    def test_fish_cannot_gain_gameplay_ai(self):
        self.edit_json("behavior_pack/entities/trout.json", lambda data:
                       data["minecraft:entity"]["components"].update({
                           "minecraft:behavior.melee_attack": {"priority": 1}}))
        with self.assertRaisesRegex(ValueError, "Gameplay AI/loot"):
            validate(self.root)

    def test_pike_eyes_must_be_yellow_and_emissive(self):
        path = self.root / "resource_pack/textures/entity/lumen_birds/pike.tga"
        original = path.read_bytes()
        for color in ((255, 37, 37), (0, 255, 0), (255, 255, 255)):
            with self.subTest(color=color):
                data = bytearray(original)
                start = 18 + (64 + 57) * 4
                data[start:start + 3] = bytes(reversed(color))
                path.write_bytes(data)
                with self.assertRaisesRegex(ValueError, "Pike eyes must be yellow"):
                    validate(self.root)
        for x, alpha in ((57, 255), (1, 3)):
            with self.subTest(x=x, alpha=alpha):
                data = bytearray(original)
                data[18 + (64 + x) * 4 + 3] = alpha
                path.write_bytes(data)
                with self.assertRaisesRegex(ValueError, "Pike eye alpha mask"):
                    validate(self.root)

    def test_pike_eye_material_must_be_used_by_the_renderer(self):
        self.edit_json("resource_pack/entity/pike.entity.json", lambda data:
                       data["minecraft:client_entity"]["description"].update(
                           render_controllers=["controller.render.lumen_birds"]))
        with self.assertRaisesRegex(ValueError, "Pike render controller wiring"):
            validate(self.root)

    def test_missing_fish_controller_scripts_are_rejected(self):
        for name in ("fish.js", "fish_manager.js", "water.js"):
            with self.subTest(name=name):
                generated = self.root / "behavior_pack/scripts" / name
                original = generated.read_bytes()
                generated.unlink()
                with self.assertRaisesRegex(ValueError, "Missing generated script: " + name):
                    validate(self.root)
                generated.write_bytes(original)

    def test_source_archive_keeps_fish_scripts_and_assets(self):
        contents = dict(source_files(self.root))
        required = {"resource_pack/animations/birds.animation.json"}
        for name in ("fish.js", "fish_manager.js", "water.js"):
            required.update(("src/" + name, "behavior_pack/scripts/" + name))
        for species in ("trout", "carp", "pike"):
            extension = "tga" if species == "pike" else "png"
            required.update((f"behavior_pack/entities/{species}.json",
                             f"resource_pack/entity/{species}.entity.json",
                             f"resource_pack/models/entity/{species}.geo.json",
                             f"resource_pack/textures/entity/lumen_birds/{species}.{extension}"))
        for relative in required:
            with self.subTest(relative=relative):
                self.assertEqual(contents["lumen-silent-birds/" + relative],
                                 (self.root / relative).read_bytes())

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
