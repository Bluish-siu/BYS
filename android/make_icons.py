"""Builds the Android launcher icons from the PickMySeat seat logo (docs/brand/make_brand.py).

Run from the project folder:  python android/make_icons.py
Needs:  pip install pillow
"""
import importlib.util
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
spec = importlib.util.spec_from_file_location("brand", os.path.join(ROOT, "docs", "brand", "make_brand.py"))
brand = importlib.util.module_from_spec(spec)
sys.argv = sys.argv[:1]  # make_brand reads an optional font path from argv
spec.loader.exec_module(brand)

RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def round_icon(size):
    im = brand.tile(size, 0.56)
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    im.putalpha(mask.resize((size, size), Image.LANCZOS))
    return im


for name, k in DENSITIES.items():
    folder = os.path.join(RES, f"mipmap-{name}")
    os.makedirs(folder, exist_ok=True)
    legacy = round(48 * k)
    brand.tile(legacy, 0.62, radius_frac=0.22).save(os.path.join(folder, "ic_launcher.png"))
    round_icon(legacy).save(os.path.join(folder, "ic_launcher_round.png"))
    # Adaptive icon layer: 108dp, seat kept inside the 66dp safe zone. The background is the paper colour.
    brand.tile(round(108 * k), 0.44, bg=None).save(os.path.join(folder, "ic_launcher_foreground.png"))
print("Android icons written.")
