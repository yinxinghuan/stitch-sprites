from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

def classify_pixels(image: Image.Image) -> np.ndarray:
    rgb = np.asarray(image, dtype=np.float32) / 255
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturation = np.divide(maximum - minimum, maximum, out=np.zeros_like(maximum), where=maximum > 0)
    return (saturation > 0.19) | (maximum < 0.61)


def stitch_boundaries(image: Image.Image, segments: int, axis: int) -> list[int]:
    foreground = classify_pixels(image)
    profile = foreground.mean(axis=0 if axis == 1 else 1)
    length = image.width if axis == 1 else image.height
    panel_size = length / segments
    boundaries = [0]
    for index in range(1, segments):
        expected = round(panel_size * index)
        radius = max(18, round(panel_size * 0.24))
        start = max(boundaries[-1] + 8, expected - radius)
        end = min(length - 8, expected + radius)
        smooth = np.convolve(profile, np.ones(9) / 9, mode="same")
        boundaries.append(start + int(np.argmin(smooth[start:end + 1])))
    boundaries.append(length)
    return boundaries


def audit(path: Path, columns: int, rows: int, minimum: float) -> bool:
    image = Image.open(path).convert("RGB")
    xs = stitch_boundaries(image, columns, axis=1)
    ys = stitch_boundaries(image, rows, axis=0)
    passed = True
    for index in range(columns * rows):
        col = index % columns
        row = index // columns
        tile = image.crop((xs[col], ys[row], xs[col + 1], ys[row + 1]))
        foreground = classify_pixels(tile)
        seen: set[tuple[int, int]] = set()
        components: list[list[tuple[int, int]]] = []
        for start_y, start_x in zip(*np.nonzero(foreground)):
            start = (int(start_y), int(start_x))
            if start in seen:
                continue
            queue = deque([start])
            seen.add(start)
            component: list[tuple[int, int]] = []
            while queue:
                y, x = queue.popleft()
                component.append((y, x))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        point = (y + dy, x + dx)
                        if dy == dx == 0 or point in seen:
                            continue
                        if 0 <= point[0] < tile.height and 0 <= point[1] < tile.width and foreground[point]:
                            seen.add(point)
                            queue.append(point)
            components.append(component)
        main = max(components, key=len, default=[])
        occupied_y = np.array([point[0] for point in main])
        occupied_x = np.array([point[1] for point in main])
        if not len(occupied_x):
            print(f"FAIL {path.name} #{index}: empty")
            passed = False
            continue
        margins = {
            "left": int(occupied_x.min()),
            "right": tile.width - 1 - int(occupied_x.max()),
            "top": int(occupied_y.min()),
            "bottom": tile.height - 1 - int(occupied_y.max()),
        }
        ratios = {
            "left": margins["left"] / tile.width,
            "right": margins["right"] / tile.width,
            "top": margins["top"] / tile.height,
            "bottom": margins["bottom"] / tile.height,
        }
        limiting_side = min(ratios, key=ratios.get)
        limiting_ratio = ratios[limiting_side]
        status = "PASS" if limiting_ratio >= minimum else "FAIL"
        passed &= status == "PASS"
        print(
            f"{status} {path.name} #{index}: min={limiting_ratio:.1%} "
            f"({limiting_side}), px={margins}, tile={tile.width}x{tile.height}"
        )
    return passed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("images", nargs="+", type=Path)
    parser.add_argument("--columns", type=int, default=3)
    parser.add_argument("--rows", type=int, default=3)
    parser.add_argument("--minimum", type=float, default=0.055)
    args = parser.parse_args()
    all_passed = True
    for path in args.images:
        all_passed &= audit(path, args.columns, args.rows, args.minimum)
    raise SystemExit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
