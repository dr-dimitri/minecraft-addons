"""Release metadata failures tested against standalone isolated fixtures."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import check_release


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.write("scripts/generate.py", "raise RuntimeError('must not import')\nVERSION = [0, 2, 0]\n")
        for name, identity in (("behavior_pack", "bird-behavior"), ("resource_pack", "bird-resource")):
            manifest = {"header": {"version": [0, 2, 0], "uuid": identity},
                        "modules": [{"version": [0, 2, 0]}]}
            if name == "behavior_pack":
                manifest["dependencies"] = [
                    {"uuid": "bird-resource", "version": [0, 2, 0]},
                    {"module_name": "@minecraft/server", "version": "2.0.0"},
                ]
            self.write(name + "/manifest.json", json.dumps(manifest))
        self.write("package.json", json.dumps({"version": "0.2.0"}))
        self.write("CHANGELOG.md", "# Changes\n\n## [0.2.0]\n")

    def write(self, relative, content):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def change_json(self, relative, edit):
        path = self.root / relative
        value = json.loads(path.read_text(encoding="utf-8"))
        edit(value)
        self.write(relative, json.dumps(value))

    def test_standalone_version_and_tag_without_importing_generator(self):
        for tag in (None, "birds-v0.2.0"):
            with self.subTest(tag=tag):
                self.assertEqual(check_release.check_release(self.root, tag), {"birds": "0.2.0"})

    def test_branch_check_does_not_require_release_changelog(self):
        (self.root / "CHANGELOG.md").unlink()
        check_release.check_release(self.root)
        with self.assertRaises(FileNotFoundError):
            check_release.check_release(self.root, "birds-v0.2.0")

    def test_nonliteral_ambiguous_and_invalid_source_versions_fail(self):
        for assignment in ("VERSION = list((0, 2, 0))", "VERSION = [0, 2, 0]\nVERSION = [0, 2, 0]",
                           "VERSION = [0, 2]", "VERSION = [0, -1, 0]", "VERSION = [0, True, 0]"):
            with self.subTest(assignment=assignment):
                self.write("scripts/generate.py", assignment)
                with self.assertRaises(ValueError):
                    check_release.check_release(self.root)

    def test_every_manifest_header_and_module_must_match_generator(self):
        for relative in ("behavior_pack/manifest.json", "resource_pack/manifest.json"):
            original = (self.root / relative).read_text(encoding="utf-8")
            for section in ("header", "module"):
                with self.subTest(relative=relative, section=section):
                    def edit(manifest):
                        entry = manifest["header"] if section == "header" else manifest["modules"][0]
                        entry["version"] = [9, 9, 9]
                    self.change_json(relative, edit)
                    with self.assertRaisesRegex(ValueError, "version differs"):
                        check_release.check_release(self.root)
                    self.write(relative, original)

    def test_package_json_version_mismatch_fails(self):
        self.write("package.json", '{"version": "0.3.0"}')
        with self.assertRaisesRegex(ValueError, "package.json"):
            check_release.check_release(self.root)

    def test_missing_unknown_duplicate_and_stale_behavior_dependencies_fail(self):
        relative = "behavior_pack/manifest.json"
        original = (self.root / relative).read_text(encoding="utf-8")
        cases = [[], [{"uuid": "unknown", "version": [0, 2, 0]}],
                 [{"uuid": "bird-resource", "version": [0, 1, 0]}],
                 [{"uuid": "bird-resource", "version": [0, 2, 0]}] * 2]
        for dependencies in cases:
            with self.subTest(dependencies=dependencies):
                self.change_json(relative, lambda manifest: manifest.update(dependencies=dependencies))
                with self.assertRaises(ValueError):
                    check_release.check_release(self.root)
                self.write(relative, original)

    def test_optional_reverse_dependency_must_reference_current_behavior_pack(self):
        relative = "resource_pack/manifest.json"
        self.change_json(relative, lambda manifest: manifest.update(
            dependencies=[{"uuid": "bird-behavior", "version": [0, 2, 0]}]))
        check_release.check_release(self.root)
        for dependencies in ([{"uuid": "bird-behavior", "version": [0, 1, 0]}],
                             [{"uuid": "bird-resource", "version": [0, 2, 0]}],
                             [{"uuid": "unknown", "version": [0, 2, 0]}],
                             [{"uuid": "bird-behavior", "version": [0, 2, 0]}] * 2):
            with self.subTest(dependencies=dependencies):
                self.change_json(relative, lambda manifest: manifest.update(dependencies=dependencies))
                with self.assertRaises(ValueError):
                    check_release.check_release(self.root)

    def test_duplicate_pack_identities_fail(self):
        self.change_json("resource_pack/manifest.json", lambda manifest:
                         manifest["header"].update(uuid="bird-behavior"))
        with self.assertRaisesRegex(ValueError, "UUIDs must be different"):
            check_release.check_release(self.root)

    def test_malformed_mismatched_and_other_product_tags_fail(self):
        for tag in ("birds-v00.2.0", "birds-v0.2", "birds-v0.2.0-rc.1", "birds-v0.2.0+build",
                    "birds-v0.2.0\n", "refs/tags/birds-v0.2.0", "birds-0.2.0", "birds-v1.2.3",
                    "v0.2.0", "xv0.2.0", ""):
            with self.subTest(tag=tag):
                with self.assertRaises(ValueError):
                    check_release.check_release(self.root, tag)

    def test_release_heading_allows_date_or_status_suffix(self):
        for content in ("## [0.2.0] - 2026-09-25\n", "## [0.2.0] - Kandidat\n"):
            with self.subTest(content=content):
                self.write("CHANGELOG.md", content)
                check_release.check_release(self.root, "birds-v0.2.0")

    def test_release_requires_exact_version_heading(self):
        for content in ("## [0.2.00]\n", "## [0.2.0] extra\n", "### [0.2.0]\n"):
            with self.subTest(content=content):
                self.write("CHANGELOG.md", content)
                with self.assertRaisesRegex(ValueError, "missing release heading"):
                    check_release.check_release(self.root, "birds-v0.2.0")


if __name__ == "__main__":
    unittest.main()
