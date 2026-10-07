"""Brand assets from the master logo (brand/cybcell-logo-source.png, 1536x1024 RGBA).

public/brand/cybcell-mark.png     trimmed mark, 160 px tall, grey + alpha (nav and footer; the logo has no colour)
public/favicon.ico, favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png
The square icons sit the mark on the site's ink colour so it reads in any tab bar or home screen.
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "brand", "cybcell-logo-source.png")
PUB = os.path.join(ROOT, "public")
INK = (10, 9, 7, 255)

src = Image.open(SRC).convert("RGBA")
alpha = np.asarray(src)[..., 3]
ys, xs = np.nonzero(alpha > 8)
pad = 6
mark = src.crop((xs.min() - pad, ys.min() - pad, xs.max() + pad + 1, ys.max() + pad + 1))


def scaled(h):
    w = round(mark.width * h / mark.height)
    return mark.resize((w, h), Image.LANCZOS)


def save_png(im, path, colors=None):
    if colors:
        im = im.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    im.save(path, optimize=True)
    print(os.path.relpath(path, ROOT), im.size, os.path.getsize(path) // 1024, "KB")


def square(size, fill=0.78, radius=0.22):
    """Mark centred on an ink tile; `fill` is the share of the width the mark takes."""
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg = Image.new("RGBA", (size, size), INK)
    if radius:
        m = Image.new("L", (size, size), 0)
        from PIL import ImageDraw
        ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * radius), fill=255)
        tile.paste(bg, (0, 0), m)
    else:
        tile = bg
    w = round(size * fill)
    h = round(mark.height * w / mark.width)
    tile.alpha_composite(mark.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    return tile


os.makedirs(os.path.join(PUB, "brand"), exist_ok=True)
save_png(scaled(160).convert("LA"), os.path.join(PUB, "brand", "cybcell-mark.png"))

save_png(square(32, fill=0.92, radius=0.18), os.path.join(PUB, "favicon-32.png"))
square(48, fill=0.92, radius=0.18).save(os.path.join(PUB, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
print("public/favicon.ico", os.path.getsize(os.path.join(PUB, "favicon.ico")) // 1024, "KB")
# iOS draws its own rounded corners and needs an opaque tile.
save_png(square(180, fill=0.74, radius=0).convert("RGB"), os.path.join(PUB, "apple-touch-icon.png"))
# Android: maskable safe zone is the central 80% circle, so keep the mark inside it.
save_png(square(192, fill=0.66, radius=0).convert("RGB"), os.path.join(PUB, "icon-192.png"))
save_png(square(512, fill=0.66, radius=0).convert("RGB"), os.path.join(PUB, "icon-512.png"))
