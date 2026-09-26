"""Check complete, reproducible distributions and rebuild their source without Git."""
import argparse
import hashlib
from io import BytesIO
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile

from build import source_files
from check_release import check_release, require
from generate import ROOT
from world_template import world_files, validate_world_files


def artifact_names(version):
    return (f"Lumen-Silent-Birds-{version}.mcaddon",
            f"Lumen-Silent-Birds-Source-{version}.zip",
            f"Lumen-Tiefsee-Abenteuer-{version}.mcworld")


def verified_hashes(directory, version):
    expected = set(artifact_names(version))
    require({p.name for p in directory.iterdir()} == expected | {"SHA256SUMS.txt"},
            "Unexpected or missing distribution files; use a clean build directory")
    hashes = {}
    for line in (directory / "SHA256SUMS.txt").read_text(encoding="utf-8").splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
        require(match is not None, "Invalid checksum line")
        digest, name = match.groups()
        require(name in expected and name not in hashes, "Unknown or duplicate checksum entry")
        require(hashlib.sha256((directory / name).read_bytes()).hexdigest() == digest,
                f"Checksum mismatch: {name}")
        hashes[name] = digest
    require(set(hashes) == expected, "Incomplete checksum manifest")
    return hashes


def archive_contents(data):
    with zipfile.ZipFile(BytesIO(data)) as archive:
        names = archive.namelist()
        require(len(names) == len(set(names)), "Duplicate archive member")
        require(not any(stat.S_ISLNK(info.external_attr >> 16) for info in archive.infolist()),
                "Symbolic link in archive")
        require(archive.testzip() is None, "Archive CRC failure")
        return {name: archive.read(name) for name in names}


def verify_archive(data, expected, label):
    actual = archive_contents(data)
    missing = sorted(set(expected) - set(actual))
    extra = sorted(set(actual) - set(expected))
    require(not missing and not extra, f"{label}: missing={missing}, unexpected={extra}")
    require(actual == expected, f"{label}: archived contents differ from checked sources")
    return actual


def verify_addon(path, root):
    addon = archive_contents(path.read_bytes())
    require(set(addon) == {"Lumen-Silent-Birds-BP.mcpack", "Lumen-Silent-Birds-RP.mcpack"},
            "Add-on must contain exactly its behavior and resource packs")
    for kind, label in (("behavior_pack", "BP"), ("resource_pack", "RP")):
        folder = root / kind
        files = {p.relative_to(folder).as_posix(): p.read_bytes()
                 for p in folder.rglob("*") if p.is_file()}
        require("manifest.json" in files, f"{kind}: missing root manifest")
        verify_archive(addon[f"Lumen-Silent-Birds-{label}.mcpack"], files, kind)


def verify_world(path, root):
    files = verify_archive(path.read_bytes(), world_files(root), "Adventure world")
    validate_world_files(files)


def source_snapshot(root):
    files = dict(source_files(root))
    prefix = "lumen-silent-birds/"
    required = {"LICENSE", "AGENTS.md", "README.md", "package.json",
                "docs/RELEASING.md", "docs/releases/TEMPLATE.md",
                "scripts/build.py", "scripts/check_candidate.py"}
    require({prefix + name for name in required} <= set(files), "Required source files missing")
    if (root / ".git").exists():
        status = subprocess.check_output(
            ["git", "status", "--porcelain", "--untracked-files=all"], cwd=root)
        require(not status.strip(), "Candidate checks require a clean, committed checkout")
        tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
        expected = {prefix + name for name in tracked if name}
        require(set(files) == expected,
                "Source archive paths differ from Git files; review SOURCE_PATTERNS")
    return files


def run(root, *args):
    print("Running: " + " ".join(args), flush=True)
    subprocess.run(args, cwd=root, check=True)


def check_candidate(root=ROOT, tag=None):
    root = Path(root).resolve()
    npm = shutil.which("npm")
    require(npm is not None, "Node.js/npm is required for the standalone source tests")
    version = check_release(root, tag)["birds"]
    sources = source_snapshot(root)
    run(root, sys.executable, "scripts/build.py")
    first = verified_hashes(root / "dist", version)
    run(root, sys.executable, "scripts/build.py")
    require(first == verified_hashes(root / "dist", version), "Full repeat build changed archive hashes")
    require(sources == source_snapshot(root), "Build changed committed/generated sources")
    addon, source, world = artifact_names(version)
    verify_addon(root / "dist" / addon, root)
    verify_world(root / "dist" / world, root)
    contents = verify_archive((root / "dist" / source).read_bytes(), sources, "Source ZIP")
    with tempfile.TemporaryDirectory(prefix="lumen-source-check-") as directory:
        extracted = Path(directory)
        # Members were compared with the exact local source snapshot before any
        # writes. Resolve each destination too, so extraction cannot escape.
        for name, data in contents.items():
            path = (extracted / name).resolve()
            require(path.is_relative_to(extracted.resolve()), "Unsafe source archive path")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        standalone = extracted / "lumen-silent-birds"
        require(not (standalone / ".git").exists(), "Standalone rebuild must not depend on Git")
        for script in ("generate.py", "preview.py", "check_release.py"):
            args = ["--tag", tag] if script == "check_release.py" and tag else []
            run(standalone, sys.executable, "scripts/" + script, *args)
        run(standalone, npm, "test")
        run(standalone, sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v")
        run(standalone, sys.executable, "scripts/build.py")
        require(first == verified_hashes(standalone / "dist", version),
                "Standalone source rebuild changed archive hashes")
    print(f"PASS: Birds {version}; repeat build, checksums, nested packs, adventure world, "
          "source contents and standalone tests/build")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", help="Also check the candidate tag and changelog")
    args = parser.parse_args()
    try:
        check_candidate(tag=args.tag)
    except (ValueError, OSError, KeyError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Candidate check failed: {error}\n")


if __name__ == "__main__":
    main()
