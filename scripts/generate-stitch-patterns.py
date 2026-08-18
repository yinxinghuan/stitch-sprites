from __future__ import annotations

from collections import deque
from pathlib import Path
import colorsys

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
REFERENCES = ROOT / "doc" / "references"
OUTPUT = ROOT / "src" / "game" / "generated-patterns.ts"
PREVIEW = REFERENCES / "generated-pattern-grid-preview.png"
CROP_AUDIT = REFERENCES / "recrop-source-audit.png"
ORDER_AUDIT = REFERENCES / "generated-pattern-order.md"
SQUARE_AUDIT_DIR = REFERENCES / "level-square-audit"
PATTERN_TEXTURE_DIR = ROOT / "public" / "patterns"

PALETTE = {
    "R": "#E85B67",
    "Y": "#F2C14E",
    "G": "#5FAE73",
    "B": "#4E9CCC",
    "P": "#8E75C5",
    "K": "#3B3A47",
}

PEEL_PRIORITY = tuple(PALETTE)
COLUMN_WEAVE = (0, 1, 2, 3, 1, 0, 3, 2, 0, 2, 1, 3)

HUES = {
    code: colorsys.rgb_to_hsv(*(int(color[index:index + 2], 16) / 255 for index in (1, 3, 5)))[0]
    for code, color in PALETTE.items()
    if code != "K"
}

# One visible stitch in the approved reference maps to one gameplay point.
# The final number is the source-sheet pixel pitch of one photographed stitch.
# There is deliberately no target resolution: the chart is never rescaled.
SOURCES = [
    ("watermelon", "chapter-one-candidate-b.png", 4, 2, 0, 7),
    ("ladybug", "chapter-one-candidate-b.png", 4, 2, 1, 7),
    ("turtle", "chapter-one-candidate-b.png", 4, 2, 2, 7),
    ("whale", "chapter-one-candidate-b.png", 4, 2, 3, 7),
    ("butterfly", "chapter-one-candidate-b.png", 4, 2, 4, 7),
    ("teapot", "chapter-one-candidate-b.png", 4, 2, 5, 7),
    ("moonCat", "chapter-one-candidate-b.png", 4, 2, 6, 7),
    ("cottage", "chapter-one-candidate-b.png", 4, 2, 7, 7),
    ("yarn", "chapter-one-candidate-c.png", 4, 2, 1, 7),
    ("mitten", "chapter-one-candidate-c.png", 4, 2, 2, 7),
    ("sweater", "chapter-one-candidate-c.png", 4, 2, 3, 7),
    ("clock", "chapter-one-candidate-c.png", 4, 2, 4, 7),
    ("basket", "chapter-one-candidate-c.png", 4, 2, 5, 7),
    ("musicBox", "chapter-one-candidate-c.png", 4, 2, 6, 7),
    ("craftRoom", "chapter-one-candidate-c.png", 4, 2, 7, 7),
    ("potion", "chapter-one-candidate-d.png", 4, 2, 0, 7),
    ("slime", "chapter-one-candidate-d.png", 4, 2, 1, 7),
    ("spellbook", "chapter-one-candidate-d.png", 4, 2, 2, 7),
    ("mushroomHome", "chapter-one-candidate-d.png", 4, 2, 3, 7),
    ("moth", "chapter-one-candidate-d.png", 4, 2, 4, 7),
    ("starCat", "chapter-one-candidate-d.png", 4, 2, 5, 7),
    ("flowerFox", "chapter-one-candidate-d.png", 4, 2, 6, 7),
    ("spiritTree", "chapter-one-candidate-d.png", 4, 2, 7, 7),
    ("umbrella", "chapter-four-candidate-e.png", 4, 2, 0, 5),
    ("suitcase", "chapter-four-candidate-e.png", 4, 2, 1, 5),
    ("bell", "chapter-four-candidate-e.png", 4, 2, 2, 5),
    ("tram", "chapter-four-candidate-e.png", 4, 2, 3, 5),
    ("lighthouse", "chapter-four-candidate-e.png", 4, 2, 4, 5),
    ("nightTrain", "chapter-four-candidate-e.png", 4, 2, 5, 5),
    ("observatory", "chapter-four-candidate-e.png", 4, 2, 6, 5),
    ("city", "chapter-four-candidate-e.png", 4, 2, 7, 5),
    ("alteruCoral", "alteru-logo-stitch-candidates.png", 2, 2, 0, 8),
    ("alteruSun", "alteru-logo-stitch-candidates.png", 2, 2, 1, 8),
    ("alteruNight", "alteru-logo-stitch-candidates.png", 2, 2, 2, 8),
    ("alteruBloom", "alteru-logo-stitch-candidates.png", 2, 2, 3, 8),
]

_STITCH_BOUNDARY_CACHE: dict[tuple[int, int, int], list[int]] = {}


def stitch_boundaries(image: Image.Image, segments: int, axis: int) -> list[int]:
    """Split a source sheet at stitch-density valleys, not assumed equal panels or white lines."""
    cache_key = (id(image), segments, axis)
    if cache_key in _STITCH_BOUNDARY_CACHE:
        return _STITCH_BOUNDARY_CACHE[cache_key]
    if segments == 1:
        boundaries = [0, image.width if axis == 1 else image.height]
        _STITCH_BOUNDARY_CACHE[cache_key] = boundaries
        return boundaries
    foreground = classify_pixels(image) > 0
    profile = foreground.mean(axis=0 if axis == 1 else 1)
    length = image.width if axis == 1 else image.height
    panel_size = length / segments
    boundaries = [0]
    for index in range(1, segments):
        expected = round(panel_size * index)
        radius = max(18, round(panel_size * 0.24))
        start = max(boundaries[-1] + 8, expected - radius)
        end = min(length - 8, expected + radius)
        candidates = np.where(profile[start:end + 1] < 0.0025)[0] + start
        runs: list[tuple[int, int]] = []
        if len(candidates):
            run_start = previous = int(candidates[0])
            for candidate in candidates[1:]:
                value = int(candidate)
                if value > previous + 1:
                    runs.append((run_start, previous))
                    run_start = value
                previous = value
            runs.append((run_start, previous))
        if runs:
            viable = [run for run in runs if run[1] - run[0] >= 4]
            pool = viable or runs
            chosen = min(pool, key=lambda run: abs((run[0] + run[1]) / 2 - expected))
            boundary = round((chosen[0] + chosen[1]) / 2)
        else:
            smooth = np.convolve(profile, np.ones(9) / 9, mode="same")
            boundary = start + int(np.argmin(smooth[start:end + 1]))
        boundaries.append(boundary)
    boundaries.append(length)
    _STITCH_BOUNDARY_CACHE[cache_key] = boundaries
    return boundaries


def tile_crop(image: Image.Image, columns: int, rows: int, tile_index: int) -> Image.Image:
    col = tile_index % columns
    row = tile_index // columns
    x_boundaries = stitch_boundaries(image, columns, axis=1)
    y_boundaries = stitch_boundaries(image, rows, axis=0)
    x0, x1 = x_boundaries[col], x_boundaries[col + 1]
    y0, y1 = y_boundaries[row], y_boundaries[row + 1]
    panel = image.crop((x0, y0, x1, y1)).convert("RGB")
    codes = classify_pixels(panel)
    bx0, by0, bx1, by1 = foreground_bbox(codes)
    padding = 16
    bx0 = max(0, bx0 - padding)
    by0 = max(0, by0 - padding)
    bx1 = min(panel.width, bx1 + padding)
    by1 = min(panel.height, by1 + padding)
    return panel.crop((bx0, by0, bx1, by1))


def target_selections(color_count: int) -> int:
    if color_count <= 2:
        return 14
    if color_count == 3:
        return 17
    if color_count == 4:
        return 21
    if color_count == 5:
        return 25
    return 29


def build_spool_plan(pattern: list[str]) -> tuple[list[list[tuple[str, int]]], list[int]]:
    """Create the solvable reel order offline; page startup must never solve all 35 levels."""
    cells = [list(row) for row in pattern]
    rows = len(cells)
    cols = len(cells[0])
    padded_rows = rows + 2
    padded_cols = cols + 2
    outside = np.zeros((padded_rows, padded_cols), dtype=bool)
    reachable: set[tuple[int, int]] = set()

    def passable(pr: int, pc: int) -> bool:
        return pr in (0, padded_rows - 1) or pc in (0, padded_cols - 1) or cells[pr - 1][pc - 1] == "."

    def expand(seeds: list[tuple[int, int]]) -> None:
        queue: deque[tuple[int, int]] = deque()
        for pr, pc in seeds:
            if 0 <= pr < padded_rows and 0 <= pc < padded_cols and not outside[pr, pc] and passable(pr, pc):
                outside[pr, pc] = True
                queue.append((pr, pc))
        while queue:
            pr, pc = queue.popleft()
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nr, nc = pr + dr, pc + dc
                if not (0 <= nr < padded_rows and 0 <= nc < padded_cols):
                    continue
                if passable(nr, nc):
                    if not outside[nr, nc]:
                        outside[nr, nc] = True
                        queue.append((nr, nc))
                else:
                    reachable.add((nr - 1, nc - 1))

    expand([(0, 0)])
    stitch_count = sum(code != "." for row in cells for code in row)
    color_count = len({code for row in cells for code in row if code != "."})
    max_reel = max(1, (stitch_count + target_selections(color_count) - 1) // target_selections(color_count))
    spools: list[tuple[str, int]] = []
    priority_cursor = 0
    active_color: str | None = None
    remaining = stitch_count

    while remaining:
        available = {cells[row][col] for row, col in reachable}
        color = active_color if active_color in available else None
        chosen_priority = priority_cursor
        if color is None:
            for offset in range(len(PEEL_PRIORITY)):
                index = (priority_cursor + offset) % len(PEEL_PRIORITY)
                candidate = PEEL_PRIORITY[index]
                if candidate in available:
                    color = candidate
                    chosen_priority = index
                    break
        if color is None:
            raise ValueError("sealed pattern has no reachable color")

        removed = 0
        while removed < max_reel:
            candidates = [(row, col) for row, col in reachable if cells[row][col] == color]
            if not candidates:
                break
            row, col = min(candidates, key=lambda cell: (-cell[0], abs(cell[1] - cols / 2)))
            reachable.discard((row, col))
            cells[row][col] = "."
            remaining -= 1
            removed += 1
            expand([(row + 1, col + 1)])
        if not removed:
            raise ValueError(f"{color} reel removed no cells")
        spools.append((color, removed))
        remains_reachable = any(cells[row][col] == color for row, col in reachable)
        active_color = color if remains_reachable else None
        if not remains_reachable:
            priority_cursor = (chosen_priority + 1) % len(PEEL_PRIORITY)

    columns: list[list[tuple[str, int]]] = [[], [], [], []]
    solution: list[int] = []
    run_index = -1
    previous_color: str | None = None
    for color, capacity in spools:
        if color != previous_color:
            run_index += 1
        column = COLUMN_WEAVE[run_index % len(COLUMN_WEAVE)]
        columns[column].append((color, capacity))
        solution.append(column)
        previous_color = color
    return columns, solution


def classify_pixels(image: Image.Image) -> np.ndarray:
    rgb = np.asarray(image, dtype=np.float32) / 255
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturation = np.divide(maximum - minimum, maximum, out=np.zeros_like(maximum), where=maximum > 0)
    foreground = (saturation > 0.19) | (maximum < 0.61)
    codes = np.zeros(foreground.shape, dtype=np.uint8)
    codes[foreground & (maximum < 0.42)] = ord("K")

    colored = foreground & (codes == 0)
    ys, xs = np.nonzero(colored)
    for y, x in zip(ys.tolist(), xs.tolist()):
        hue = colorsys.rgb_to_hsv(*rgb[y, x].tolist())[0]
        code = min(HUES, key=lambda candidate: min(abs(hue - HUES[candidate]), 1 - abs(hue - HUES[candidate])))
        codes[y, x] = ord(code)
    return codes


def foreground_bbox(codes: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(codes)
    if not len(xs):
        raise ValueError("Reference tile has no colored subject")
    pad_x = max(2, round((xs.max() - xs.min()) * 0.025))
    pad_y = max(2, round((ys.max() - ys.min()) * 0.025))
    return (
        max(0, int(xs.min()) - pad_x),
        max(0, int(ys.min()) - pad_y),
        min(codes.shape[1], int(xs.max()) + pad_x + 1),
        min(codes.shape[0], int(ys.max()) + pad_y + 1),
    )


def downsample(codes: np.ndarray, resolution: int) -> list[list[str]]:
    x0, y0, x1, y1 = foreground_bbox(codes)
    crop = codes[y0:y1, x0:x1]
    usable = resolution - 4
    scale = min(usable / crop.shape[1], usable / crop.shape[0])
    width = max(1, round(crop.shape[1] * scale))
    height = max(1, round(crop.shape[0] * scale))
    left = (resolution - width) // 2
    top = (resolution - height) // 2
    output = [["." for _ in range(resolution)] for _ in range(resolution)]

    for row in range(height):
        sy0 = int(row * crop.shape[0] / height)
        sy1 = max(sy0 + 1, int((row + 1) * crop.shape[0] / height))
        for col in range(width):
            sx0 = int(col * crop.shape[1] / width)
            sx1 = max(sx0 + 1, int((col + 1) * crop.shape[1] / width))
            block = crop[sy0:sy1, sx0:sx1]
            values = block[block > 0]
            if values.size < block.size * 0.055:
                continue
            counts = np.bincount(values, minlength=256)
            output[top + row][left + col] = chr(int(counts.argmax()))
    return output


def find_grid_phase(codes: np.ndarray, pitch: int) -> tuple[int, int]:
    """Find the lattice origin that keeps photographed stitches inside one cell."""
    height, width = codes.shape
    best = (float("-inf"), 0, 0)
    for offset_y in range(pitch):
        for offset_x in range(pitch):
            dominant = 0
            foreground = 0
            mixed = 0
            occupied = 0
            for y0 in range(offset_y, height - pitch + 1, pitch):
                for x0 in range(offset_x, width - pitch + 1, pitch):
                    block = codes[y0:y0 + pitch, x0:x0 + pitch]
                    values = block[block > 0]
                    if values.size < block.size * 0.12:
                        continue
                    counts = np.bincount(values, minlength=256)
                    primary = int(counts.max())
                    occupied += 1
                    dominant += primary
                    foreground += int(values.size)
                    if primary < values.size * 0.82:
                        mixed += 1
            if not foreground:
                continue
            purity = dominant / foreground
            mixed_ratio = mixed / max(1, occupied)
            score = purity - mixed_ratio * 0.08 + occupied * 1e-7
            best = max(best, (score, offset_y, offset_x))
    return best[1], best[2]


def extract_native_grid(
    image: Image.Image,
    codes: np.ndarray,
    pitch: int,
) -> tuple[list[list[str]], list[list[str]], tuple[int, int]]:
    """Transcribe the photographed stitch lattice without changing its scale or proportions."""
    height, width = codes.shape
    rgb = np.asarray(image, dtype=np.float32) / 255
    offset_y, offset_x = find_grid_phase(codes, pitch)
    output: list[list[str]] = []
    swatches: list[list[str]] = []
    for y0 in range(offset_y, height - pitch + 1, pitch):
        row: list[str] = []
        swatch_row: list[str] = []
        for x0 in range(offset_x, width - pitch + 1, pitch):
            block = codes[y0:y0 + pitch, x0:x0 + pitch]
            values = block[block > 0]
            if values.size < block.size * 0.16:
                row.append(".")
                swatch_row.append("#000000")
                continue
            counts = np.bincount(values, minlength=256)
            dominant = int(counts.argmax())
            row.append(chr(dominant))
            rgb_block = rgb[y0:y0 + pitch, x0:x0 + pitch]
            samples = rgb_block[block == dominant]
            color = np.median(samples, axis=0)
            channels = np.clip(np.round(color * 255), 0, 255).astype(int)
            swatch_row.append("#" + "".join(f"{channel:02x}" for channel in channels))
        output.append(row)
        swatches.append(swatch_row)

    occupied = [(row, col) for row, line in enumerate(output) for col, code in enumerate(line) if code != "."]
    if not occupied:
        raise ValueError("Reference tile has no stitch points")
    min_row = max(0, min(row for row, _ in occupied) - 2)
    max_row = min(len(output) - 1, max(row for row, _ in occupied) + 2)
    min_col = max(0, min(col for _, col in occupied) - 2)
    max_col = min(len(output[0]) - 1, max(col for _, col in occupied) + 2)
    return (
        [line[min_col:max_col + 1] for line in output[min_row:max_row + 1]],
        [line[min_col:max_col + 1] for line in swatches[min_row:max_row + 1]],
        (offset_y + min_row * pitch, offset_x + min_col * pitch),
    )


def extract_level_palette(image: Image.Image, codes: np.ndarray) -> dict[str, str]:
    """Keep mechanical color families stable while sampling each level's visible thread hues."""
    rgb = np.asarray(image, dtype=np.float32) / 255
    palette: dict[str, str] = {}
    for code in PALETTE:
        samples = rgb[codes == ord(code)]
        if not len(samples):
            continue
        hsv = np.array([colorsys.rgb_to_hsv(*sample.tolist()) for sample in samples])
        if code == "K":
            value_limit = np.quantile(hsv[:, 2], 0.55)
            chosen = samples[hsv[:, 2] <= value_limit]
            color = np.median(chosen if len(chosen) else samples, axis=0)
        else:
            saturation_limit = np.quantile(hsv[:, 1], 0.58)
            chosen_hsv = hsv[hsv[:, 1] >= saturation_limit]
            angles = chosen_hsv[:, 0] * np.pi * 2
            hue = (np.arctan2(np.sin(angles).mean(), np.cos(angles).mean()) / (np.pi * 2)) % 1
            saturation = min(1.0, max(0.58, float(np.quantile(chosen_hsv[:, 1], 0.68))))
            value = min(1.0, max(0.62, float(np.quantile(chosen_hsv[:, 2], 0.64))))
            color = np.array(colorsys.hsv_to_rgb(hue, saturation, value))
        channels = np.clip(np.round(color * 255), 0, 255).astype(int)
        palette[code] = "#" + "".join(f"{channel:02x}" for channel in channels)
    return palette


def external_empty(pattern: list[list[str]]) -> set[tuple[int, int]]:
    rows = len(pattern)
    cols = len(pattern[0])
    queue = deque()
    seen: set[tuple[int, int]] = set()
    for row in range(rows):
        for col in (0, cols - 1):
            if pattern[row][col] == ".":
                seen.add((row, col))
                queue.append((row, col))
    for col in range(cols):
        for row in (0, rows - 1):
            if pattern[row][col] == ".":
                seen.add((row, col))
                queue.append((row, col))
    while queue:
        row, col = queue.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = row + dr, col + dc
            if 0 <= nr < rows and 0 <= nc < cols and pattern[nr][nc] == "." and (nr, nc) not in seen:
                seen.add((nr, nc))
                queue.append((nr, nc))
    return seen


def enforce_shell(pattern: list[list[str]], shell: str, layers: int = 2) -> None:
    exterior = external_empty(pattern)
    frontier = set(exterior)
    claimed: set[tuple[int, int]] = set()
    for _ in range(layers):
        next_frontier: set[tuple[int, int]] = set()
        for row, col in frontier:
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nr, nc = row + dr, col + dc
                if not (0 <= nr < len(pattern) and 0 <= nc < len(pattern[0])):
                    continue
                if pattern[nr][nc] == "." or (nr, nc) in claimed:
                    continue
                pattern[nr][nc] = shell
                claimed.add((nr, nc))
                next_frontier.add((nr, nc))
        frontier = next_frontier


def fill_logo_negative_space(pattern: list[list[str]]) -> None:
    exterior = external_empty(pattern)
    for row in range(len(pattern)):
        for col in range(len(pattern[0])):
            if pattern[row][col] == "." and (row, col) not in exterior:
                pattern[row][col] = "Y"


def remove_separator_artifacts(pattern: list[list[str]]) -> None:
    """Drop narrow contact-sheet seams that survive color quantization at the right edge."""
    rows = len(pattern)
    cols = len(pattern[0])
    seen: set[tuple[int, int]] = set()
    for start_row in range(rows):
        for start_col in range(cols):
            if pattern[start_row][start_col] == "." or (start_row, start_col) in seen:
                continue
            queue = deque([(start_row, start_col)])
            component: list[tuple[int, int]] = []
            seen.add((start_row, start_col))
            while queue:
                row, col = queue.popleft()
                component.append((row, col))
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nr, nc = row + dr, col + dc
                    if not (0 <= nr < rows and 0 <= nc < cols):
                        continue
                    if pattern[nr][nc] == "." or (nr, nc) in seen:
                        continue
                    seen.add((nr, nc))
                    queue.append((nr, nc))
            component_cols = [col for _, col in component]
            component_rows = [row for row, _ in component]
            width = max(component_cols) - min(component_cols) + 1
            height = max(component_rows) - min(component_rows) + 1
            if max(component_cols) >= cols - 4 and width <= 3 and height >= 4 and len(component) <= 80:
                for row, col in component:
                    pattern[row][col] = "."


def trim_pattern(pattern: list[list[str]], padding: int = 0) -> list[list[str]]:
    occupied = [(row, col) for row, line in enumerate(pattern) for col, code in enumerate(line) if code != "."]
    if not occupied:
        raise ValueError("Pattern has no stitch points after removing enclaves")
    min_row = max(0, min(row for row, _ in occupied) - padding)
    max_row = min(len(pattern) - 1, max(row for row, _ in occupied) + padding)
    min_col = max(0, min(col for _, col in occupied) - padding)
    max_col = min(len(pattern[0]) - 1, max(col for _, col in occupied) + padding)
    return [line[min_col:max_col + 1] for line in pattern[min_row:max_row + 1]]


def retain_closed_main_figure(pattern: list[list[str]]) -> list[list[str]]:
    """Keep the figure envelope and remove only detached pieces outside that envelope."""
    rows = len(pattern)
    cols = len(pattern[0])
    seen: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []
    for start_row in range(rows):
        for start_col in range(cols):
            if pattern[start_row][start_col] == "." or (start_row, start_col) in seen:
                continue
            queue = deque([(start_row, start_col)])
            component: list[tuple[int, int]] = []
            seen.add((start_row, start_col))
            while queue:
                row, col = queue.popleft()
                component.append((row, col))
                for dr, dc in ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)):
                    nr, nc = row + dr, col + dc
                    if not (0 <= nr < rows and 0 <= nc < cols):
                        continue
                    if pattern[nr][nc] == "." or (nr, nc) in seen:
                        continue
                    seen.add((nr, nc))
                    queue.append((nr, nc))
            components.append(component)
    if not components:
        raise ValueError("Pattern has no closed stitch figure")

    def bounds(component: list[tuple[int, int]]) -> tuple[int, int, int, int]:
        return (
            min(row for row, _ in component),
            max(row for row, _ in component),
            min(col for _, col in component),
            max(col for _, col in component),
        )

    main = max(components, key=lambda component: (
        (bounds(component)[1] - bounds(component)[0] + 1) * (bounds(component)[3] - bounds(component)[2] + 1),
        len(component),
    ))
    min_row, max_row, min_col, max_col = bounds(main)
    for component in components:
        if component is main:
            continue
        if len(component) < 12:
            for row, col in component:
                pattern[row][col] = "."
            continue
        center_row = sum(row for row, _ in component) / len(component)
        center_col = sum(col for _, col in component) / len(component)
        belongs_to_figure = min_row <= center_row <= max_row and min_col <= center_col <= max_col
        if not belongs_to_figure:
            for row, col in component:
                pattern[row][col] = "."
    return pattern


def trim_parallel(
    pattern: list[list[str]],
    swatches: list[list[str]],
) -> tuple[list[list[str]], list[list[str]], int, int]:
    occupied = [(row, col) for row, line in enumerate(pattern) for col, code in enumerate(line) if code != "."]
    if not occupied:
        raise ValueError("Pattern has no stitch points after cleanup")
    min_row = min(row for row, _ in occupied)
    max_row = max(row for row, _ in occupied)
    min_col = min(col for _, col in occupied)
    max_col = max(col for _, col in occupied)
    return (
        [line[min_col:max_col + 1] for line in pattern[min_row:max_row + 1]],
        [line[min_col:max_col + 1] for line in swatches[min_row:max_row + 1]],
        min_row,
        min_col,
    )


def save_source_texture(
    key: str,
    tile: Image.Image,
    pattern: list[list[str]],
    origin: tuple[int, int],
    pitch: int,
) -> None:
    """Preserve the approved source stitch texture cell-for-cell with transparent empty cells."""
    top, left = origin
    width = len(pattern[0]) * pitch
    height = len(pattern) * pitch
    source = tile.convert("RGBA").crop((left, top, left + width, top + height))
    alpha = Image.new("L", (width, height), 0)
    alpha_draw = ImageDraw.Draw(alpha)
    for row, line in enumerate(pattern):
        for col, code in enumerate(line):
            if code == ".":
                continue
            alpha_draw.rectangle(
                (col * pitch, row * pitch, (col + 1) * pitch - 1, (row + 1) * pitch - 1),
                fill=255,
            )
    source.putalpha(alpha)
    PATTERN_TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    source.save(PATTERN_TEXTURE_DIR / f"{key}.png")


def validate_no_enclaves(pattern: list[list[str]], level: str) -> None:
    """No surviving component may sit outside the main figure's spatial envelope."""
    rows = len(pattern)
    cols = len(pattern[0])
    seen: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []
    for start_row in range(rows):
        for start_col in range(cols):
            if pattern[start_row][start_col] == "." or (start_row, start_col) in seen:
                continue
            component: list[tuple[int, int]] = []
            queue = deque([(start_row, start_col)])
            seen.add((start_row, start_col))
            while queue:
                row, col = queue.popleft()
                component.append((row, col))
                for dr, dc in ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)):
                    point = (row + dr, col + dc)
                    if not (0 <= point[0] < rows and 0 <= point[1] < cols):
                        continue
                    if pattern[point[0]][point[1]] == "." or point in seen:
                        continue
                    seen.add(point)
                    queue.append(point)
            components.append(component)
    if not components:
        raise ValueError(f"Level {level} has no stitches")
    def bounds(component: list[tuple[int, int]]) -> tuple[int, int, int, int]:
        return min(row for row, _ in component), max(row for row, _ in component), min(col for _, col in component), max(col for _, col in component)
    main = max(components, key=lambda component: ((bounds(component)[1] - bounds(component)[0] + 1) * (bounds(component)[3] - bounds(component)[2] + 1), len(component)))
    min_row, max_row, min_col, max_col = bounds(main)
    outside = []
    for component in components:
        center_row = sum(row for row, _ in component) / len(component)
        center_col = sum(col for _, col in component) / len(component)
        if not (min_row <= center_row <= max_row and min_col <= center_col <= max_col):
            outside.extend(component)
    if outside:
        raise ValueError(f"Level {level} still contains {len(outside)} external enclave stitches")


def pattern_metrics(pattern: list[list[str]]) -> tuple[int, int, int, int]:
    colors = {code for row in pattern for code in row if code != "."}
    exterior = external_empty(pattern)
    exposed = set()
    for row, col in exterior:
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nr, nc = row + dr, col + dc
            if 0 <= nr < len(pattern) and 0 <= nc < len(pattern[0]):
                code = pattern[nr][nc]
                if code != ".":
                    exposed.add(code)
    transitions = 0
    stitches = 0
    for row, line in enumerate(pattern):
        for col, code in enumerate(line):
            if code == ".":
                continue
            stitches += 1
            for dr, dc in ((0, 1), (1, 0)):
                nr, nc = row + dr, col + dc
                if nr < len(pattern) and nc < len(line):
                    neighbor = pattern[nr][nc]
                    if neighbor != "." and neighbor != code:
                        transitions += 1
    return len(colors), len(exposed), transitions, stitches


def mix_color(color: str, target: str, amount: float) -> str:
    source_channels = [int(color[index:index + 2], 16) for index in (1, 3, 5)]
    target_channels = [int(target[index:index + 2], 16) for index in (1, 3, 5)]
    mixed = [round(source + (destination - source) * amount) for source, destination in zip(source_channels, target_channels)]
    return "#" + "".join(f"{channel:02x}" for channel in mixed)


def draw_stitch(draw: ImageDraw.ImageDraw, x: float, y: float, cell: float, color: str) -> None:
    pad = max(0.25, cell * 0.14)
    dark = mix_color(color, "#17151c", 0.38)
    light = mix_color(color, "#fff7e8", 0.54)
    shadow = mix_color(color, "#3b3038", 0.66)
    shadow_width = max(1, round(cell * 0.56))
    dark_width = max(1, round(cell * 0.48))
    color_width = max(1, round(cell * 0.33))
    light_width = max(1, round(cell * 0.09))
    offset = max(0.25, cell * 0.06)
    segments = (
        (x + pad, y + pad, x + cell - pad, y + cell - pad),
        (x + cell - pad, y + pad, x + pad, y + cell - pad),
    )
    for segment in segments:
        draw.line((segment[0], segment[1] + offset, segment[2], segment[3] + offset), fill=shadow, width=shadow_width)
    for segment in segments:
        draw.line(segment, fill=dark, width=dark_width)
    for segment in segments:
        draw.line(segment, fill=color, width=color_width)
    for segment in segments:
        draw.line((segment[0], segment[1] - offset, segment[2], segment[3] - offset), fill=light, width=light_width)


def render_preview(patterns: dict[int, list[str]], palettes: dict[int, dict[str, str]]) -> None:
    tile = 220
    columns = 4
    rows = (len(patterns) + columns - 1) // columns
    image = Image.new("RGB", (columns * tile, rows * tile), "#FFF9EC")
    draw = ImageDraw.Draw(image)
    for level, pattern in patterns.items():
        offset_x = ((level - 1) % columns) * tile
        offset_y = ((level - 1) // columns) * tile
        cell = min(188 / len(pattern[0]), 188 / len(pattern))
        left = offset_x + (tile - len(pattern[0]) * cell) / 2
        top = offset_y + 20 + (188 - len(pattern) * cell) / 2
        for row, line in enumerate(pattern):
            for col, code in enumerate(line):
                if code == ".":
                    continue
                x = left + col * cell
                y = top + row * cell
                color = palettes[level].get(code, PALETTE[code])
                draw_stitch(draw, x, y, cell, color)
        draw.text((offset_x + 8, offset_y + 5), f"{level:02d} · {len(pattern[0])}×{len(pattern)}", fill="#3B3A47")
    image.save(PREVIEW)


def render_crop_audit(tiles: dict[int, Image.Image]) -> None:
    tile_size = 220
    columns = 4
    rows = (len(tiles) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * tile_size, rows * tile_size), "#F4F0E8")
    draw = ImageDraw.Draw(sheet)
    for level, source in tiles.items():
        offset_x = ((level - 1) % columns) * tile_size
        offset_y = ((level - 1) // columns) * tile_size
        preview = source.copy()
        preview.thumbnail((200, 188), Image.Resampling.LANCZOS)
        left = offset_x + (tile_size - preview.width) // 2
        top = offset_y + 22 + (188 - preview.height) // 2
        sheet.paste(preview, (left, top))
        draw.rectangle((left, top, left + preview.width - 1, top + preview.height - 1), outline="#E85B67", width=1)
        draw.text((offset_x + 8, offset_y + 5), f"{level:02d} · {source.width}×{source.height}", fill="#3B3A47")
    sheet.save(CROP_AUDIT)


def render_square_audits(ordered: list[tuple[str, list[str]]], palettes: dict[str, dict[str, str]]) -> None:
    """Render the actual 1:1 circular game composition, one complete level per file."""
    SQUARE_AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    for previous in SQUARE_AUDIT_DIR.glob("*.png"):
        previous.unlink()
    size = 512
    center = size / 2
    fabric_radius = 218
    for level, (key, pattern) in enumerate(ordered, start=1):
        image = Image.new("RGB", (size, size), "#FFF9EC")
        draw = ImageDraw.Draw(image)
        draw.ellipse(
            (center - 232, center - 232, center + 232, center + 232),
            fill="#D9A768",
            outline="#8E5E37",
            width=8,
        )
        draw.ellipse(
            (center - fabric_radius, center - fabric_radius, center + fabric_radius, center + fabric_radius),
            fill="#FFF9EC",
            outline="#E8D8B8",
            width=4,
        )
        rows = len(pattern)
        cols = len(pattern[0])
        occupied = [
            (row, col)
            for row, line in enumerate(pattern)
            for col, code in enumerate(line)
            if code != "."
        ]
        occupied_radius = max(
            1.0,
            max(
                ((col + 0.5 - cols / 2) ** 2 + (row + 0.5 - rows / 2) ** 2) ** 0.5 + 2 ** -0.5
                for row, col in occupied
            ),
        )
        cell = (fabric_radius - 12) / occupied_radius
        left = center - cols * cell / 2
        top = center - rows * cell / 2
        weave = max(3.2, cell)
        start = center - int(fabric_radius / weave + 1) * weave
        fibre_light = "#fffdf7"
        fibre_shadow = "#d8c9af"
        for x in np.arange(start, center + fabric_radius, weave):
            distance = abs(x - center)
            if distance >= fabric_radius:
                continue
            chord = (fabric_radius ** 2 - distance ** 2) ** 0.5
            draw.line((x - weave * 0.1, center - chord, x - weave * 0.1, center + chord), fill=fibre_light, width=max(1, round(weave * 0.12)))
            draw.line((x + weave * 0.12, center - chord, x + weave * 0.12, center + chord), fill=fibre_shadow, width=max(1, round(weave * 0.08)))
        for y in np.arange(start, center + fabric_radius, weave):
            distance = abs(y - center)
            if distance >= fabric_radius:
                continue
            chord = (fabric_radius ** 2 - distance ** 2) ** 0.5
            draw.line((center - chord, y - weave * 0.1, center + chord, y - weave * 0.1), fill=fibre_light, width=max(1, round(weave * 0.12)))
            draw.line((center - chord, y + weave * 0.12, center + chord, y + weave * 0.12), fill=fibre_shadow, width=max(1, round(weave * 0.08)))
        hole_radius = max(0.45, min(1.2, weave * 0.1))
        for y in np.arange(start, center + fabric_radius, weave):
            for x in np.arange(start, center + fabric_radius, weave):
                if (x - center) ** 2 + (y - center) ** 2 >= (fabric_radius - 1) ** 2:
                    continue
                draw.ellipse((x - hole_radius, y - hole_radius, x + hole_radius, y + hole_radius), fill="#b9aa91")
        for row, line in enumerate(pattern):
            for col, code in enumerate(line):
                if code == ".":
                    continue
                x = left + col * cell
                y = top + row * cell
                color = palettes[key].get(code, PALETTE[code])
                draw_stitch(draw, x, y, cell, color)
        image.save(SQUARE_AUDIT_DIR / f"{level:02d}-{key}.png")


def main() -> None:
    PATTERN_TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    for previous in PATTERN_TEXTURE_DIR.glob("*.png"):
        previous.unlink()
    loaded: dict[str, Image.Image] = {}
    source_patterns: dict[str, list[str]] = {}
    source_tiles: dict[str, Image.Image] = {}
    source_palettes: dict[str, dict[str, str]] = {}
    for key, filename, columns, rows, tile_index, pitch in SOURCES:
        image = loaded.setdefault(filename, Image.open(REFERENCES / filename).convert("RGB"))
        tile = tile_crop(image, columns, rows, tile_index)
        source_tiles[key] = tile
        codes = classify_pixels(tile)
        pattern, swatches, origin = extract_native_grid(tile, codes, pitch)
        remove_separator_artifacts(pattern)
        pattern = retain_closed_main_figure(pattern)
        pattern, swatches, trim_row, trim_col = trim_parallel(pattern, swatches)
        origin = (origin[0] + trim_row * pitch, origin[1] + trim_col * pitch)
        validate_no_enclaves(pattern, key)
        source_patterns[key] = ["".join(row) for row in pattern]
        source_palettes[key] = extract_level_palette(tile, codes)
        save_source_texture(key, tile, source_patterns[key], origin, pitch)

    ordered = sorted(
        source_patterns.items(),
        key=lambda item: pattern_metrics(item[1]),
    )
    patterns = {level: pattern for level, (_, pattern) in enumerate(ordered, start=1)}
    cropped_tiles = {level: source_tiles[key] for level, (key, _) in enumerate(ordered, start=1)}
    ordered_palettes = {level: source_palettes[key] for level, (key, _) in enumerate(ordered, start=1)}

    lines = [
        "// Generated by scripts/generate-stitch-patterns.py from the approved art-direction sheets.",
        "// Do not hand-edit: update the source mapping or quantizer and regenerate.",
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
        "export const GENERATED_PATTERNS: GeneratedPattern[] = [",
    ]
    order_lines = [
        "# Generated level order",
        "",
        "Primary sort is actual color count; ties use exposed colors, color transitions, then stitch count.",
        "",
        "| Level | Pattern | Colors | Exposed | Transitions | Stitches |",
        "| ---: | --- | ---: | ---: | ---: | ---: |",
    ]
    for level, (key, pattern) in enumerate(ordered, start=1):
        colors, exposed, transitions, stitches = pattern_metrics(pattern)
        lines.append("  {")
        lines.append(f"    key: '{key}',")
        lines.append(f"    colorCount: {colors}, exposedColorCount: {exposed}, transitions: {transitions}, stitchCount: {stitches},")
        palette_literal = ", ".join(f"{code}: '{color}'" for code, color in source_palettes[key].items())
        lines.append(f"    palette: {{ {palette_literal} }},")
        columns, solution = build_spool_plan(pattern)
        column_literal = ", ".join(
            "[" + ", ".join(f"['{code}', {capacity}]" for code, capacity in column) + "]"
            for column in columns
        )
        lines.append(f"    columns: [{column_literal}],")
        lines.append(f"    solution: {solution},")
        lines.append("    rows: [")
        lines.extend(f"    '{row}'," for row in pattern)
        lines.append("    ],")
        lines.append("  },")
        order_lines.append(f"| {level} | `{key}` | {colors} | {exposed} | {transitions} | {stitches} |")
    lines.append("]")
    OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    ORDER_AUDIT.write_text("\n".join(order_lines) + "\n", encoding="utf-8")
    render_preview(patterns, ordered_palettes)
    render_crop_audit(cropped_tiles)
    render_square_audits(ordered, source_palettes)
    print(f"wrote {OUTPUT}")
    print(f"wrote {PREVIEW}")
    print(f"wrote {CROP_AUDIT}")
    print(f"wrote {SQUARE_AUDIT_DIR}")
    print(f"wrote {ORDER_AUDIT}")
    for level, (key, pattern) in enumerate(ordered, start=1):
        colors, exposed, transitions, stitches = pattern_metrics(pattern)
        print(f"{level:02d} {key}: colors={colors} exposed={exposed} transitions={transitions} stitches={stitches}")


if __name__ == "__main__":
    main()
