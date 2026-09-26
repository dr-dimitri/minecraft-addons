"""Orthographic SVG inspection of the actual geometry; not an in-game screenshot."""
from html import escape
import math
from generate import ROOT, SPECIES, BIRD_SPECIES, FISH_SPECIES, AQUATIC_SPECIES, NOCTURNAL_SPECIES, PALETTES, NAMES, geometry, perch_animation


def rotate(point, angles, pivot=(0, 0, 0)):
    x, y, z = (point[i] - pivot[i] for i in range(3))
    for axis, angle in enumerate(angles):
        c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        if axis == 0:
            y, z = y * c - z * s, y * s + z * c
        elif axis == 1:
            x, z = x * c + z * s, -x * s + z * c
        else:
            x, y = x * c - y * s, x * s + y * c
    return [x + pivot[0], y + pivot[1], z + pivot[2]]


def bird_svg(species, center, scale, pose="flight"):
    geo = geometry(species)["minecraft:geometry"][0]
    bones = {b["name"]: b for b in geo["bones"]}
    nocturnal = species in NOCTURNAL_SPECIES
    fish = species in AQUATIC_SPECIES
    pose_bones = perch_animation()["bones"] if nocturnal and pose == "perch" else {}
    faces = []
    for bone in geo["bones"]:
        for cube in bone.get("cubes", []):
            origin, size = cube["origin"], cube["size"]
            points = []
            for dx, dy, dz in ((0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0),
                               (0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)):
                point = [origin[i] + size[i] * offset for i, offset in enumerate((dx, dy, dz))]
                point = rotate(point, cube.get("rotation", [0, 0, 0]), cube.get("pivot", [0, 0, 0]))
                ancestor = bone
                while ancestor:
                    angle = 7 if ancestor["name"] == "wing_left" else -7 if ancestor["name"] == "wing_right" else 0
                    angles = pose_bones.get(ancestor["name"], {}).get("rotation", [0, 0, angle])
                    if nocturnal and pose == "flight" and ancestor["name"] == "root":
                        angles = [-18, 0, -4]
                    if fish and ancestor["name"] == "tail":
                        angles = [0, 10, 0]
                    point = rotate(point, angles, ancestor["pivot"])
                    ancestor = bones.get(ancestor.get("parent"))
                # Front views keep both owl eyes visible in this simple painter
                # preview, while the higher flight view also shows the wings.
                camera = ([24, 0, 0] if pose == "perch" else [38, 0, 0]) if nocturnal else [30, -28, -9]
                if fish:
                    camera = [12, -32, 0] if species == "deepmaw" else [0, 90, 0]
                points.append(rotate(point, camera))
            u, v = cube["uv"]["north"]["uv"]
            palette_index = int(u // 8) + (int(v // 8) * 8 if len(PALETTES[species]) > 8 else 0)
            palette = PALETTES[species][palette_index]
            rgb = bytes.fromhex(palette)
            for indices, light in [((0, 1, 2, 3), .85), ((4, 7, 6, 5), .65),
                                    ((0, 3, 7, 4), .73), ((1, 5, 6, 2), .95),
                                    ((3, 2, 6, 7), 1.22), ((0, 4, 5, 1), .6)]:
                coords = [points[i] for i in indices]
                # Unshaded eyes preview their palette, not actual game lighting.
                if bone["name"] == "eyes":
                    light = 1
                color = "#" + "".join(f"{min(255, round(v * light)):02x}" for v in rgb)
                projected = " ".join(f"{center[0] + p[0] * scale:.2f},{center[1] - p[1] * scale:.2f}" for p in coords)
                # Camera looks toward positive Z after transforming the model.
                # Float sum changed in Python 3.12. Quantize the accurate depth
                # so roundoff on coplanar faces cannot change painter ordering
                # across supported runtimes; SVG coordinates use two decimals.
                depth = round(math.fsum(p[2] for p in coords) / 4, 10)
                faces.append((depth,
                              f'<polygon points="{projected}" fill="{color}" stroke="{color}" stroke-width=".35"/>'))
    return "\n".join(polygon for _, polygon in sorted(faces, reverse=True))


def create_preview():
    width, columns, margin, gap, card_h = 1440, 3, 64, 22, 315
    card_w = (width - 2 * margin - gap * (columns - 1)) / columns
    rows = math.ceil(len(SPECIES) / columns)
    height = 205 + rows * (card_h + gap) + 67
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
           '<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#133746"/><stop offset="1" stop-color="#081b28"/></linearGradient></defs>',
           f'<rect width="{width}" height="{height}" fill="url(#sky)"/>',
           '<g font-family="system-ui, sans-serif">',
           '<text x="64" y="65" fill="#e6bd73" font-size="17" letter-spacing="4">LUMEN · STUMME HIMMELSVÖGEL</text>',
           '<text x="64" y="120" fill="#edf4ee" font-size="40" font-weight="650">Leben am Himmel und im Wasser. Ganz ohne Geräusche.</text>',
           f'<text x="64" y="157" fill="#a6bdc6" font-size="19">Geometrievorschau · {len(BIRD_SPECIES)} Vogel- und {len(FISH_SPECIES)} Fischmodelle + Tiefenmaul · kein Screenshot aus Minecraft</text>']
    subtitles = {"deepmaw": "16 Blöcke · Geburtstagshut · großes Maul",
                 "raven": "Flügelschlag & Gleitphasen", "blue_tit": "Blaue Flügel · gelbe Brust",
                 "robin": "Warme orangefarbene Brust", "goldfinch": "Roter Kopf · gelbe Flügelbinde",
                 "eagle": "Breite Schwingen · ruhige Kreise",
                 "owl": "Dämmerung & Nacht · rote Leuchtaugen",
                 "eagle_owl": "Größer · Federohren · rote Leuchtaugen",
                 "trout": "Silbrige Flanken · dunkle Punkte",
                 "carp": "Goldbrauner Bauch · feine Barteln",
                 "pike": "Dunkler Hecht · gelbe Leuchtaugen"}
    scales = {"deepmaw": 1.0, "raven": 11, "blue_tit": 19, "robin": 19, "goldfinch": 19, "eagle": 9,
              "trout": 20, "carp": 20, "pike": 17}
    for index, species in enumerate(SPECIES):
        x = margin + index % columns * (card_w + gap)
        y = 205 + index // columns * (card_h + gap)
        nocturnal = species in NOCTURNAL_SPECIES
        fish = species in AQUATIC_SPECIES
        fill = "#173b40" if fish else "#202f43" if nocturnal else "#173542"
        svg.append(f'<rect x="{x}" y="{y}" width="{card_w}" height="{card_h}" rx="22" fill="{fill}" stroke="#33515b"/>')
        if nocturnal:
            # Both snapshots use the real connected skeleton and sitting angles.
            svg += [f'<rect x="{x + card_w - 147}" y="{y + 183}" width="113" height="14" rx="6" fill="#416047"/>',
                    bird_svg(species, (x + 145, y + 177), 11 if species == "owl" else 8.8),
                    bird_svg(species, (x + card_w - 88, y + 182), 14 if species == "owl" else 11, pose="perch"),
                    f'<text x="{x + 105}" y="{y + 220}" fill="#a6bdc6" font-size="14">Im Flug</text>',
                    f'<text x="{x + card_w - 122}" y="{y + 220}" fill="#a6bdc6" font-size="14">Baumsitz</text>']
        else:
            svg.append(bird_svg(species, (x + card_w / 2, y + 137), scales[species]))
        svg += [f'<text x="{x + 23}" y="{y + 263}" fill="#edf4ee" font-size="25" font-weight="600">{NAMES[species][0]}</text>',
                f'<text x="{x + 23}" y="{y + 291}" fill="#a6bdc6" font-size="15">{escape(subtitles[species])}</text>']
    svg += [f'<text x="64" y="{height - 42}" fill="#a6bdc6" font-size="18">Oberwelt · Tag- und Nachtvögel · Fische und Tiefenmaul in geprüftem Wasser</text>',
            f'<text x="64" y="{height - 16}" fill="#8da4ae" font-size="15">Leuchtaugen, Flug-, Sitz- und Schwimmbewegungen müssen zusätzlich in Minecraft geprüft werden.</text>',
            '</g></svg>']
    (ROOT / "docs" / "PREVIEW.svg").write_text("\n".join(svg), encoding="utf-8")


if __name__ == "__main__":
    create_preview()
