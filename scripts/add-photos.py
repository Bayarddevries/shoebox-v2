#!/usr/bin/env python3
"""
Surgical photo intake for Shoebox v2.
Usage: python3 scripts/add-photos.py <photo1.jpg> [photo2.jpg ...]

Does NOT touch existing data — only appends new entries.
Extracts IPTC metadata from source photos to populate manifest.
"""

import json, os, sys, time, re
from datetime import datetime
from PIL import Image
from PIL.IptcImagePlugin import getiptcinfo
from PIL.ExifTags import TAGS

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS_DIR = os.path.join(REPO, "public", "assets", "shoebox", "photos")
PHOTOS_JSON = os.path.join(REPO, "assets", "shoebox", "photos.json")
MANIFEST_JSON = os.path.join(REPO, "public", "assets", "shoebox", "manifest.json")


def slugify(name: str) -> str:
    base = os.path.splitext(name)[0]
    s = re.sub(r"[^a-z0-9]+", "_", base.lower()).strip("_")
    return s[:64]


def load_json(path):
    with open(path, "r") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def extract_year(title: str) -> int | None:
    if not title:
        return None
    m = re.search(r'\((?:\?ca\.\s*)?(\d{4})\)', title)
    if m:
        y = int(m.group(1))
        if 1800 <= y <= 2025:
            return y
    m = re.search(r'(\d{4})$', title)
    if m:
        y = int(m.group(1))
        if 1800 <= y <= 2025:
            return y
    m = re.search(r'(\d{4})', title)
    if m:
        y = int(m.group(1))
        if 1800 <= y <= 2025:
            return y
    return None


def scan_year_from_exif(exif):
    if not exif:
        return None
    for tag, value in exif.items():
        name = TAGS.get(tag, tag)
        if name in ("DateTimeOriginal", "DateTime"):
            try:
                dt = datetime.strptime(value.split()[0].replace(":", "-"), "%Y-%m-%d")
                return dt.year
            except:
                pass
    return None


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

        # Load image metadata
        img = Image.open(src_path)
        iptc = getiptcinfo(img)
        exif = img._getexif()

        # Extract IPTC fields
        def get_iptc(key_tuple, default=""):
            if iptc and key_tuple in iptc:
                val = iptc[key_tuple]
                return val.decode("utf-8", errors="replace") if isinstance(val, bytes) else str(val)
            return default

        title = get_iptc((2, 5), "")
        caption = get_iptc((2, 120), "")
        description = caption
        people = get_iptc((2, 80), "")
        city = get_iptc((2, 90), "")
        province = get_iptc((2, 95), "")
        sublocation = get_iptc((2, 92), "")
        # Keywords are a list of bytes/ints from IPTC - decode properly
        keywords = []
        if iptc and (2, 25) in iptc:
            for kw in iptc[(2, 25)]:
                if isinstance(kw, bytes):
                    kw_str = kw.decode("utf-8", errors="replace").strip()
                elif isinstance(kw, int):
                    kw_str = str(kw)
                else:
                    kw_str = str(kw).strip()
                if kw_str and kw_str.isdigit() and len(kw_str) <= 3:
                    continue  # Skip single ascii codes that are not meaningful
                if kw_str and kw_str != "touched up" and kw_str != "Touched up":
                    keywords.append(kw_str)

        # Fallbacks: EXIF ImageDescription if caption empty
        if not caption and exif:
            for tag, val in exif.items():
                if TAGS.get(tag) == "ImageDescription":
                    caption = str(val)
                    description = caption
                    break

        # Use filename as fallback title
        if not title:
            title = os.path.splitext(filename)[0]

        # Derive year from title if possible
        year = extract_year(title)

        # Get scanYear from EXIF
        scan_year = scan_year_from_exif(exif)

        # Determine photoYearSource
        if year:
            photo_year_source = "title"
        elif scan_year:
            photo_year_source = "scan-date"
        else:
            photo_year_source = "unknown"

        # Build location string
        location_parts = [city, province]
        location = ", ".join([p for p in location_parts if p]) if any(location_parts) else ""

        # Generate ID
        safe_name = slugify(filename)
        photos_id = f"p_{safe_name}"
        manifest_id = f"photo_{next_id}"

        # Simple photos.json entry
        new_photos_json.append({
            "id": photos_id,
            "url": f"/assets/shoebox/photos/{filename}",
            "title": title,
            "caption": caption,
            "location": location
        })

        # Full manifest entry
        new_manifest_entries.append({
            "id": manifest_id,
            "src": f"assets/shoebox/photos/{filename}",
            "alt": filename,
            "title": title,
            "caption": caption,
            "description": description,
            "people": people,
            "location": location,
            "community": city or None,
            "province": province or None,
            "sublocation": sublocation or None,
            "keywords": keywords,
            "year": year,
            "scanYear": scan_year,
            "photoYearSource": photo_year_source,
            "width": img.width,
            "height": img.height,
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
    print(f"\nNext step: npm run build && git add -A && git commit -m \"add photos with metadata\" && git push")


if __name__ == "__main__":
    main()
