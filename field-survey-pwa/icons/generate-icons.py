"""Tạo icon PNG PWA với logo clipboard + location pin."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

BG_TOP = (11, 58, 53, 255)
BG_BOTTOM = (20, 107, 96, 255)
PAPER_TOP = (244, 255, 252, 255)
PAPER_BOTTOM = (223, 242, 237, 255)
PRIMARY = (15, 110, 98, 255)
MUTED = (156, 201, 192, 255)
ACCENT = (245, 158, 11, 255)
ACCENT_LIGHT = (255, 246, 223, 255)
CLIP = (10, 79, 71, 255)
CHECK = (234, 248, 244, 255)


def png(width: int, height: int, rgba_rows: list[bytes]) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\x00" + row for row in rgba_rows)
    return b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)),
            chunk(b"IDAT", zlib.compress(raw, 9)),
            chunk(b"IEND", b""),
        ]
    )


def fill(px: list[list[tuple[int, int, int, int]]], x0, y0, x1, y1, color, radius=0):
    for y in range(y0, y1):
        for x in range(x0, x1):
            if 0 <= y < len(px) and 0 <= x < len(px[0]):
                if radius:
                    dx = min(x - x0, x1 - 1 - x)
                    dy = min(y - y0, y1 - 1 - y)
                    if dx < radius and dy < radius:
                        if (radius - dx) ** 2 + (radius - dy) ** 2 > radius * radius:
                            continue
                px[y][x] = color


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def vertical_gradient(px, x0, y0, x1, y1, top, bottom, radius=0):
    height = max(1, y1 - y0 - 1)
    for y in range(y0, y1):
        t = (y - y0) / height
        color = tuple(lerp(top[i], bottom[i], t) for i in range(4))
        fill(px, x0, y, x1, y + 1, color, radius=radius if y in (y0, y1 - 1) else 0)


def draw_circle(px, cx, cy, r, color):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if 0 <= y < len(px) and 0 <= x < len(px[0]) and (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                px[y][x] = color


def draw_check(px, x, y, scale, color):
    for i in range(scale):
        for w in range(max(1, scale // 4)):
            x1 = x + i
            y1 = y + i + w
            x2 = x + scale + i
            y2 = y + scale - i + w
            if 0 <= y1 < len(px) and 0 <= x1 < len(px[0]):
                px[y1][x1] = color
            if 0 <= y2 < len(px) and 0 <= x2 < len(px[0]):
                px[y2][x2] = color


def draw_pin(px, cx, cy, size, color, center_color):
    r = max(8, size // 2)
    tip_y = cy + int(r * 1.8)
    for y in range(cy - r, tip_y + 1):
        for x in range(cx - int(r * 1.25), cx + int(r * 1.25) + 1):
            if not (0 <= y < len(px) and 0 <= x < len(px[0])):
                continue
            inside_circle = (x - cx) ** 2 + (y - cy) ** 2 <= r * r
            inside_tail = y >= cy and abs(x - cx) <= max(1, (tip_y - y) * 0.55)
            if inside_circle or inside_tail:
                px[y][x] = color
    draw_circle(px, cx, cy, max(4, size // 4), center_color)


def draw_icon(size: int, maskable: bool = False) -> bytes:
    px = [[BG_TOP for _ in range(size)] for _ in range(size)]
    vertical_gradient(px, 0, 0, size, size, BG_TOP, BG_BOTTOM)

    fill(px, int(size * 0.66), int(size * 0.08), int(size * 0.90), int(size * 0.32), (*ACCENT[:3], 48))
    fill(px, int(size * 0.06), int(size * 0.68), int(size * 0.34), int(size * 0.94), (52, 211, 153, 36))

    inset = int(size * 0.20) if maskable else int(size * 0.18)
    paper = (inset, int(size * 0.18), int(size * 0.76), int(size * 0.82))
    vertical_gradient(px, *paper, PAPER_TOP, PAPER_BOTTOM, radius=max(10, size // 16))

    clip = (
        int(size * 0.40),
        int(size * 0.13),
        int(size * 0.60),
        int(size * 0.21),
    )
    fill(px, *clip, CLIP, radius=max(8, size // 28))

    fill(px, int(size * 0.30), int(size * 0.29), int(size * 0.53), int(size * 0.325), PRIMARY, radius=max(4, size // 64))
    fill(px, int(size * 0.30), int(size * 0.365), int(size * 0.61), int(size * 0.40), MUTED, radius=max(4, size // 64))

    r = max(7, size // 32)
    cx = int(size * 0.34)
    cy1 = int(size * 0.48)
    cy2 = int(size * 0.59)
    draw_circle(px, cx, cy1, r, PRIMARY)
    draw_circle(px, cx, cy2, r, PRIMARY)
    draw_check(px, cx - r // 2, cy1 - r // 3, max(4, size // 48), CHECK)
    draw_check(px, cx - r // 2, cy2 - r // 3, max(4, size // 48), CHECK)
    fill(px, int(size * 0.40), cy1 - max(3, size // 96), int(size * 0.62), cy1 + max(3, size // 96), MUTED, radius=max(4, size // 64))
    fill(px, int(size * 0.40), cy2 - max(3, size // 96), int(size * 0.57), cy2 + max(3, size // 96), MUTED, radius=max(4, size // 64))

    draw_pin(px, int(size * 0.70), int(size * 0.58), max(20, size // 9), ACCENT, ACCENT_LIGHT)

    rows = [b"".join(bytes(pixel) for pixel in row) for row in px]
    return png(size, size, rows)


def main() -> None:
    out = Path(__file__).resolve().parent
    (out / "icon-192.png").write_bytes(draw_icon(192, False))
    (out / "icon-512.png").write_bytes(draw_icon(512, False))
    (out / "icon-192-maskable.png").write_bytes(draw_icon(192, True))
    (out / "icon-512-maskable.png").write_bytes(draw_icon(512, True))
    print("Generated PWA icons in", out)


if __name__ == "__main__":
    main()
