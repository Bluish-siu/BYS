"""Builds every PickMySeat logo file from the "Paper & Ink" design (3c).

Run from the project folder:  python docs/brand/make_brand.py <path-to-Sora[wght].ttf>
Needs:  pip install pillow
Sora is free from Google Fonts: https://fonts.google.com/specimen/Sora
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUB = os.path.join(ROOT, "frontend", "public")
DOCS = os.path.join(ROOT, "docs", "brand")
FONT = sys.argv[1] if len(sys.argv) > 1 else None

PAPER, INK, ORANGE = "#F3EEE5", "#16161A", "#FF5A36"

# The seat glyph, in the 1024 x 1024 space of the original icon export.
INK_RECTS = [(322, 234, 380, 440, 72), (232, 492, 90, 300, 45), (702, 492, 90, 300, 45), (282, 662, 460, 130, 44)]
PAPER_RECTS = [(378, 290, 268, 204, 28), (282, 638, 460, 24, 0)]
SCREEN = [(414, 328), (612, 352), (612, 434), (414, 458)]
GX0, GY0, GX1, GY1 = 232, 234, 792, 792  # glyph bounds


def svg_shapes(tx=0.0, ty=0.0, s=1.0):
    out = []
    for x, y, w, h, r in INK_RECTS:
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{INK}"/>')
    for x, y, w, h, r in PAPER_RECTS:
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{PAPER}"/>')
    out.append(f'<polygon points="{" ".join(f"{x},{y}" for x, y in SCREEN)}" fill="{ORANGE}"/>')
    return f'<g transform="translate({tx} {ty}) scale({s})">' + "".join(out) + "</g>"


def write_svgs():
    os.makedirs(os.path.join(PUB, "brand"), exist_ok=True)
    w, h = GX1 - GX0, GY1 - GY0
    mark = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{GX0} {GY0} {w} {h}">{svg_shapes()}</svg>\n'
    icon = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="0" fill="{PAPER}"/>{svg_shapes()}</svg>\n'
    for path, data in [(os.path.join(PUB, "brand", "mark.svg"), mark), (os.path.join(PUB, "brand", "icon.svg"), icon),
                       (os.path.join(DOCS, "mark.svg"), mark), (os.path.join(DOCS, "icon.svg"), icon)]:
        with open(path, "w", encoding="utf8") as f:
            f.write(data)


def draw_glyph(d, ox, oy, s):
    """Draws the seat with its top-left glyph corner at (ox, oy), scaled by s."""
    def rr(x, y, w, h, r, fill):
        box = (ox + (x - GX0) * s, oy + (y - GY0) * s, ox + (x - GX0 + w) * s, oy + (y - GY0 + h) * s)
        d.rounded_rectangle(box, radius=r * s, fill=fill) if r else d.rectangle(box, fill=fill)
    for x, y, w, h, r in INK_RECTS:
        rr(x, y, w, h, r, INK)
    for x, y, w, h, r in PAPER_RECTS:
        rr(x, y, w, h, r, PAPER)
    d.polygon([(ox + (x - GX0) * s, oy + (y - GY0) * s) for x, y in SCREEN], fill=ORANGE)


def tile(size, glyph_frac, bg=PAPER, radius_frac=0.0):
    """Square icon: the seat centred at glyph_frac of the size. Drawn 4x, then scaled down for smooth edges."""
    S = size * 4
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg:
        d.rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * radius_frac), fill=bg)
    gw = S * glyph_frac
    s = gw / (GX1 - GX0)
    gh = (GY1 - GY0) * s
    draw_glyph(d, (S - gw) / 2, (S - gh) / 2, s)
    return im.resize((size, size), Image.LANCZOS)


def wordmark(height, with_glyph=True, bg=PAPER):
    """Seat + "PickMySeat" in Sora ExtraBold, like the logo export."""
    S = 4
    font = ImageFont.truetype(FONT, int(height * 0.62 * S))
    font.set_variation_by_axes([800])
    gh = height * S
    s = gh / (GY1 - GY0)
    gw = (GX1 - GX0) * s
    gap = height * 0.32 * S
    track = -0.035 * font.size  # letter-spacing -6 at 180px in the export
    def text_w(t):
        return sum(font.getlength(ch) + track for ch in t) - track
    tw = text_w("PickMySeat")
    pad = height * 0.25 * S
    W = int(pad * 2 + (gw + gap if with_glyph else 0) + tw)
    H = int(gh + pad * 2)
    im = Image.new("RGBA", (W, H), bg if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = pad
    if with_glyph:
        draw_glyph(d, x, pad, s)
        x += gw + gap
    asc, desc = font.getmetrics()
    ty = pad + gh * 0.56 - asc * 0.72
    for i, ch in enumerate("PickMySeat"):
        d.text((x, ty), ch, font=font, fill=INK if i < 6 else ORANGE)
        x += font.getlength(ch) + track
    return im.resize((W // S, H // S), Image.LANCZOS)


def main():
    write_svgs()
    full = tile(1024, 0.55)
    full.save(os.path.join(DOCS, "app-icon-1024.png"))
    for size in (512, 192):
        tile(size, 0.62).save(os.path.join(PUB, f"icon-{size}.png"))
    tile(512, 0.48).save(os.path.join(PUB, "icon-maskable-512.png"))  # Android crops to a circle: keep inside the safe zone
    tile(180, 0.62).convert("RGB").save(os.path.join(PUB, "apple-touch-icon.png"))
    tile(32, 0.80, radius_frac=0.2).save(os.path.join(PUB, "icon-32.png"))
    tile(64, 0.80, radius_frac=0.2).save(os.path.join(PUB, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    if FONT:
        wordmark(160).save(os.path.join(DOCS, "logo-full.png"))
        wordmark(160, bg=None).save(os.path.join(DOCS, "logo-full-transparent.png"))
        og = Image.new("RGB", (1200, 630), PAPER)
        logo = wordmark(120)
        og.paste(logo.convert("RGB"), ((1200 - logo.width) // 2, 170))
        d = ImageDraw.Draw(og)
        f = ImageFont.truetype(FONT, 38)
        f.set_variation_by_axes([500])
        t = "See your seat before you book"
        d.text(((1200 - d.textlength(t, font=f)) / 2, 170 + logo.height + 30), t, font=f, fill="#5B5A57")
        og.save(os.path.join(PUB, "og-image.png"))
    for old in ("pin.png", "logo-full.png"):
        p = os.path.join(PUB, "brand", old)
        if os.path.exists(p):
            os.remove(p)
    print("Brand files written.")


if __name__ == "__main__":
    main()
