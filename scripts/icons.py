#!/usr/bin/env python3
"""
Build the launcher, splash and favicon art from assets/brand/mark.svg.

One shape, two colours, four jobs. The adaptive foreground is laid out for the
108 dp Android layer: the mark's farthest point stays inside the 66 dp safe
circle, so no launcher mask (circle, squircle, teardrop) can clip the arm.

Dependencies: rsvg-convert (brew install librsvg), Pillow.
    python3 scripts/icons.py
"""
from PIL import Image, ImageDraw
import subprocess, tempfile, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG = os.path.join(ROOT, 'assets/brand/mark.svg')

INK = (26, 24, 21)
PAPER = (246, 242, 233)
RUST = (166, 67, 31)

CANVAS = 1024
SAFE_RADIUS = CANVAS * (33 / 108)  # Android's guaranteed 66 dp circle


def render_mark():
    """Rasterise at 4096 so every downscale keeps the finger gaps clean."""
    tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False).name
    subprocess.run(['rsvg-convert', '-w', '4096', '-h', '4096', SVG, '-o', tmp], check=True)
    src = Image.open(tmp).convert('RGBA')
    os.unlink(tmp)
    mark = src.crop(src.getchannel('A').getbbox())
    return mark


def tint(mark, rgb):
    out = Image.new('RGBA', mark.size, rgb + (0,))
    out.putalpha(mark.getchannel('A'))
    return out


def farthest(mark):
    """Distance from the bbox centre to the furthest opaque pixel."""
    a = mark.getchannel('A').load()
    w, h = mark.size
    cx, cy = w / 2, h / 2
    far = 0.0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if a[x, y] > 8:
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if d > far:
                    far = d
    return far


def layer(mark, rgb, height_ratio, canvas=CANVAS, check_safe=True):
    """Place the mark centred, sized by height. Masked layers assert the safe circle."""
    w, h = mark.size
    scale = (canvas * height_ratio) / h
    farthest_px = farthest(mark) * scale
    if check_safe and farthest_px > SAFE_RADIUS:
        raise SystemExit(
            f'mark height {height_ratio:.0%} puts a corner at {farthest_px:.0f}px, '
            f'outside the {SAFE_RADIUS:.0f}px safe circle'
        )
    out = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    scaled = tint(mark, rgb).resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    out.paste(scaled, ((canvas - scaled.width) // 2, (canvas - scaled.height) // 2), scaled)
    return out


def flatten(img, bg, canvas=CANVAS):
    base = Image.new('RGBA', (canvas, canvas), bg + (255,))
    base.alpha_composite(img)
    return base.convert('RGB')


def main():
    mark = render_mark()

    # Legacy square icon: the full canvas is visible, so the mark can be large.
    icon = flatten(layer(mark, PAPER, 0.625, check_safe=False), RUST)
    icon.save(os.path.join(ROOT, 'assets/icon.png'), optimize=True)

    # Adaptive foreground: 46% of the 108 dp layer is about two thirds of the
    # 72 dp viewport every launcher shows.
    fg = layer(mark, PAPER, 0.46)
    fg.save(os.path.join(ROOT, 'assets/android-icon-foreground.png'), optimize=True)

    # Themed icons read only the alpha channel; the tint is the system's.
    layer(mark, INK, 0.46).save(
        os.path.join(ROOT, 'assets/android-icon-monochrome.png'), optimize=True
    )

    flatten(Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0)), RUST).save(
        os.path.join(ROOT, 'assets/android-icon-background.png'), optimize=True
    )

    # Splash: rust arm on paper, the icon inverted.
    layer(mark, RUST, 0.62, check_safe=False).save(
        os.path.join(ROOT, 'assets/splash-icon.png'), optimize=True
    )

    # Notification small icon: Android tints it from alpha, so the mark fills
    # the 24 dp drawable instead of sitting inside a launcher's safe circle.
    layer(mark, INK, 0.92, check_safe=False).save(
        os.path.join(ROOT, 'assets/notification-icon.png'), optimize=True
    )

    # Favicon: the legacy icon, small.
    fav = flatten(layer(mark, PAPER, 0.66, 64, check_safe=False), RUST, 64)
    fav.save(os.path.join(ROOT, 'assets/favicon.png'), optimize=True)

    print('wrote icon, adaptive foreground, monochrome, splash, favicon')


if __name__ == '__main__':
    main()
