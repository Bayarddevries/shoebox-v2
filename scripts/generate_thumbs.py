#!/usr/bin/env python3
"""Generate ~320px-wide thumbnails for the Metis Kin exhibit.

Reads public/assets/shoebox/photos/* and writes downscaled JPEGs to
public/assets/shoebox/thumbs/ keeping the same filenames (spaces included).
The controller uses thumbs for gallery, search results, piles, and attract
mode so a phone never downloads a 713KB original for a thumbnail.

Usage: python3 scripts/generate_thumbs.py
Re-run after adding new photos (skips existing thumbs).
"""
import os

from PIL import Image

BASE = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'shoebox')
SRC = os.path.join(BASE, 'photos')
DST = os.path.join(BASE, 'thumbs')
MAX_W = 320
QUALITY = 72


def main():
    os.makedirs(DST, exist_ok=True)
    files = sorted(f for f in os.listdir(SRC)
                   if f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')))
    done = skipped = failed = 0
    for name in files:
        out = os.path.join(DST, os.path.splitext(name)[0] + '.jpg')
        if os.path.exists(out):
            skipped += 1
            continue
        try:
            with Image.open(os.path.join(SRC, name)) as im:
                im = im.convert('RGB')
                w, h = im.size
                if w > MAX_W:
                    im = im.resize((MAX_W, max(1, int(h * MAX_W / w))), Image.LANCZOS)
                im.save(out, 'JPEG', quality=QUALITY, optimize=True)
                done += 1
        except Exception as e:  # noqa: BLE001
            print(f'FAIL {name}: {e}')
            failed += 1
    print(f'Generated {done} thumbnails, {skipped} already present, {failed} failed.')


if __name__ == '__main__':
    main()
