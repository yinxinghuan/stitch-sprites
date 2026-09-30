from __future__ import annotations

import argparse
import json
import math
from collections import deque
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


def make_mask(level: int, size: int = 31) -> Image.Image:
    """Draw one original, deliberately recognisable object silhouette."""
    image = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(image)
    s = lambda value: round(value * (size - 1) / 30)
    box = lambda x0, y0, x1, y1: (s(x0), s(y0), s(x1), s(y1))
    points = lambda values: [(s(x), s(y)) for x, y in values]
    white = 255
    black = 0
    thick = max(2, s(3))

    if level == 1:  # kite + bows
        draw.polygon(points([(15, 2), (27, 13), (15, 24), (3, 13)]), fill=white)
        draw.line(points([(15, 24), (15, 30)]), fill=white, width=thick)
        draw.polygon(points([(15, 25), (11, 27), (15, 28), (19, 27)]), fill=white)
    elif level == 2:  # lantern
        draw.arc(box(8, 1, 22, 13), 180, 360, fill=white, width=thick)
        draw.rounded_rectangle(box(6, 8, 24, 27), radius=s(3), fill=white)
        draw.rectangle(box(9, 5, 21, 10), fill=white)
        draw.rectangle(box(9, 27, 21, 29), fill=white)
        draw.rectangle(box(11, 13, 19, 22), fill=black)
    elif level == 3:  # compass rose
        draw.ellipse(box(3, 3, 27, 27), fill=white)
        draw.polygon(points([(15, 0), (19, 11), (30, 15), (19, 19), (15, 30), (11, 19), (0, 15), (11, 11)]), fill=white)
        draw.ellipse(box(11, 11, 19, 19), fill=black)
    elif level == 4:  # cut jewel
        draw.polygon(points([(15, 2), (27, 10), (23, 25), (15, 29), (7, 25), (3, 10)]), fill=white)
        draw.line(points([(3, 10), (27, 10), (15, 29), (3, 10), (15, 2), (27, 10)]), fill=black, width=max(1, s(1)))
    elif level == 5:  # rose window
        for angle in range(0, 360, 45):
            cx = 15 + math.cos(math.radians(angle)) * 8
            cy = 15 + math.sin(math.radians(angle)) * 8
            draw.ellipse(box(cx - 5, cy - 5, cx + 5, cy + 5), fill=white)
        draw.ellipse(box(9, 9, 21, 21), fill=white)
        draw.ellipse(box(13, 13, 17, 17), fill=black)
    elif level == 6:  # ringed planet
        draw.ellipse(box(6, 6, 24, 24), fill=white)
        draw.arc(box(1, 10, 29, 22), 5, 175, fill=white, width=thick)
        draw.arc(box(1, 8, 29, 20), 185, 355, fill=white, width=thick)
        draw.ellipse(box(20, 3, 24, 7), fill=white)
    elif level == 7:  # shield
        draw.polygon(points([(4, 5), (15, 1), (26, 5), (24, 19), (15, 29), (6, 19)]), fill=white)
        draw.polygon(points([(15, 7), (18, 13), (24, 14), (19, 18), (20, 24), (15, 20), (10, 24), (11, 18), (6, 14), (12, 13)]), fill=black)
    elif level == 8:  # five-petal flower
        for angle in range(-90, 270, 72):
            cx = 15 + math.cos(math.radians(angle)) * 7
            cy = 15 + math.sin(math.radians(angle)) * 7
            draw.ellipse(box(cx - 6, cy - 8, cx + 6, cy + 5), fill=white)
        draw.ellipse(box(10, 10, 20, 20), fill=white)
    elif level == 9:  # arched gate
        draw.rounded_rectangle(box(3, 3, 27, 29), radius=s(11), fill=white)
        draw.rounded_rectangle(box(9, 10, 21, 30), radius=s(6), fill=black)
        draw.rectangle(box(2, 25, 28, 29), fill=white)
    elif level == 10:  # crescent compass
        draw.ellipse(box(3, 3, 27, 27), fill=white)
        draw.ellipse(box(10, 1, 29, 23), fill=black)
        draw.polygon(points([(21, 17), (24, 22), (29, 23), (25, 26), (26, 30), (21, 27), (17, 30), (18, 25), (14, 22), (19, 21)]), fill=white)
    elif level == 11:  # crown
        draw.polygon(points([(3, 8), (9, 15), (15, 4), (21, 15), (27, 8), (24, 25), (6, 25)]), fill=white)
        draw.rectangle(box(6, 23, 24, 28), fill=white)
    elif level == 12:  # sun dial
        draw.ellipse(box(6, 6, 24, 24), fill=white)
        for angle in range(0, 360, 45):
            x0 = 15 + math.cos(math.radians(angle)) * 11
            y0 = 15 + math.sin(math.radians(angle)) * 11
            x1 = 15 + math.cos(math.radians(angle)) * 14
            y1 = 15 + math.sin(math.radians(angle)) * 14
            draw.line(points([(x0, y0), (x1, y1)]), fill=white, width=thick)
        draw.polygon(points([(15, 8), (18, 20), (12, 20)]), fill=black)
    elif level == 13:  # pennant crest
        draw.line(points([(6, 2), (6, 29)]), fill=white, width=thick)
        draw.polygon(points([(7, 4), (27, 8), (19, 16), (7, 14)]), fill=white)
        draw.ellipse(box(11, 7, 17, 13), fill=black)
    elif level == 14:  # star
        star = []
        for index in range(10):
            angle = math.radians(-90 + index * 36)
            radius = 14 if index % 2 == 0 else 6
            star.append((15 + math.cos(angle) * radius, 15 + math.sin(angle) * radius))
        draw.polygon(points(star), fill=white)
    elif level == 15:  # hill terrarium
        draw.ellipse(box(3, 4, 27, 28), fill=white)
        draw.rectangle(box(2, 24, 28, 29), fill=white)
        draw.polygon(points([(5, 23), (12, 14), (17, 21), (22, 11), (27, 23)]), fill=black)
    elif level == 16:  # hummingbird
        draw.ellipse(box(10, 10, 23, 23), fill=white)
        draw.polygon(points([(14, 13), (2, 4), (8, 17)]), fill=white)
        draw.polygon(points([(18, 12), (16, 1), (23, 10)]), fill=white)
        draw.polygon(points([(22, 14), (30, 11), (23, 17)]), fill=white)
        draw.polygon(points([(12, 20), (5, 27), (16, 23)]), fill=white)
    elif level == 17:  # lunchbox
        draw.arc(box(8, 1, 22, 13), 180, 360, fill=white, width=thick)
        draw.rounded_rectangle(box(3, 8, 27, 27), radius=s(3), fill=white)
        draw.rectangle(box(4, 14, 26, 17), fill=black)
        draw.ellipse(box(13, 12, 17, 19), fill=white)
    elif level == 18:  # food truck
        draw.rounded_rectangle(box(2, 7, 27, 24), radius=s(2), fill=white)
        draw.rectangle(box(17, 10, 25, 17), fill=black)
        draw.rectangle(box(5, 10, 14, 16), fill=black)
        draw.polygon(points([(3, 7), (7, 3), (22, 3), (27, 7)]), fill=white)
        draw.ellipse(box(5, 21, 11, 27), fill=white); draw.ellipse(box(20, 21, 26, 27), fill=white)
    elif level == 19:  # ribbon camera
        draw.rounded_rectangle(box(3, 8, 27, 25), radius=s(3), fill=white)
        draw.rectangle(box(8, 5, 14, 9), fill=white)
        draw.ellipse(box(9, 10, 22, 23), fill=black)
        draw.ellipse(box(12, 13, 19, 20), fill=white)
        draw.polygon(points([(23, 7), (29, 2), (28, 11)]), fill=white)
    elif level == 20:  # snow globe
        draw.ellipse(box(4, 2, 26, 24), fill=white)
        draw.polygon(points([(8, 21), (14, 12), (18, 18), (22, 10), (25, 22)]), fill=black)
        draw.rounded_rectangle(box(5, 23, 25, 29), radius=s(2), fill=white)
    elif level == 21:  # lunar pod
        draw.ellipse(box(7, 3, 23, 26), fill=white)
        draw.polygon(points([(8, 18), (2, 27), (10, 24)]), fill=white)
        draw.polygon(points([(22, 18), (28, 27), (20, 24)]), fill=white)
        draw.ellipse(box(11, 8, 19, 16), fill=black)
    elif level == 22:  # porthole
        draw.ellipse(box(2, 2, 28, 28), fill=white)
        draw.ellipse(box(8, 8, 22, 22), fill=black)
        for angle in range(0, 360, 45):
            cx = 15 + math.cos(math.radians(angle)) * 11
            cy = 15 + math.sin(math.radians(angle)) * 11
            draw.ellipse(box(cx - 1.5, cy - 1.5, cx + 1.5, cy + 1.5), fill=black)
    elif level == 23:  # dome bakery
        draw.pieslice(box(3, 2, 27, 26), 180, 360, fill=white)
        draw.rectangle(box(3, 14, 27, 27), fill=white)
        draw.polygon(points([(3, 15), (7, 10), (11, 15), (15, 10), (19, 15), (23, 10), (27, 15)]), fill=black)
        draw.rectangle(box(12, 19, 18, 27), fill=black)
    elif level == 24:  # jellyfish lamp
        draw.pieslice(box(3, 2, 27, 24), 180, 360, fill=white)
        draw.rectangle(box(3, 13, 27, 18), fill=white)
        for x in (6, 11, 16, 21, 26):
            draw.arc(box(x - 3, 14, x + 3, 29), 0, 180, fill=white, width=thick)
    elif level == 25:  # headphones
        draw.arc(box(3, 2, 27, 28), 180, 360, fill=white, width=s(5))
        draw.rounded_rectangle(box(2, 13, 9, 27), radius=s(3), fill=white)
        draw.rounded_rectangle(box(21, 13, 28, 27), radius=s(3), fill=white)
    elif level == 26:  # weather station
        draw.ellipse(box(4, 5, 22, 20), fill=white)
        draw.ellipse(box(12, 2, 27, 19), fill=white)
        draw.line(points([(15, 17), (15, 29)]), fill=white, width=thick)
        draw.line(points([(8, 24), (22, 24)]), fill=white, width=thick)
        draw.ellipse(box(5, 21, 10, 26), fill=white); draw.ellipse(box(20, 21, 25, 26), fill=white)
    elif level == 27:  # scooter
        draw.ellipse(box(2, 21, 10, 29), fill=white); draw.ellipse(box(20, 21, 28, 29), fill=white)
        draw.rounded_rectangle(box(7, 12, 22, 25), radius=s(4), fill=white)
        draw.line(points([(20, 14), (24, 5), (29, 5)]), fill=white, width=thick)
        draw.rectangle(box(3, 17, 11, 22), fill=white)
    elif level == 28:  # record cart
        draw.rounded_rectangle(box(3, 7, 27, 24), radius=s(2), fill=white)
        draw.ellipse(box(8, 10, 20, 22), fill=black)
        draw.ellipse(box(12, 14, 16, 18), fill=white)
        draw.line(points([(20, 11), (25, 18)]), fill=black, width=thick)
        draw.ellipse(box(5, 22, 11, 28), fill=white); draw.ellipse(box(19, 22, 25, 28), fill=white)
    elif level == 29:  # planetarium projector
        draw.pieslice(box(4, 2, 26, 24), 180, 360, fill=white)
        draw.rectangle(box(4, 13, 26, 22), fill=white)
        draw.polygon(points([(10, 22), (20, 22), (24, 29), (6, 29)]), fill=white)
        for x, y in ((10, 9), (15, 5), (21, 10)):
            draw.ellipse(box(x - 1, y - 1, x + 1, y + 1), fill=black)
    elif level == 30:  # capsule workshop
        draw.rounded_rectangle(box(3, 3, 27, 27), radius=s(9), fill=white)
        draw.polygon(points([(8, 21), (13, 16), (11, 12), (14, 9), (18, 13), (22, 9), (24, 12), (18, 18), (21, 22), (18, 25), (14, 20), (11, 24)]), fill=black)
    elif level == 31:  # rocket clock
        draw.ellipse(box(7, 4, 23, 25), fill=white)
        draw.polygon(points([(7, 17), (2, 25), (9, 23)]), fill=white); draw.polygon(points([(23, 17), (28, 25), (21, 23)]), fill=white)
        draw.polygon(points([(11, 24), (15, 30), (19, 24)]), fill=white)
        draw.ellipse(box(11, 8, 19, 16), fill=black)
    elif level == 32:  # dome greenhouse
        draw.pieslice(box(2, 1, 28, 27), 180, 360, fill=white)
        draw.rectangle(box(2, 14, 28, 28), fill=white)
        draw.line(points([(15, 3), (15, 28), (4, 15), (26, 15)]), fill=black, width=max(1, s(1)))
        draw.arc(box(8, 13, 16, 27), 180, 360, fill=black, width=thick)
        draw.arc(box(14, 11, 23, 27), 180, 360, fill=black, width=thick)
    elif level == 33:  # orrery
        draw.ellipse(box(10, 10, 20, 20), fill=white)
        draw.ellipse(box(2, 6, 28, 24), outline=white, width=thick)
        draw.ellipse(box(7, 2, 23, 28), outline=white, width=thick)
        draw.ellipse(box(24, 12, 29, 17), fill=white); draw.ellipse(box(5, 22, 10, 27), fill=white)
    elif level == 34:  # underwater cabin
        draw.polygon(points([(3, 14), (15, 4), (27, 14), (25, 28), (5, 28)]), fill=white)
        draw.ellipse(box(10, 13, 20, 23), fill=black)
        draw.ellipse(box(1, 4, 5, 8), fill=white); draw.ellipse(box(25, 2, 29, 6), fill=white)
    elif level == 35:  # synthesizer
        draw.rounded_rectangle(box(2, 6, 28, 26), radius=s(3), fill=white)
        for x in range(5, 27, 4):
            draw.rectangle(box(x, 17, x + 2, 25), fill=black)
        for x in (7, 12, 17, 22):
            draw.ellipse(box(x - 1.5, 9, x + 1.5, 12), fill=black)
    elif level == 36:  # mobile library
        draw.rounded_rectangle(box(2, 6, 28, 24), radius=s(2), fill=white)
        for y in (10, 15):
            draw.rectangle(box(5, y, 23, y + 2), fill=black)
        for x in (8, 13, 18):
            draw.rectangle(box(x, 8, x + 2, 20), fill=black)
        draw.ellipse(box(5, 21, 11, 28), fill=white); draw.ellipse(box(20, 21, 26, 28), fill=white)
    elif level == 37:  # vending machine
        draw.rounded_rectangle(box(5, 2, 25, 29), radius=s(3), fill=white)
        draw.rectangle(box(8, 6, 19, 19), fill=black)
        for x in (10, 14, 18):
            for y in (8, 12, 16):
                draw.ellipse(box(x - 1, y - 1, x + 1, y + 1), fill=white)
        draw.rectangle(box(10, 23, 20, 27), fill=black)
    elif level == 38:  # camp lantern
        draw.arc(box(7, 0, 23, 13), 180, 360, fill=white, width=thick)
        draw.polygon(points([(8, 8), (22, 8), (25, 25), (5, 25)]), fill=white)
        draw.ellipse(box(9, 11, 21, 23), fill=black)
        draw.rectangle(box(4, 24, 26, 29), fill=white)
    elif level == 39:  # arcade cabinet
        draw.polygon(points([(6, 2), (24, 2), (26, 29), (4, 29), (5, 15), (8, 10)]), fill=white)
        draw.rectangle(box(9, 6, 21, 15), fill=black)
        draw.rectangle(box(8, 19, 22, 24), fill=black)
        draw.ellipse(box(10, 20, 13, 23), fill=white); draw.ellipse(box(17, 20, 20, 23), fill=white)
    else:  # moon-phase clock
        draw.ellipse(box(2, 2, 28, 28), fill=white)
        draw.ellipse(box(9, 7, 21, 19), fill=black)
        draw.ellipse(box(13, 7, 23, 19), fill=white)
        draw.line(points([(15, 18), (15, 25), (21, 25)]), fill=black, width=thick)

    return image


def make_rows(level: int) -> list[str]:
    mask = make_mask(level)
    size = mask.width
    occupied = {(row, col) for row in range(size) for col in range(size) if mask.getpixel((col, row))}
    padded = size + 2
    distance = [[-1 for _ in range(padded)] for _ in range(padded)]
    queue: deque[tuple[int, int]] = deque()
    for row in range(padded):
        for col in range(padded):
            if row in (0, padded - 1) or col in (0, padded - 1) or (row - 1, col - 1) not in occupied:
                distance[row][col] = 0
                queue.append((row, col))
    while queue:
        row, col = queue.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            next_row, next_col = row + dr, col + dc
            if 0 <= next_row < padded and 0 <= next_col < padded and distance[next_row][next_col] < 0:
                distance[next_row][next_col] = distance[row][col] + 1
                queue.append((next_row, next_col))

    depths = {(row, col): distance[row + 1][col + 1] for row, col in occupied}
    values = sorted(set(depths.values()))
    count = color_count(level)
    depth_rank = {value: index for index, value in enumerate(values)}
    codes = [COLOR_ORDER[(level - 1 + index * 2) % len(COLOR_ORDER)] for index in range(count)]
    codes[0] = "R" if level == 1 else codes[0]
    rows: list[str] = []
    for row in range(size):
        chars: list[str] = []
        for col in range(size):
            if (row, col) not in occupied:
                chars.append(".")
                continue
            rank = depth_rank[depths[(row, col)]]
            if len(values) >= count:
                band = min(count - 1, round(rank * (count - 1) / max(1, len(values) - 1)))
            else:
                angle = (math.atan2(row - (size - 1) / 2, col - (size - 1) / 2) + math.pi) / (2 * math.pi)
                band = min(count - 1, int(angle * count))
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
    color_columns: dict[str, list[int]] = {}
    ordered_colors = list(dict.fromkeys(color for color, _ in ordered))
    previous = -1
    for spool in ordered:
        color = spool[0]
        if color not in color_columns:
            color_index = ordered_colors.index(color)
            if level <= 20:
                if len(ordered_colors) == 2:
                    color_columns[color] = [0, 3] if color_index == 0 else [1, 2]
                elif len(ordered_colors) == 3:
                    color_columns[color] = [0] if color_index == 0 else ([1, 2] if color_index == 1 else [3])
                else:
                    color_columns[color] = [color_index % 4]
            else:
                start = (color_index * 2) % 4
                color_columns[color] = [start, (start + 1) % 4]
        choices = color_columns[color]
        if level <= 20:
            column = min(choices, key=lambda candidate: len(columns[candidate]))
        else:
            column = min((candidate for candidate in choices if candidate != previous), key=lambda candidate: len(columns[candidate]), default=-1)
            if column < 0:
                column = min((candidate for candidate in range(4) if candidate != previous), key=lambda candidate: len(columns[candidate]))
        columns[column].append(spool)
        solution.append(column)
        previous = column
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
