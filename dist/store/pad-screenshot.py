#!/usr/bin/env python3
"""Pads a popup screenshot to Chrome Web Store dimensions.

The popup is 720px wide, so a raw capture is never 1280x800. This centres the
capture on a canvas of the right size with a matching background and a soft
shadow, so it reads as a floating panel rather than a cropped rectangle.

Usage:
  python3 tools/pad-screenshot.py shot.png
  python3 tools/pad-screenshot.py shot.png --theme dark
  python3 tools/pad-screenshot.py shot.png --size 640x400

Writes <name>-1280x800.png next to the input.
"""

import argparse
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    print("error: Pillow is required (pip install Pillow)", file=sys.stderr)
    raise SystemExit(1)

BACKGROUNDS = {"light": (243, 244, 247), "dark": (18, 20, 23)}
SHADOWS = {"light": (0, 0, 0, 40), "dark": (0, 0, 0, 120)}


def guess_theme(img):
    """Sample the top-left corner; the popup header is light or near-black."""
    r, g, b = img.convert("RGB").getpixel((2, 2))
    return "light" if (r + g + b) / 3 > 128 else "dark"


def pad(path, theme, size):
    img = Image.open(path).convert("RGBA")
    width, height = size

    if img.width > width or img.height > height:
        print(f"error: {img.width}x{img.height} does not fit in {width}x{height}",
              file=sys.stderr)
        return None

    theme = theme or guess_theme(img)
    canvas = Image.new("RGBA", size, BACKGROUNDS[theme] + (255,))
    x, y = (width - img.width) // 2, (height - img.height) // 2

    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle(
        [x, y + 8, x + img.width, y + img.height + 12], fill=SHADOWS[theme])
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(20)))
    canvas.paste(img, (x, y), img)

    stem, _ = os.path.splitext(path)
    out = f"{stem}-{width}x{height}.png"
    # No alpha: the Web Store rejects transparency.
    canvas.convert("RGB").save(out)
    print(f"{img.width}x{img.height} ({theme}) -> {out}")
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", help="screenshot of the popup")
    parser.add_argument("--theme", choices=("light", "dark"),
                        help="background to pad with (default: detect)")
    parser.add_argument("--size", default="1280x800", help="1280x800 or 640x400")
    args = parser.parse_args()

    try:
        width, height = (int(n) for n in args.size.lower().split("x"))
    except ValueError:
        print(f"error: bad --size {args.size!r}, expected WIDTHxHEIGHT", file=sys.stderr)
        return 1

    return 0 if pad(args.image, args.theme, (width, height)) else 1


if __name__ == "__main__":
    sys.exit(main())
