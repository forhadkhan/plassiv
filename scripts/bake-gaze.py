#!/usr/bin/env python3
"""Bakes the hero "gaze" photo: the camera-facing photo of the model, registered onto the original photo.

  assets/img/hero-gaze.webp   the camera-facing photo in the original photo's 900x1254 pixel space

The two photos are the same pose shot slightly differently (the second is a little wider and sits lower), so a plain scale
and shift leaves the body sliding. The suit (rows under the chin) is fitted with an affine transform and the photo is
warped onto it, so the body keeps its place while js/gaze.js dissolves one photo into the other.
Needs numpy + opencv-python-headless + pillow.  usage: bake-gaze.py <gaze-photo.png>
"""
import sys, os, cv2, numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OLD = os.path.join(ROOT, 'assets/img/hero-model.webp')
W, H = 900, 1254
S, OX = .866, -12                      # gaze photo -> original photo space (uniform scale, shift): the starting guess

def load(path): return Image.open(path).convert('RGBA')

def place_gaze(src):
    g = src.resize((round(src.width * S), round(src.height * S)), Image.LANCZOS)
    pad = Image.new('RGBA', (W + 120, H), (0, 0, 0, 0)); pad.alpha_composite(g, (OX + 60, 0))
    return pad.crop((60, 0, 60 + W, H))

def register(old, new):
    """Fit an affine to the suit and warp the placed gaze photo onto the original."""
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
    return Image.fromarray(np.clip(a * 255 + .5, 0, 255).astype(np.uint8), 'RGBA')

if __name__ == '__main__':
    register(load(OLD), place_gaze(load(sys.argv[1]))).save(os.path.join(ROOT, 'assets/img/hero-gaze.webp'), quality=88, method=6)
