"""Build the landing globe's coastline outline from Natural Earth.

The interactive globe projects vector rings every frame instead of rasterising
a texture, so it needs the geometry as plain arrays — not a 726KB GeoJSON with
94 properties per feature that would be parsed on the client and then thrown
away.

Output: `apps/web/public/data/world-coastline.json`
    { "rings": [ [lon, lat, lon, lat, ...], ... ] }

Coordinates are FLAT arrays of alternating lon/lat, rounded to 1 decimal. At
the globe's rendered size 0.1 degrees is about a third of a pixel, so the
rounding is invisible and it roughly halves the payload.

Run: python scripts/generate_coastline.py
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "apps/web/public/data/ne-110m-admin-0-countries.json"
TARGET = ROOT / "apps/web/public/data/world-coastline.json"

# Rings smaller than this (in degrees, longest bbox side) are dropped. At the
# rendered size they are sub-pixel specks that only add noise and bytes.
MIN_SPAN = 1.2
MIN_POINTS = 5


def rings_of(geometry):
    kind = geometry["type"]
    if kind == "Polygon":
        return geometry["coordinates"]
    if kind == "MultiPolygon":
        return [ring for polygon in geometry["coordinates"] for ring in polygon]
    return []


def main() -> None:
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    out = []
    dropped = 0

    for feature in data["features"]:
        for ring in rings_of(feature["geometry"]):
            points = []
            previous = None
            for lon, lat in ring:
                point = (round(lon, 1), round(lat, 1))
                # Rounding collapses neighbouring vertices; keep one of each run.
                if point != previous:
                    points.append(point)
                    previous = point

            if len(points) < MIN_POINTS:
                dropped += 1
                continue

            lons = [p[0] for p in points]
            lats = [p[1] for p in points]
            if max(max(lons) - min(lons), max(lats) - min(lats)) < MIN_SPAN:
                dropped += 1
                continue

            flat = []
            for lon, lat in points:
                flat.append(lon)
                flat.append(lat)
            out.append(flat)

    TARGET.write_text(
        json.dumps({"rings": out}, separators=(",", ":")),
        encoding="utf-8",
    )
    total = sum(len(r) // 2 for r in out)
    print(f"rings {len(out)} (dropped {dropped}) · points {total}")
    print(f"{TARGET.relative_to(ROOT)} · {TARGET.stat().st_size / 1024:.0f}KB")


if __name__ == "__main__":
    main()
