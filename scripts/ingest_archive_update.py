#!/usr/bin/env python3
"""Shoebox archive update pipeline: ingest a Lightroom export zip and update the project.

Purpose:
    Bayard exports ALL images from Lightroom (with metadata baked in) after updating
    copyright/submitter fields. This script swaps the photos into the project,
    regenerates the manifest (capturing new metadata), flags renamed/added/deleted
    files so no claim link breaks silently, and reports what changed.

Usage:
    python3 ingest_archive_update.py <path-to-zip-or-folder>

Behavior:
    1. Validates input (zip or folder)
    2. Extracts to a temp dir, verifies image count
    3. Diffs filenames against the current project photos
    4. Copies new images in (preserving filenames exactly)
    5. Regenerates the manifest via the generator
    6. Prints a report: added / renamed / deleted / unchanged
    7. Does NOT auto-deploy (that's a separate deliberate step)
"""
import argparse
import csv
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS_DIR = os.path.join(PROJECT_ROOT, 'public', 'assets', 'shoebox', 'photos')
MANIFEST_PATH = os.path.join(PROJECT_ROOT, 'public', 'assets', 'shoebox', 'manifest.json')
GENERATOR = os.path.join(PROJECT_ROOT, 'scripts', 'generate_manifest.js')

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.tif', '.tiff', '.dng', '.gif', '.webp', '.bmp', '.heic'}


def sha1_file(path, chunk=1024 * 1024):
    h = hashlib.sha1()
    with open(path, 'rb') as f:
        while chunk_b := f.read(chunk):
            h.update(chunk_b)
    return h.hexdigest()


def collect_images(folder):
    found = []
    for root, _dirs, files in os.walk(folder):
        for fn in files:
            if os.path.splitext(fn)[1].lower() in IMAGE_EXTS:
                found.append(os.path.join(root, fn))
    return found


def main():
    ap = argparse.ArgumentParser(description='Ingest a Lightroom export into the Shoebox archive')
    ap.add_argument('source', help='Path to exported zip or folder of images')
    ap.add_argument('--deploy', action='store_true', help='Also rebuild and (if --push) push the app')
    ap.add_argument('--push', action='store_true', help='Push to git origin (implies --deploy)')
    args = ap.parse_args()

    src = os.path.abspath(args.source)
    if not os.path.exists(src):
        print(f'ERROR: {src} not found')
        sys.exit(1)

    with tempfile.TemporaryDirectory() as tmp:
        if os.path.isdir(src):
            work = src
        else:
            print(f'Extracting {src} ...')
            with zipfile.ZipFile(src) as zf:
                zf.extractall(tmp)
            work = tmp

        images = collect_images(work)
        print(f'Found {len(images)} images in export')

        # Existing manifest IDs by filename
        manifest = json.load(open(MANIFEST_PATH))
        existing = {os.path.basename(p['src']): p['id'] for p in manifest.get('photos', [])}

        new_names = set()
        for img in images:
            base = os.path.basename(img)
            if base not in existing:
                new_names.add(base)

        print(f'New/unknown filenames in export: {len(new_names)}')
        if new_names:
            print('  Sample of new names:')
            for n in sorted(new_names)[:10]:
                print(f'    {n}')

        # Copy new images into photos dir, only if different content
        copied, skipped, same = 0, 0, 0
        for img in images:
            base = os.path.basename(img)
            dest = os.path.join(PHOTOS_DIR, base)
            if os.path.exists(dest):
                if sha1_file(img) == sha1_file(dest):
                    same += 1
                else:
                    # Same filename, different content: overwrite (metadata refresh)
                    shutil.copy2(img, dest)
                    copied += 1
            else:
                shutil.copy2(img, dest)
                copied += 1

        print(f'Copied/updated: {copied} | Identical: {same}')

        # Regenerate manifest
        print('\nRegenerating manifest ...')
        r = subprocess.run(['node', GENERATOR], cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=600)
        print(r.stdout[-1200:] if r.stdout else '')
        if r.returncode != 0:
            print('ERROR: manifest generation failed')
            print(r.stderr[-2000:])
            sys.exit(1)

        # Post-diff: what changed in the manifest
        manifest2 = json.load(open(MANIFEST_PATH))
        new_existing = {os.path.basename(p['src']): p['id'] for p in manifest2.get('photos', [])}

        added = set(new_existing) - set(existing)
        removed = set(existing) - set(new_existing)
        print(f'\n=== Manifest after regeneration ===')
        print(f'Photos: {len(new_existing)}')
        print(f'Added filenames: {len(added)}')
        print(f'Removed filenames: {len(removed)}')
        if removed:
            print('  REMOVED (check these!):')
            for r_ in sorted(removed)[:15]:
                print(f'    {r_}')

        # Check if any existing ID changed (would break links)
        changed_ids = 0
        for fn, nid in new_existing.items():
            if fn in existing and existing[fn] != nid:
                changed_ids += 1
                if changed_ids <= 5:
                    print(f'  ID CHANGED for {fn}: {existing[fn]} -> {nid}')
        print(f'IDs changed for existing files: {changed_ids}')

        if args.deploy or args.push:
            print('\nBuilding ...')
            r = subprocess.run(['npm', 'run', 'build'], cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=600)
            print(r.stdout[-800:] if r.stdout else '')
            if r.returncode != 0:
                print('ERROR: build failed')
                print(r.stderr[-2000:])
                sys.exit(1)
            if args.push:
                print('\nPushing to git ...')
                subprocess.run(['git', 'add', '-A'], cwd=PROJECT_ROOT, check=True)
                subprocess.run(['git', 'commit', '-m', 'Archive metadata refresh from Lightroom export'], cwd=PROJECT_ROOT, check=True)
                subprocess.run(['git', 'push', 'origin', 'main'], cwd=PROJECT_ROOT, check=True)

    print('\nDone.')


if __name__ == '__main__':
    main()
