from __future__ import annotations

import argparse
import colorsys
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_TS = ROOT / "src" / "cg" / "game" / "generated-patterns.ts"
OUTPUT_DIR = ROOT / "src" / "cg" / "patterns"
MANIFEST = OUTPUT_DIR / "manifest.json"

KEYS = [
    "ladybug", "spellbook", "slime", "suitcase", "potion", "lighthouse",
    "deskFan", "rollerSkate", "hotAirBalloon", "espressoMachine",
    "koiSubmarine", "cassettePlayer", "trailBackpack", "gameController",
    "hillTerrarium", "windupHummingbird", "planetLunchbox", "foodTruck",
    "ribbonCamera", "snowGlobe", "lunarPod", "submarinePorthole",
    "domeBakery", "jellyfishLamp", "headphoneStand", "weatherStation",
    "deliveryScooter", "recordShopCart", "planetariumProjector",
    "capsuleWorkshop", "rocketClock", "domeGreenhouse", "glassOrrery",
    "underwaterCabin", "synthesizer", "mobileLibrary", "vendingMachine",
    "campLantern", "arcadeCabinet", "moonPhaseClock",
]

PALETTE = {
    "R": "#D9505D",
    "Y": "#E9B949",
    "G": "#58A36B",
    "B": "#438FBE",
    "P": "#8068B2",
    "K": "#34313B",
    "C": "#34AEB0",
}
COLOR_ORDER = tuple(PALETTE)


def color_count(level: int) -> int:
    if level <= 5:
        return 2
    if level <= 10:
        return 3
    if level <= 20:
        return 4
    if level <= 30:
        return 5
    if level <= 35:
        return 6
    return 7


def selection_target(level: int) -> int:
    if level == 1:
        return 8
    if level <= 5:
        return 9
    if level <= 10:
        return 12
    if level <= 20:
        return 16
    if level <= 30:
        return 20
    return 24


def metric(level: int, x: float, y: float) -> float:
    angle = math.atan2(y, x)
    radius = math.hypot(x, y)
    mode = (level - 1) % 5
    if mode == 0:
        base = radius / (1 + 0.10 * math.cos((3 + level % 5) * angle))
    elif mode == 1:
        power = 3.0 + (level % 3) * 0.7
        base = (abs(x) ** power + abs(y) ** power) ** (1 / power)
    elif mode == 2:
        base = (abs(x) + abs(y)) / 1.32
    elif mode == 3:
        base = max(abs(x) * 0.92, abs(y)) + min(abs(x), abs(y)) * 0.18
    else:
        base = radius / (1 + 0.08 * math.sin((4 + level % 4) * angle + level))
    return base * (1 + 0.025 * math.sin(x * 0.55 + level) * math.cos(y * 0.45 - level))


def make_rows(level: int) -> list[str]:
    size = 25 + 2 * ((level - 1) // 10)
    center = (size - 1) / 2
    values: list[list[float]] = []
    for row in range(size):
        values.append([
            metric(level, col - center, row - center)
            for col in range(size)
        ])
    radius = center * (0.86 + (level % 4) * 0.015)
    count = color_count(level)
    codes = [COLOR_ORDER[(level - 1 + index * 2) % len(COLOR_ORDER)] for index in range(count)]
    codes[0] = "R" if level == 1 else codes[0]
    rows: list[str] = []
    for value_row in values:
        chars: list[str] = []
        for value in value_row:
            if value > radius:
                chars.append(".")
                continue
            depth = max(0.0, min(0.999999, 1 - value / radius))
            band = min(count - 1, int(depth * count))
            chars.append(codes[band])
        rows.append("".join(chars))
    return rows


def split_capacity(total: int, parts: int) -> list[int]:
    base, extra = divmod(total, parts)
    return [base + (1 if index < extra else 0) for index in range(parts)]


def make_spools(level: int, rows: list[str]) -> tuple[list[list[tuple[str, int]]], list[int]]:
    cells = [list(row) for row in rows]
    height = len(cells)
    width = len(cells[0])
    outside: set[tuple[int, int]] = set()
    reachable: set[tuple[int, int]] = set()

    def passable(row: int, col: int) -> bool:
        return row in (-1, height) or col in (-1, width) or cells[row][col] == "."

    def expand(seeds: list[tuple[int, int]]) -> None:
        queue = list(seeds)
        while queue:
            row, col = queue.pop(0)
            if (row, col) in outside or not (-1 <= row <= height and -1 <= col <= width):
                continue
            if passable(row, col):
                outside.add((row, col))
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    queue.append((row + dr, col + dc))
            elif 0 <= row < height and 0 <= col < width:
                reachable.add((row, col))

    expand([(-1, -1)])
    remaining = sum(code != "." for row in cells for code in row)
    max_reel = max(1, math.ceil(remaining / selection_target(level)))
    ordered: list[tuple[str, int]] = []
    active: str | None = None
    priority = 0
    while remaining:
        available = {cells[row][col] for row, col in reachable if cells[row][col] != "."}
        color = active if active in available else None
        if color is None:
            for offset in range(len(COLOR_ORDER)):
                candidate = COLOR_ORDER[(priority + offset) % len(COLOR_ORDER)]
                if candidate in available:
                    color = candidate
                    priority = (COLOR_ORDER.index(candidate) + 1) % len(COLOR_ORDER)
                    break
        if color is None:
            raise ValueError(f"level {level} has a sealed region")
        removed = 0
        while removed < max_reel:
            candidates = [(row, col) for row, col in reachable if cells[row][col] == color]
            if not candidates:
                break
            row, col = min(candidates, key=lambda cell: (-cell[0], abs(cell[1] - width / 2)))
            reachable.discard((row, col))
            cells[row][col] = "."
            remaining -= 1
            removed += 1
            expand([(row, col)])
        if not removed:
            raise ValueError(f"level {level} could not peel {color}")
        ordered.append((color, removed))
        active = color if any(cells[row][col] == color for row, col in reachable) else None

    columns: list[list[tuple[str, int]]] = [[], [], [], []]
    solution: list[int] = []
    for index, spool in enumerate(ordered):
        column = (index + level - 1) % 4
        columns[column].append(spool)
        solution.append(column)
    return columns, solution


def render_png(rows: list[str], output: Path) -> None:
    pitch = 8
    margin = 12
    width = len(rows[0]) * pitch + margin * 2
    height = len(rows) * pitch + margin * 2
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for row_index, row in enumerate(rows):
        for col_index, code in enumerate(row):
            if code == ".":
                continue
            x = margin + col_index * pitch
            y = margin + row_index * pitch
            color = PALETTE[code]
            draw.line((x + 1, y + 1, x + pitch - 2, y + pitch - 2), fill=color, width=2)
            draw.line((x + pitch - 2, y + 1, x + 1, y + pitch - 2), fill=color, width=2)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, optimize=True)


def transitions(rows: list[str]) -> int:
    total = 0
    for row in rows:
        total += sum(left != right for left, right in zip(row, row[1:]))
    for upper, lower in zip(rows, rows[1:]):
        total += sum(top != bottom for top, bottom in zip(upper, lower))
    return total


def pattern(level: int, key: str) -> dict:
    rows = make_rows(level)
    columns, solution = make_spools(level, rows)
    used = sorted(set("".join(rows)) - {"."}, key=COLOR_ORDER.index)
    return {
        "key": key,
        "rows": rows,
        "colorCount": len(used),
        "exposedColorCount": 1,
        "transitions": transitions(rows),
        "stitchCount": sum(code != "." for row in rows for code in row),
        "palette": {code: PALETTE[code] for code in used},
        "columns": columns,
        "solution": solution,
    }


def write_typescript(patterns: list[dict]) -> None:
    lines = [
        "// Generated by scripts/generate-crazygames-patterns.py from original mathematical primitives.",
        "// Crazy Games only. Do not hand-edit.",
        "export interface GeneratedPattern {",
        "  key: string",
        "  rows: string[]",
        "  colorCount: number",
        "  exposedColorCount: number",
        "  transitions: number",
        "  stitchCount: number",
        "  palette: Partial<Record<string, string>>",
        "  columns: Array<Array<[string, number]>>",
        "  solution: number[]",
        "}",
        "",
        "export const GENERATED_PATTERNS: GeneratedPattern[] = "+ json.dumps(patterns, separators=(",", ":")) + "",
        "",
    ]
    OUTPUT_TS.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pilot", action="store_true", help="Render only pattern 1 for visual approval.")
    args = parser.parse_args()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    patterns = [pattern(level, key) for level, key in enumerate(KEYS, start=1)]
    selected = patterns[:1] if args.pilot else patterns
    for item in selected:
        render_png(item["rows"], OUTPUT_DIR / f"{item['key']}.png")
    if args.pilot:
        print(OUTPUT_DIR / f"{KEYS[0]}.png")
        return
    write_typescript(patterns)
    MANIFEST.write_text(json.dumps({
        "generator": "scripts/generate-crazygames-patterns.py",
        "licence": "Original project artwork; no third-party source material.",
        "patterns": [{"key": item["key"], "file": f"{item['key']}.png"} for item in patterns],
    }, indent=2) + "\n", encoding="utf-8")
    print(f"generated {len(patterns)} original Crazy Games patterns")


if __name__ == "__main__":
    main()
