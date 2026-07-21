#!/usr/bin/env python3
"""Regenerates the extension icons.

The mark is a header line above an arrow: a header being rewritten in flight.
Lime tile with dark marks, so it reads on both light and dark browser toolbars.

The geometry is defined on a 16x16 grid, because 16px is the size Chrome shows
in the toolbar and it is the size that constrains the design. Every shape lands
on whole grid units, so the larger sizes (which are exact multiples of 16) stay
crisp instead of picking up half-pixel blur.

Drawing the icon large and downscaling does not work here: the arrowhead
collapses into a 1px nub at 16px.

Usage: python3 tools/generate-icons.py
"""

import os
from PIL import Image, ImageDraw

LIME = (164, 196, 0, 255)   # matches --accent of the dark theme in popup.css
INK = (20, 22, 26, 255)     # matches --accent-ink; 9:1 against the lime

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "icons")
SIZES = (16, 32, 48, 128)

# Rectangles on the 16x16 grid as (x0, y0, x1, y1), end-exclusive.
BARS = [
    (3, 4, 12, 6),    # the untouched header line
    (3, 10, 9, 12),   # shaft of the modified one
]

# Arrowhead, as (column, y0, y1) end-exclusive. Tapers 6 -> 4 -> 2 rows so it
# stays a recognisable triangle even when each column is a single pixel.
HEAD = [
    (9, 8, 14),
    (10, 9, 13),
    (11, 10, 12),
]


def draw_icon(size):
    if size % 16:
        raise ValueError(f"{size}px is not a multiple of the 16px design grid")
    unit = size // 16

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Square tile, matching the sharp-edged panel.
    d.rectangle([0, 0, size - 1, size - 1], fill=LIME)

    for x0, y0, x1, y1 in BARS:
        d.rectangle([x0 * unit, y0 * unit, x1 * unit - 1, y1 * unit - 1], fill=INK)

    for col, y0, y1 in HEAD:
        d.rectangle([col * unit, y0 * unit, (col + 1) * unit - 1, y1 * unit - 1], fill=INK)

    return img


if __name__ == "__main__":
    for size in SIZES:
        draw_icon(size).save(os.path.join(OUT_DIR, f"icon{size}.png"))
        print(f"icons/icon{size}.png")
