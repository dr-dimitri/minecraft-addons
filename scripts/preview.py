"""Orthographic SVG inspection of the actual geometry; not an in-game screenshot."""
from html import escape
import math
from generate import ROOT, SPECIES, PALETTES, NAMES, geometry


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


def bird_svg(species, center, scale):
    geo = geometry(species)["minecraft:geometry"][0]
    bones = {b["name"]: b for b in geo["bones"]}
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
                    point = rotate(point, [0, 0, angle], ancestor["pivot"])
                    ancestor = bones.get(ancestor.get("parent"))
                points.append(rotate(point, [30, -28, -9]))
            palette = PALETTES[species][int(cube["uv"]["north"]["uv"][0] // 8)]
            rgb = bytes.fromhex(palette)
            for indices, light in [((0, 1, 2, 3), .85), ((4, 7, 6, 5), .65),
                                    ((0, 3, 7, 4), .73), ((1, 5, 6, 2), .95),
                                    ((3, 2, 6, 7), 1.22), ((0, 4, 5, 1), .6)]:
                coords = [points[i] for i in indices]
                color = "#" + "".join(f"{min(255, round(v * light)):02x}" for v in rgb)
                projected = " ".join(f"{center[0] + p[0] * scale:.2f},{center[1] - p[1] * scale:.2f}" for p in coords)
                # Camera looks toward positive Z after transforming the model.
                faces.append((sum(p[2] for p in coords) / 4,
                              f'<polygon points="{projected}" fill="{color}" stroke="{color}" stroke-width=".35"/>'))
    return "\n".join(polygon for _, polygon in sorted(faces, reverse=True))


def create_preview():
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="940" viewBox="0 0 1440 940">',
           '<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#133746"/><stop offset="1" stop-color="#081b28"/></linearGradient></defs>',
           '<rect width="1440" height="940" fill="url(#sky)"/>',
           '<g font-family="system-ui, sans-serif">',
           '<text x="64" y="65" fill="#e6bd73" font-size="17" letter-spacing="4">LUMEN · STUMME HIMMELSVÖGEL</text>',
           '<text x="64" y="120" fill="#edf4ee" font-size="42" font-weight="650">Ein lebendiger Himmel. Ganz ohne Gezwitscher.</text>',
           '<text x="64" y="157" fill="#a6bdc6" font-size="19">Geometrievorschau der fünf Vogelmodelle · kein Screenshot aus Minecraft</text>']
    positions = {"raven": (64, 205), "blue_tit": (405, 205), "robin": (64, 530), "goldfinch": (405, 530)}
    subtitles = {"raven": "Flügelschlag & Gleitphasen", "blue_tit": "Blaue Flügel · gelbe Brust",
                 "robin": "Warme orangefarbene Brust", "goldfinch": "Roter Kopf · gelbe Flügelbinde"}
    for species, (x, y) in positions.items():
        svg += [f'<rect x="{x}" y="{y}" width="318" height="300" rx="22" fill="#173542" stroke="#33515b"/>',
                bird_svg(species, (x + 159, y + 133), 8 if species == "raven" else 14),
                f'<text x="{x + 23}" y="{y + 244}" fill="#edf4ee" font-size="25" font-weight="600">{NAMES[species][0]}</text>',
                f'<text x="{x + 23}" y="{y + 273}" fill="#a6bdc6" font-size="15">{escape(subtitles[species])}</text>']
    svg += ['<rect x="746" y="205" width="630" height="625" rx="22" fill="#204451" stroke="#44616a"/>',
            '<ellipse cx="1061" cy="465" rx="259" ry="112" fill="none" stroke="#6b8286" stroke-width="1.5" stroke-dasharray="4 9" opacity=".55"/>',
            bird_svg("eagle", (1061, 442), 14),
            '<text x="784" y="715" fill="#f0d399" font-size="17" letter-spacing="2">HOCH ÜBER DER LANDSCHAFT</text>',
            '<text x="784" y="757" fill="#edf4ee" font-size="34" font-weight="600">Der kreisende Steinadler</text>',
            '<text x="784" y="793" fill="#bad0d5" font-size="18">Breite Schwingen · gespreizte Federspitzen · ruhige Kreise</text>',
            '<text x="64" y="891" fill="#a6bdc6" font-size="18">Nur tagsüber in der Oberwelt · 6 Vögel je Gruppe · höchstens 18 geladene Vögel</text>',
            '</g></svg>']
    (ROOT / "docs" / "PREVIEW.svg").write_text("\n".join(svg), encoding="utf-8")


if __name__ == "__main__":
    create_preview()
