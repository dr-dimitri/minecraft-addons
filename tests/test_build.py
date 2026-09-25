"""Exercise source distribution boundaries with realistic local-only files."""
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build import source_files


class SourceArchiveTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)

    def write(self, relative):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("test content", encoding="utf-8")
        return path

    def test_distribution_keeps_build_inputs_and_excludes_local_files(self):
        included = ["LICENSE", ".gitignore", "README.md", "package.json", "src/main.js",
                    "scripts/build.py", "tests/test_build.py", "tests/manager.test.js",
                    "docs/releases/TEMPLATE.md", "docs/PREVIEW.svg",
                    ".agents/skills/birds/SKILL.md", ".agents/skills/birds/agents/openai.yaml",
                    ".github/workflows/build.yml", "behavior_pack/scripts/main.js",
                    "resource_pack/texts/de_DE.lang", "resource_pack/textures/bird.png"]
        excluded = [".env", ".env.local", "credentials.json", "session.log", "notes.txt",
                    ".venv/lib/private.py", "venv/lib/private.py", "node_modules/private.js",
                    "dist/previous.zip", "scripts/__pycache__/build.pyc", "scripts/.private.py",
                    "docs/.private/notes.md", ".github/.env", "resource_pack/.DS_Store"]
        for name in included + excluded:
            self.write(name)
        actual = dict(source_files(self.root))
        self.assertEqual(set(actual), {"lumen-silent-birds/" + name for name in included})

    def test_matching_symlink_cannot_copy_external_contents(self):
        private = self.write("private.txt")
        (self.root / "README.md").symlink_to(private)
        with self.assertRaisesRegex(ValueError, "symlinks"):
            list(source_files(self.root))

    def test_matching_directory_symlink_is_rejected(self):
        self.write("private/main.js")
        (self.root / "src").symlink_to(self.root / "private", target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "symlinks"):
            list(source_files(self.root))

    def test_broken_source_symlink_is_rejected_instead_of_silently_omitted(self):
        (self.root / "README.md").symlink_to(self.root / "missing.md")
        with self.assertRaisesRegex(ValueError, "symlinks"):
            list(source_files(self.root))


if __name__ == "__main__":
    unittest.main()
