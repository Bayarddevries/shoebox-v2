#!/usr/bin/env python3
"""
Surgical photo intake for Shoebox v2.
Usage: python3 scripts/add-photos.py <photo1.jpg> [photo2.jpg ...]

Does NOT touch existing data — only appends new entries.
"""

import json, os, sys, time, hashlib, base64, re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS_DIR = os.path.join(REPO, "public", "assets", "shoebox", "photos")
PHOTOS_JSON = os.path.join(REPO, "assets", "shoebox", "photos.json")
MANIFEST_JSON = os.path.join(REPO, "public", "assets", "shoebox", "manifest.json")


def slugify(name: str) -> str:
    """Turn filename into a clean id key."""
    base = os.path.splitext(name)[0]
    # lowercase, collapse spaces/dashes/underscores
    s = re.sub(r"[^a-z0-9]+", "_", base.lower()).strip("_")
    return s[:64]


def load_json(path):
    with open(path, "r") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def main():
    sources = sys.argv[1:]
    if not sources:
        print("Usage: python3 scripts/add-photos.py <photo1.jpg> [photo2.jpg ...]")
        sys.exit(1)

    os.makedirs(PHOTOS_DIR, exist_ok=True)
    photos_json = load_json(PHOTOS_JSON)
    manifest_json = load_json(MANIFEST_JSON)

    next_id = len(manifest_json["photos"]) + 1
    now = time.time() * 1000

    new_photos_json = []
    new_manifest_entries = []

    for src_path in sources:
        src_path = os.path.abspath(src_path)
        if not os.path.isfile(src_path):
            print(f"⚠ Skipping (not a file): {src_path}")
            continue

        filename = os.path.basename(src_path)
        target = os.path.join(PHOTOS_DIR, filename)

        # Skip if already exists
        if os.path.exists(target):
            print(f"⚠ Already exists: {filename}")
            continue

        # Copy file
        with open(src_path, "rb") as f:
            data = f.read()
        with open(target, "wb") as f:
            f.write(data)
        file_size = len(data)
        print(f"✓ Copied: {filename} ({file_size:,} bytes)")

        # Generate ID
        safe_name = slugify(filename)
        photos_id = f"p_{safe_name}"
        manifest_id = f"photo_{next_id}"

        # Simple photos.json entry
        new_photos_json.append({
            "id": photos_id,
            "url": f"/assets/shoebox/photos/{filename}",
            "title": os.path.splitext(filename)[0],
            "caption": "",
            "location": ""
        })

        # Full manifest entry
        new_manifest_entries.append({
            "id": manifest_id,
            "src": f"assets/shoebox/photos/{filename}",
            "alt": filename,
            "title": os.path.splitext(filename)[0],
            "caption": "",
            "description": "",
            "people": "",
            "location": "",
            "community": None,
            "province": None,
            "sublocation": None,
            "keywords": [],
            "year": None,
            "scanYear": None,
            "photoYearSource": "unknown",
            "width": None,
            "height": None,
            "lat": None,
            "lng": None,
            "lastModified": now,
            "rotation": 0,
            "scale": 1,
            "zIndex": 0
        })

        next_id += 1

    if not new_manifest_entries:
        print("Nothing to add.")
        return

    # Append to photos.json
    photos_json["photos"].extend(new_photos_json)
    save_json(PHOTOS_JSON, photos_json)

    # Append to manifest.json
    manifest_json["photos"].extend(new_manifest_entries)
    manifest_json["photoCount"] = len(manifest_json["photos"])
    manifest_json["generatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())

    # Update metadata block
    meta = manifest_json.get("metadata", {})
    meta["totalPhotos"] = len(manifest_json["photos"])
    manifest_json["metadata"] = meta

    save_json(MANIFEST_JSON, manifest_json)

    print(f"\n✓ Added {len(new_manifest_entries)} photo(s)")
    print(f"  photos.json: {len(photos_json['photos'])} total")
    print(f"  manifest.json: {manifest_json['photoCount']} total")
    print(f"\nNext step: npm run build && git add -A && git commit -m \"add photos\" && git push")


if __name__ == "__main__":
    main()
