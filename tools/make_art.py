"""Web textures + depth maps for the paintings.

art/<key>.jpg (originals from fetch_art.py) -> public/art/<key>.webp (colour, long side capped)
                                            -> public/art/<key>.d.jpg (depth, 1 = near, blurred)
Depth comes from Depth-Anything-V2-Small; very tall or wide images are estimated in overlapping tiles.
  python tools/make_art.py [key ...]
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC, DST = os.path.join(ROOT, "art"), os.path.join(ROOT, "public", "art")
os.makedirs(DST, exist_ok=True)

# key: dict(src, crop=(l,t,r,b) in px or fractions, cap=long side, split=[(name, box)...])
JOBS = {
    "bosch": dict(src="bosch_creation", crop=(7, 10, 1799, 1906), cap=1800, depth="dome",
                  split=[("bosch_l", (0, 0, 893, 1896)), ("bosch_r", (897, 0, 1792, 1896))]),
}

_pipe = None
def pipe():
    global _pipe
    if _pipe is None:
        import torch  # noqa: F401
        from transformers import pipeline
        _pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device=-1)
    return _pipe

def est(im):
    d = np.array(pipe()(im)["depth"].resize(im.size, Image.BICUBIC), np.float32)
    return (d - d.min()) / max(1e-6, d.max() - d.min())

def depth_of(im):
    small = im.copy()
    small.thumbnail((1400, 1400), Image.LANCZOS)
    W, H = small.size
    if max(W, H) / min(W, H) < 1.7:
        return est(small)
    # long strip: overlapping square-ish tiles along the long axis, hann-blended
    horiz = W > H
    S, L = (H, W) if horiz else (W, H)
    tile = int(S * 1.3)
    n = int(np.ceil((L - tile) / (tile * 0.5))) + 1
    acc = np.zeros((H, W), np.float32); wsum = np.zeros((H, W), np.float32)
    for i in range(n):
        o = int(round(i * (L - tile) / max(1, n - 1)))
        box = (o, 0, o + tile, H) if horiz else (0, o, W, o + tile)
        d = est(small.crop(box))
        w = np.hanning(tile + 2)[1:-1].astype(np.float32) + 1e-3
        w = w[None, :] if horiz else w[:, None]
        if horiz:
            acc[:, o:o + tile] += d * w; wsum[:, o:o + tile] += w
        else:
            acc[o:o + tile] += d * w; wsum[o:o + tile] += w
    return acc / np.maximum(wsum, 1e-6)

def dome_depth(size, crop, scale):
    """Bosch's glass world reads as concave to the depth model; draw it as the convex sphere it is.
    Ellipse measured on the original diptych: centre (896, 964), radii (754, 736)."""
    W, H = size
    x = (np.arange(W)[None, :] / scale + crop[0] - 896) / 754
    y = (np.arange(H)[:, None] / scale + crop[1] - 964) / 736
    r2 = x * x + y * y
    dome = np.sqrt(np.clip(1 - r2, 0, 1))
    edge = np.clip((1 - np.sqrt(r2)) * 40, 0, 1)
    return (0.2 + 0.8 * dome * edge).astype(np.float32)


def finish_depth(d, size):
    lo, hi = np.percentile(d, 1), np.percentile(d, 99.5)
    d = np.clip((d - lo) / max(1e-6, hi - lo), 0, 1)
    img = Image.fromarray((d * 255).astype(np.uint8), "L")
    img = img.filter(ImageFilter.GaussianBlur(max(1.5, max(img.size) / 500)))
    # depth at most 1024 on the long side is plenty: it is sampled with linear filtering
    s = min(1.0, 1024 / max(size))
    return img.resize((max(1, round(size[0] * s)), max(1, round(size[1] * s))), Image.BICUBIC)

def run(key, job):
    im = Image.open(os.path.join(SRC, job["src"] + ".jpg")).convert("RGB")
    if "crop" in job:
        l, t, r, b = job["crop"]
        if max(l, t, r, b) <= 1.0:
            l, t, r, b = l * im.width, t * im.height, r * im.width, b * im.height
        im = im.crop((int(l), int(t), int(r), int(b)))
    s = min(1.0, job["cap"] / max(im.size))
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    d = dome_depth(im.size, job["crop"], s) if job.get("depth") == "dome" else depth_of(im)
    full = Image.fromarray(d)
    parts = job.get("split") or [(key, (0, 0, im.width, im.height))]
    for name, box in parts:
        box = tuple(int(v * s) if "split" in job else v for v in box)
        c = im.crop(box)
        c.save(os.path.join(DST, name + ".webp"), quality=84, method=6)
        sx, sy = full.width / im.width, full.height / im.height
        dc = np.array(full.crop((int(box[0] * sx), int(box[1] * sy), int(box[2] * sx), int(box[3] * sy))), np.float32)
        finish_depth(dc, c.size).save(os.path.join(DST, name + ".d.jpg"), quality=90)
        kb = os.path.getsize(os.path.join(DST, name + ".webp")) // 1024
        print(f"{name}: {c.size[0]}x{c.size[1]} {kb}KB", flush=True)

if __name__ == "__main__":
    only = sys.argv[1:]
    for k, j in JOBS.items():
        if not only or k in only:
            run(k, j)
