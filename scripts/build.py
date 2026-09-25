"""Reproducible .mcaddon and standalone source ZIP, no third-party packages."""
from io import BytesIO
from pathlib import Path
import hashlib
import zipfile
from generate import ROOT, VERSION, generate
from validate import validate
from preview import create_preview


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
    source.write_bytes(archive([
        ("lumen-silent-birds/" + p.relative_to(ROOT).as_posix(), p.read_bytes())
        for p in ROOT.rglob("*") if p.is_file()
        and not any(part in ("dist", "__pycache__", ".git", "node_modules", ".DS_Store") for part in p.relative_to(ROOT).parts)
        and p.suffix != ".pyc"
    ]))
    lines = []
    for path in (addon, source):
        lines.append(hashlib.sha256(path.read_bytes()).hexdigest() + "  " + path.name)
        print(f"Built {path.name}: {path.stat().st_size:,} bytes")
    (dist / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
