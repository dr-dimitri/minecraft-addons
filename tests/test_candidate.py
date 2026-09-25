"""Reject corrupt, stale or incomplete distributions before CI uploads them."""
import hashlib
from io import BytesIO
from pathlib import Path
import sys
import tempfile
import unittest
import warnings
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build import archive
from check_candidate import artifact_names, archive_contents, verify_addon, verify_archive, verified_hashes


class CandidateTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.names = artifact_names("0.1.1")
        self.manifest = []
        for name in self.names:
            data = archive([("file.txt", b"fixture")])
            (self.root / name).write_bytes(data)
            self.manifest.append(hashlib.sha256(data).hexdigest() + "  " + name)
        self.checksums(self.manifest)

    def checksums(self, lines):
        (self.root / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

    def test_complete_manifest_passes_but_tampered_archive_fails(self):
        self.assertEqual(set(verified_hashes(self.root, "0.1.1")), set(self.names))
        (self.root / self.names[0]).write_bytes(b"damaged download")
        with self.assertRaisesRegex(ValueError, "Checksum mismatch"):
            verified_hashes(self.root, "0.1.1")

    def test_incomplete_duplicate_unknown_and_malformed_checksums_fail(self):
        cases = [self.manifest[:1], self.manifest + self.manifest[:1],
                 self.manifest + ["0" * 64 + "  private.zip"], ["invalid checksum"]]
        for lines in cases:
            with self.subTest(lines=lines):
                self.checksums(lines)
                with self.assertRaises(ValueError):
                    verified_hashes(self.root, "0.1.1")

    def test_old_artifact_cannot_be_mixed_into_upload_directory(self):
        (self.root / "Lumen-Silent-Birds-0.1.0.mcaddon").write_bytes(b"old")
        with self.assertRaisesRegex(ValueError, "Unexpected or missing"):
            verified_hashes(self.root, "0.1.1")

    def test_missing_extra_and_stale_source_members_fail(self):
        expected = {"lumen-silent-birds/LICENSE": b"license",
                    "lumen-silent-birds/scripts/build.py": b"build"}
        self.assertEqual(verify_archive(archive(expected.items()), expected, "source"), expected)
        cases = [{"lumen-silent-birds/LICENSE": b"license"},
                 dict(expected, **{"lumen-silent-birds/.env": b"private"}),
                 dict(expected, **{"lumen-silent-birds/LICENSE": b"stale"})]
        for files in cases:
            with self.subTest(files=list(files)):
                with self.assertRaises(ValueError):
                    verify_archive(archive(files.items()), expected, "source")

    def test_duplicate_and_symlink_archive_members_fail(self):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            duplicate = archive([("same", b"one"), ("same", b"two")])
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            archive_contents(duplicate)
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, "w") as package:
            entry = zipfile.ZipInfo("link")
            entry.external_attr = 0o120777 << 16
            package.writestr(entry, "outside")
        with self.assertRaisesRegex(ValueError, "Symbolic link"):
            archive_contents(buffer.getvalue())

    def test_nested_pack_content_must_match_checked_sources(self):
        packs = []
        for folder, label in (("behavior_pack", "BP"), ("resource_pack", "RP")):
            (self.root / folder).mkdir()
            (self.root / folder / "manifest.json").write_bytes(b'{"version":[0,1,1]}')
            packs.append((f"Lumen-Silent-Birds-{label}.mcpack",
                          archive([("manifest.json", b'{"version":[0,1,1]}')])))
        addon = self.root / self.names[0]
        addon.write_bytes(archive(packs))
        verify_addon(addon, self.root)
        packs[0] = (packs[0][0], archive([("manifest.json", b'{"version":[0,1,0]}')]))
        addon.write_bytes(archive(packs))
        with self.assertRaisesRegex(ValueError, "archived contents differ"):
            verify_addon(addon, self.root)


if __name__ == "__main__":
    unittest.main()
