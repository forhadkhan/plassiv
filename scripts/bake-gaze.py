#!/usr/bin/env python3
"""Bakes the hero "gaze" assets from the two photos of the model.

  assets/img/hero-gaze.webp       the camera-facing photo, scaled and placed into the original photo's pixel space
  assets/img/hero-gaze-flow.png   two displacement maps stacked (top: original -> gaze, bottom: gaze -> original), each
                                  at 1/4 size, R,G = x,y offset, 128 = none, 1 unit = 1/2 px in the 900x1254 photo space

Body: dense optical flow. Head: inverse-distance warp through hand-placed landmark pairs (profile -> frontal).
Needs numpy + opencv-python-headless + pillow.  usage: bake-gaze.py <gaze-photo.png> [--preview DIR]
"""
import sys, os, cv2, numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OLD = os.path.join(ROOT, 'assets/img/hero-model.webp')
W, H = 900, 1254
S, OX = .866, -12                      # gaze photo -> original photo space (uniform scale, shift)

# (original-photo xy, gaze-photo xy in its own pixels)
HEAD = [
  ((490,158),(552,211)), ((545,153),(645,228)),              # eyes: near -> viewer-left, far -> viewer-right
  ((480,137),(545,193)), ((548,134),(645,212)),              # brows
  ((530,150),(590,225)), ((556,192),(611,274)), ((536,206),(588,284)),   # nose bridge / tip / alar
  ((548,238),(605,312)), ((520,240),(566,301)),   # mouth centre / near corner
  ((490,303),(580,376)), ((552,272),(648,346)),              # chin, beard front
  ((372,205),(452,240)), ((366,171),(450,205)), ((388,240),(465,275)),   # ear centre / top / lobe
  ((440,205),(520,266)), ((405,262),(472,335)),              # cheek, jaw
  ((440,24),(580,28)),   ((300,170),(402,200)), ((530,60),(660,70)),     # hair top / back / front
  ((540,105),(640,150)), ((340,320),(412,345)),              # forehead, nape
  # the profile's far edge becomes the frontal face's far edge: this is what pulls the far half of the head out
  ((546,100),(697,130)), ((560,140),(668,215)), ((565,238),(662,312)), ((552,272),(640,350)),
]

def load(path): return Image.open(path).convert('RGBA')

def place_gaze(src):
    g = src.resize((round(src.width * S), round(src.height * S)), Image.LANCZOS)
    pad = Image.new('RGBA', (W + 120, H), (0, 0, 0, 0)); pad.alpha_composite(g, (OX + 60, 0))
    return pad.crop((60, 0, 60 + W, H))

def register(old, new):
    """The gaze photo was shot a little differently (a bit wider, a bit lower), so scale and shift alone leave the body
    sliding during the turn. Fit an affine to the suit (rows under the chin) and warp the gaze photo onto it.
    Returns the registered photo and the 2x3 matrix W (old-space point -> placed-photo point)."""
    def gray(im):
        a = np.asarray(im, np.float32)
        g = cv2.cvtColor(np.clip(a[..., :3] * (a[..., 3:] / 255.), 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
        return cv2.GaussianBlur(g, (0, 0), 2).astype(np.float32)
    ao, an = (np.asarray(i)[..., 3] for i in (old, new))
    mask = np.zeros((H, W), np.uint8)
    mask[470:] = ((ao[470:] > 200) & (an[470:] > 200)) * 255
    mask = cv2.erode(mask, np.ones((15, 15), np.uint8))
    M = np.eye(2, 3, dtype=np.float32)
    _, M = cv2.findTransformECC(gray(old), gray(new), M, cv2.MOTION_AFFINE,
                                (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-6), mask, 5)
    a = np.asarray(new, np.float32) / 255.; a[..., :3] *= a[..., 3:]                 # premultiplied, so edges stay clean
    a = cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP)
    a[..., :3] = a[..., :3] / np.maximum(a[..., 3:], 1e-4)
    return Image.fromarray(np.clip(a * 255 + .5, 0, 255).astype(np.uint8), 'RGBA'), M

def idw(pts, shape, r0=230., p=2.0):
    """smooth displacement field from (position, displacement) pairs; fades to zero far from every landmark"""
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]].astype(np.float32)
    num = np.zeros(shape + (2,), np.float32); den = np.full(shape, (1 / r0) ** p, np.float32)
    for (x, y), (dx, dy) in pts:
        w = 1 / (((xx - x) ** 2 + (yy - y) ** 2) + 25.) ** (p / 2)
        num[..., 0] += w * dx; num[..., 1] += w * dy; den += w
    return num / den[..., None]

def bake(gaze_path, preview=None):
    old = load(OLD); new, M = register(old, place_gaze(load(gaze_path)))
    Mi = cv2.invertAffineTransform(M)                                            # placed-photo point -> registered point
    def flat(im):
        a = np.asarray(im, np.float32); return a[..., :3] * (a[..., 3:] / 255.)
    go, gn = (cv2.cvtColor(np.clip(flat(i), 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY) for i in (old, new))
    ys = np.arange(H, dtype=np.float32)[:, None]
    wb = np.clip((ys - 300) / 100, 0, 1); wb = wb * wb * (3 - 2 * wb)            # body flow fades in under the chin
    fields = []
    for fwd in (True, False):                                                    # old -> new on old pixels, new -> old on new pixels
        a, b = (go, gn) if fwd else (gn, go)
        body = cv2.calcOpticalFlowFarneback(a, b, None, .5, 6, 45, 6, 7, 1.5, 0) * wb[..., None]
        pts = []
        for (ox, oy), (gx, gy) in HEAD:
            ox2, oy2 = Mi @ np.array([gx * S + OX, gy * S, 1.], np.float32)
            pts.append(((ox, oy), (ox2 - ox, oy2 - oy)) if fwd else ((ox2, oy2), (ox - ox2, oy - oy2)))
        fields.append(cv2.GaussianBlur(body + idw(pts, (H, W)) * (1 - wb)[..., None], (0, 0), 3))
    small = [cv2.resize(f, (W // 4, H // 4), interpolation=cv2.INTER_AREA) for f in fields]
    enc = np.clip(np.round(np.concatenate(small, 0) * 2 + 128), 0, 255).astype(np.uint8)
    out = np.dstack([enc[..., 0], enc[..., 1], np.zeros_like(enc[..., 0])])
    Image.fromarray(out).save(os.path.join(ROOT, 'assets/img/hero-gaze-flow.png'), optimize=True)
    new.save(os.path.join(ROOT, 'assets/img/hero-gaze.webp'), quality=88, method=6)
    if preview: render(old, new, small, preview)

def render(old, new, small, outdir):
    os.makedirs(outdir, exist_ok=True)
    dec = lambda x: cv2.resize((np.clip(np.round(x * 2 + 128), 0, 255) - 128) / 2, (W, H), interpolation=cv2.INTER_LINEAR)
    f, g = dec(small[0]), dec(small[1])
    xx, yy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    wine = np.array([42, 3, 9], np.float32)
    def pm(im):
        a = np.asarray(im, np.float32) / 255.; a[..., :3] *= a[..., 3:]; return a
    po, pn = pm(old), pm(new)
    for t in (0, .25, .4, .5, .6, .75, 1):
        wo = cv2.remap(po, xx - t * f[..., 0], yy - t * f[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        wn = cv2.remap(pn, xx - (1 - t) * g[..., 0], yy - (1 - t) * g[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        m = np.clip((t - .2) / .6, 0, 1); m = m * m * (3 - 2 * m)
        c = wo * (1 - m) + wn * m
        # mid-turn the two silhouettes must read as one solid head, not two translucent ones: take the union alpha
        a = np.maximum(wo[..., 3:], wn[..., 3:]) * (4 * m * (1 - m)) + c[..., 3:] * (1 - 4 * m * (1 - m))
        c = np.concatenate([c[..., :3] / np.maximum(c[..., 3:], 1e-4) * a, a], -1)
        rgb = c[..., :3] * 255 + wine * (1 - c[..., 3:])
        Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(f'{outdir}/t{int(t*100):03d}.png')

if __name__ == '__main__':
    a = sys.argv[1:]
    bake(a[0], a[a.index('--preview') + 1] if '--preview' in a else None)
