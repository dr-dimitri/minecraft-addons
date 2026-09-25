"""Reproducible .mcaddon and standalone source ZIP, no third-party packages."""
from io import BytesIO
from pathlib import Path
import hashlib
import zipfile
from generate import ROOT, VERSION, generate
from validate import validate
from preview import create_preview


# Package only project inputs and generated assets, including in a git-free
# source checkout. Local credentials, logs and virtual environments are not inputs.
SOURCE_PATTERNS = (
    "AGENTS.md", "CHANGELOG.md", "LICENSE", "NOTICE.md", "README.md", ".gitignore", "package.json",
    "src/*.js", "scripts/*.py", "tests/*.py", "tests/*.test.js",
    "docs/**/*.md", "docs/**/*.svg",
    ".agents/skills/*/SKILL.md", ".agents/skills/*/agents/*.yaml",
    ".github/*.md", ".github/workflows/*.yml", ".github/workflows/*.yaml",
    "behavior_pack/**/*.json", "behavior_pack/scripts/*.js", "behavior_pack/*.png",
    "resource_pack/**/*.json", "resource_pack/**/*.png", "resource_pack/texts/*.lang",
)


def source_files(root=ROOT):
    root = Path(root).resolve()
    paths = {path for pattern in SOURCE_PATTERNS for path in root.glob(pattern)
             if path.is_file() or path.is_symlink()}
    for path in sorted(paths):
        relative = path.relative_to(root)
        # Never dereference a symlink into a private directory, even if the name
        # matches a project pattern. Recursive globs do not follow nested directory links.
        if any(parent.is_symlink() for parent in (path, *path.parents) if parent != root and root in parent.parents):
            raise ValueError(f"Source archive cannot include symlinks: {relative}")
        if any(part.startswith(".") for part in relative.parts[1:]):
            continue
        yield "lumen-silent-birds/" + relative.as_posix(), path.read_bytes()


def archive(files):
    output = BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
        for name, data in sorted(files):
            entry = zipfile.ZipInfo(name, (2026, 9, 25, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            package.writestr(entry, data, compresslevel=9)
    with zipfile.ZipFile(BytesIO(output.getvalue())) as package:
        if package.testzip() is not None:
            raise ValueError("Corrupt ZIP")
    return output.getvalue()


def build():
    generate()
    create_preview()
    print(validate())
    version = ".".join(map(str, VERSION))
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    packs = []
    for kind, label in (("resource_pack", "RP"), ("behavior_pack", "BP")):
        directory = ROOT / kind
        packs.append((f"Lumen-Silent-Birds-{label}.mcpack", archive([
            (p.relative_to(directory).as_posix(), p.read_bytes()) for p in directory.rglob("*") if p.is_file()
        ])))
    addon = dist / f"Lumen-Silent-Birds-{version}.mcaddon"
    addon.write_bytes(archive(packs))
    source = dist / f"Lumen-Silent-Birds-Source-{version}.zip"
    source.write_bytes(archive(source_files()))
    lines = []
    for path in (addon, source):
        lines.append(hashlib.sha256(path.read_bytes()).hexdigest() + "  " + path.name)
        print(f"Built {path.name}: {path.stat().st_size:,} bytes")
    (dist / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
