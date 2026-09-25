"""Check the standalone bird add-on version and optional release tag without importing its generator."""
import argparse
import ast
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VERSION_PATTERN = r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def version_triplet(value, label):
    require(isinstance(value, list) and len(value) == 3
            and all(type(part) is int and part >= 0 for part in value),
            f"{label}: expected three non-negative version integers")
    return value


def source_version(path):
    """Read one literal top-level VERSION assignment; never execute source code."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    assignments = []
    for node in tree.body:
        if isinstance(node, ast.Assign):
            if any(isinstance(target, ast.Name) and target.id == "VERSION"
                   for target in node.targets):
                assignments.append(node.value)
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            if node.target.id == "VERSION":
                assignments.append(node.value)
    require(len(assignments) == 1, f"{path}: expected one literal VERSION assignment")
    try:
        value = ast.literal_eval(assignments[0])
    except (ValueError, TypeError) as error:
        raise ValueError(f"{path}: VERSION must be a literal list") from error
    return version_triplet(value, str(path))


def read_manifest(path, expected):
    manifest = json.loads(path.read_text(encoding="utf-8"))
    require(version_triplet(manifest["header"]["version"], str(path)) == expected,
            f"{path}: header version differs from generator VERSION")
    modules = manifest["modules"]
    require(isinstance(modules, list) and modules, f"{path}: missing modules")
    for module in modules:
        require(version_triplet(module["version"], str(path)) == expected,
                f"{path}: module version differs from generator VERSION")
    return manifest


def check_versions(root=ROOT):
    root = Path(root)
    birds_version = source_version(root / "scripts/generate.py")
    birds = {
        kind: read_manifest(root / kind / "manifest.json", birds_version)
        for kind in ("behavior_pack", "resource_pack")
    }
    versions = {
        "birds": ".".join(map(str, birds_version)),
    }
    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    require(package["version"] == versions["birds"],
            "package.json: version differs from generator VERSION")

    identities = {manifest["header"]["uuid"]: manifest for manifest in birds.values()}
    require(len(identities) == len(birds), "Bird pack UUIDs must be different")
    resource_uuid = birds["resource_pack"]["header"]["uuid"]
    for kind, manifest in birds.items():
        dependencies = manifest.get("dependencies", [])
        pack_dependencies = [entry for entry in dependencies if "uuid" in entry]
        require(len({entry["uuid"] for entry in pack_dependencies}) == len(pack_dependencies),
                f"Bird {kind}: duplicate pack dependency")
        if kind == "behavior_pack":
            require(sum(entry["uuid"] == resource_uuid for entry in pack_dependencies) == 1,
                    "Bird behavior pack must depend on its resource pack exactly once")
        for dependency in pack_dependencies:
            identity = dependency["uuid"]
            require(identity in identities and identity != manifest["header"]["uuid"],
                    f"Bird {kind}: unknown or self-referencing pack dependency")
            expected = identities[identity]["header"]["version"]
            require(version_triplet(dependency["version"], f"Bird {kind} dependency") == expected,
                    f"Bird {kind}: pack dependency version mismatch")
    return versions


def check_release(root=ROOT, tag=None):
    root = Path(root)
    versions = check_versions(root)
    if tag is not None:
        match = re.fullmatch(rf"birds-v({VERSION_PATTERN})", tag)
        require(match is not None, "Release tag must be birds-vX.Y.Z (no suffixes or leading zeros)")
        version = match.group(1)
        require(version == versions["birds"],
                f"Release tag version must equal {versions['birds']} for birds")
        changelog = root / "CHANGELOG.md"
        heading = f"## [{version}]"
        require(any(re.fullmatch(re.escape(heading) + r"(?: - .+)?", line)
                    for line in changelog.read_text(encoding="utf-8").splitlines()),
                f"{changelog}: missing release heading {heading} (optional ' - date/status' suffix)")
    return versions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", help="Check birds-vX.Y.Z and its changelog entry")
    args = parser.parse_args()
    try:
        versions = check_release(tag=args.tag)
    except (ValueError, KeyError, TypeError, OSError, SyntaxError) as error:
        parser.exit(1, f"Release check failed: {error}\n")
    print(f"PASS: Birds {versions['birds']}"
          + (f"; tag {args.tag}" if args.tag is not None else ""))


if __name__ == "__main__":
    main()
