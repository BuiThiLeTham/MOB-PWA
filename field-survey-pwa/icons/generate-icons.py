"""Tạo icon PNG PWA (stdlib only) từ thiết kế clipboard trên nền teal."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

TEAL = (12, 61, 54, 255)
PAPER = (231, 246, 242, 255)
PRIMARY = (15, 110, 98, 255)
MUTED = (156, 201, 192, 255)
ACCENT = (217, 119, 6, 255)
WHITE = (231, 246, 242, 255)


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


def draw_icon(size: int, maskable: bool = False) -> bytes:
    px = [[TEAL for _ in range(size)] for _ in range(size)]
    # Safe zone for maskable: keep artwork in the center 80%.
    inset = int(size * 0.18) if maskable else int(size * 0.18)
    paper = (
        inset,
        int(size * 0.16),
        size - inset,
        int(size * 0.86),
    )
    fill(px, *paper, PAPER, radius=max(8, size // 18))

    bar_y0 = int(size * 0.24)
    fill(
        px,
        inset + int(size * 0.08),
        bar_y0,
        size - inset - int(size * 0.08),
        bar_y0 + max(6, size // 22),
        PRIMARY,
        radius=4,
    )

    for i, width_ratio in enumerate((0.42, 0.50)):
        y = int(size * (0.36 + i * 0.08))
        fill(
            px,
            inset + int(size * 0.08),
            y,
            inset + int(size * (0.08 + width_ratio)),
            y + max(4, size // 36),
            MUTED,
            radius=3,
        )

    cy = int(size * 0.58)
    r = max(6, size // 22)
    cx = inset + int(size * 0.12)
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                px[y][x] = PRIMARY
    fill(
        px,
        cx + r + 6,
        cy - max(3, size // 50),
        cx + int(size * 0.42),
        cy + max(3, size // 50),
        MUTED,
        radius=3,
    )

    cy2 = int(size * 0.70)
    for y in range(cy2 - r, cy2 + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy2) ** 2 <= r * r:
                px[y][x] = ACCENT
    fill(
        px,
        cx + r + 6,
        cy2 - max(3, size // 50),
        cx + int(size * 0.36),
        cy2 + max(3, size // 50),
        MUTED,
        radius=3,
    )

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
