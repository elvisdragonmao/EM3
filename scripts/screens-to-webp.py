#!/usr/bin/env python3
"""Convert capture-screens.mjs PNGs into WebP files in public/screens/.

Usage: python3 scripts/screens-to-webp.py <png-dir>

Shots are captured at 2x (desktop 1920×1080 → 3840×2160) and then scaled to
twice the widest size they are shown at, on the landing page or in the README
(GitHub's README column is at most 1012 CSS px). Phone shots (iPhone 17 Pro,
1206×2622) are placed inside scripts/assets/iphone17pro.png, whose transparent
screen area is used as the mask, before scaling. Everything is WebP at quality 80.

Usage on already converted files: python3 scripts/screens-to-webp.py --resize
"""
import os, sys
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1]
DST = os.path.join(ROOT, "public", "screens")
FRAME = Image.open(os.path.join(ROOT, "scripts", "assets", "iphone17pro.png")).convert("RGBA")
# 2 × the widest CSS width each shot is displayed at (landing page at 1920 px; README).
WIDTHS = {
    "dashboard": 2230,  # landing hero, 1115 px
    "materials": 2024,  # README full width
    "submit": 2024,
    "courses": 2024,
    "grading": 2024,
    "timetable": 1750,  # landing feature, 875 px
    "shortcuts": 1550,  # landing, 775 px
    "quiz": 1076,  # landing pair, 538 px
    "announce": 1076,
    "mobile-dashboard": 660,  # README 34% cell, ~330 px
    "mobile-course": 480,  # landing, 240 px
}


def target_width(name):
    return WIDTHS[name.rsplit("-", 1)[0]]


def fit(im, name):
    w = target_width(name)
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) if im.width > w else im


def screen_mask(frame):
    """Flood-fill the see-through screen from its centre; mask = how transparent each pixel is."""
    w, h = frame.size
    alpha = frame.getchannel("A")
    px = alpha.load()
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    seen = bytearray(w * h)
    q = deque([(w // 2, h // 2)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        a = px[x, y]
        if a >= 250:
            continue
        mp[x, y] = 255 - a
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return mask


MASK = screen_mask(FRAME)
BOX = MASK.getbbox()


def in_phone(shot):
    canvas = Image.new("RGBA", FRAME.size, (0, 0, 0, 0))
    left, top, right, bottom = BOX
    fitted = shot.convert("RGB").resize((right - left, bottom - top), Image.LANCZOS)
    layer = Image.new("RGBA", FRAME.size, (0, 0, 0, 0))
    layer.paste(fitted, (left, top))
    canvas.paste(layer, (0, 0), MASK)
    canvas.alpha_composite(FRAME)
    return canvas


if SRC == "--resize":
    for name in sorted(os.listdir(DST)):
        if name.endswith(".webp"):
            path = os.path.join(DST, name)
            im = Image.open(path)
            # Re-encoding a WebP loses quality, so files already at size are left alone.
            if im.width <= target_width(name[:-5]):
                continue
            im = fit(im, name[:-5])
            im.save(path, "WEBP", quality=80, method=6)
            print(f"{path}  {im.width}x{im.height}  {os.path.getsize(path) // 1024} KB")
    sys.exit()

os.makedirs(DST, exist_ok=True)
for name in sorted(os.listdir(SRC)):
    if not name.endswith(".png") or name.startswith("combo"):
        continue
    im = Image.open(os.path.join(SRC, name))
    im = in_phone(im) if name.startswith("mobile") else im.convert("RGB")
    im = fit(im, name[:-4])
    out = os.path.join(DST, name[:-4] + ".webp")
    im.save(out, "WEBP", quality=80, method=6)
    print(f"{out}  {im.width}x{im.height}  {os.path.getsize(out) // 1024} KB")
