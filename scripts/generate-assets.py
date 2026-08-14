#!/usr/bin/env python3
"""Generate Roomtone's deterministic PNG assets using only the Python standard library."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path
from typing import Callable

Color = tuple[int, int, int, int]

INK: Color = (15, 18, 23, 255)
PAPER: Color = (244, 241, 234, 255)
TRANSPARENT: Color = (0, 0, 0, 0)


def png_chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


def write_png(path: Path, width: int, height: int, pixels: bytearray) -> None:
    stride = width * 4
    rows = bytearray()
    for y in range(height):
        rows.append(0)
        rows.extend(pixels[y * stride : (y + 1) * stride])
    payload = b"\x89PNG\r\n\x1a\n"
    payload += png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    payload += png_chunk(b"IDAT", zlib.compress(bytes(rows), level=9))
    payload += png_chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def canvas(width: int, height: int, color: Color) -> bytearray:
    return bytearray(color * (width * height))


def set_pixel(pixels: bytearray, width: int, x: int, y: int, color: Color) -> None:
    if x < 0 or y < 0 or x >= width:
        return
    index = (y * width + x) * 4
    if index < 0 or index + 4 > len(pixels):
        return
    pixels[index : index + 4] = bytes(color)


def draw_circle(pixels: bytearray, width: int, height: int, cx: int, cy: int, radius: int, color: Color) -> None:
    r2 = radius * radius
    for y in range(max(0, cy - radius), min(height, cy + radius + 1)):
        dy2 = (y - cy) * (y - cy)
        for x in range(max(0, cx - radius), min(width, cx + radius + 1)):
            if (x - cx) * (x - cx) + dy2 <= r2:
                set_pixel(pixels, width, x, y, color)


def draw_round_bar(
    pixels: bytearray,
    width: int,
    height: int,
    cx: int,
    cy: int,
    bar_width: int,
    bar_height: int,
    color: Color,
) -> None:
    radius = bar_width // 2
    x0 = cx - radius
    x1 = cx + radius
    y0 = cy - bar_height // 2 + radius
    y1 = cy + bar_height // 2 - radius
    for y in range(max(0, y0), min(height, y1 + 1)):
        for x in range(max(0, x0), min(width, x1 + 1)):
            set_pixel(pixels, width, x, y, color)
    draw_circle(pixels, width, height, cx, y0, radius, color)
    draw_circle(pixels, width, height, cx, y1, radius, color)


def draw_mark(pixels: bytearray, width: int, height: int, color: Color, scale: float = 1.0) -> None:
    center_x = width // 2
    center_y = height // 2
    bar_width = max(4, int(min(width, height) * 0.055 * scale))
    gap = int(bar_width * 1.55)
    heights = [0.22, 0.38, 0.58, 0.78, 0.58, 0.38, 0.22]
    base = min(width, height) * scale
    for index, ratio in enumerate(heights):
        cx = center_x + (index - 3) * gap
        draw_round_bar(pixels, width, height, cx, center_y, bar_width, int(base * ratio), color)


def build_icon(size: int, background: Color, foreground: Color, scale: float) -> bytearray:
    pixels = canvas(size, size, background)
    draw_mark(pixels, size, size, foreground, scale)
    return pixels


def main() -> None:
    assets = Path(__file__).resolve().parents[1] / "assets"

    write_png(assets / "icon.png", 1024, 1024, build_icon(1024, INK, PAPER, 0.62))
    write_png(assets / "adaptive-icon.png", 1024, 1024, build_icon(1024, TRANSPARENT, INK, 0.54))
    write_png(assets / "favicon.png", 64, 64, build_icon(64, INK, PAPER, 0.70))

    splash_width, splash_height = 1284, 2778
    splash = canvas(splash_width, splash_height, PAPER)
    draw_mark(splash, splash_width, splash_height, INK, 0.24)
    write_png(assets / "splash.png", splash_width, splash_height, splash)

    for path in sorted(assets.glob("*.png")):
        print(f"generated {path.relative_to(assets.parent)} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
