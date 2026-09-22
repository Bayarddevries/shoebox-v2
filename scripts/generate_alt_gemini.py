#!/usr/bin/env python3
"""Generate alt text drafts for ALL Shoebox photos via the Gemini API (vision).

Why this exists: the old alt drafts were assembled from metadata templates
(people + place + year glued together) with zero vision - Bayard called them
shitty, correctly. Gemini actually LOOKS at the photo. This script sends each
image + its KNOWN metadata to Gemini with a strict prompt, merges the visual
description with the archive's facts, and writes drafts into the worklist
(scripts/metadata-worklist-full.csv, alt_paste column) in Lightroom A-Z order.

The merge is the point: Gemini describes what is visible; the manifest
supplies who/where/when. Gemini must NOT invent names/dates/places - the
prompt forbids it. Drafts are a FLOOR for Bayard's review, not final text.

Approved alt text lives in scripts/alt-text.json (keyed by filename), which
generate_manifest.js reads at regen time. Photos already in alt-text.json are
skipped on re-runs.

Usage:
    export GEMINI_API_KEY=...          # free key from aistudio.google.com/apikey
    python3 scripts/generate_alt_gemini.py                # all 544
    python3 scripts/generate_alt_gemini.py --pilot 30     # stratified sample
    python3 scripts/generate_alt_gemini.py --limit 50 --offset 100
    python3 scripts/generate_alt_gemini.py --model gemini-2.5-flash

Free tier caveats (verified Sep 2026): the Gemini API free tier is real and
vision-capable on flash models, but per-account rate limits vary and were
tightened; expect 429s. The script retries with backoff, checkpoints after
every success (scripts/.alt_checkpoint.json), and resumes automatically, so a
quota-limited run can finish across multiple invocations.

Manual-path prompt (same rules, for the Gemini app, paste per image):

    Write alt text for a Red River Metis community photo archive. Describe
    ONLY what is visible in this photo. 1-2 sentences, under 125 characters.
    Plain factual language, no filler like "this photo shows", no speculation,
    no invented emotion or family relationships.
    KNOWN metadata (use only if visible; never repeat what is not in the
    photo): people: <people>; place: <place>; year: <year>; event: <event>.
    Output only the alt text.
"""

import argparse
import base64
import csv
import io
import json
import os
import re
import sys
import time

import requests
from PIL import Image

REPO = "/home/bayarddevries/shoebox-v2"
MANIFEST = f"{REPO}/public/assets/shoebox/manifest.json"
PHOTOS_DIR = f"{REPO}/public/assets/shoebox/photos"
WORKLIST = f"{REPO}/scripts/metadata-worklist-full.csv"
ALT_OVERRIDES = f"{REPO}/scripts/alt-text.json"
CHECKPOINT = f"{REPO}/scripts/.alt_checkpoint.json"
MODEL = os.environ.get("ALT_MODEL", "gemini-2.5-flash")
MAX_ALT_CHARS = 125
MAX_SIDE = 1024

# Case-normalization map from the metadata worklist generator (kept in sync)
CASE_FIX = {
    "Outdoors": "outdoors", "Outdoor": "outdoors", "outdoor": "outdoors",
    "Agriculture": "agriculture", "Family": "family",
    "Family portrait": "family portrait", "Farm": "farm", "Winter": "winter",
    "Wedding": "wedding", "School": "school", "Portrait": "portrait",
    "Church": "church", "Children": "children", "Boat": "boat", "Car": "car",
    "Couple": "couple", "Dog": "dog", "Home": "home", "House": "house",
    "Men": "men", "Snow": "snow", "Soldier": "soldier", "Students": "students",
    "Trees": "trees", "Vintage": "vintage", "Water": "water", "Women": "women",
    "Military uniform": "military uniform", "Studio portrait": "studio portrait",
    "Trapper Cabin": "trapper cabin",
    "Traditional Clothing": "traditional clothing", "Evergreen": "evergreen",
    "Field": "field", "Forest": "forest", "Historical": "historical",
    "Indigenous Culture": "indigenous culture",
    "Resource gathering": "resource gathering",
    "Vintage photograph": "vintage photograph",
}


def canon(kw):
    s = str(kw).strip()
    return CASE_FIX.get(s, s)


def recommend_keywords(p):
    kws = p.get("keywords") or []
    if isinstance(kws, str):
        kws = [kws]
    seen, norm, changed = set(), [], False
    for k in kws:
        kk = canon(str(k))
        if kk.lower() != str(k).lower():
            changed = True
        if kk.lower() in seen:
            changed = True
            continue
        seen.add(kk.lower())
        norm.append(kk)
    return ", ".join(norm) if changed else ""


def is_filenameish(title):
    t = (title or "").strip().lower()
    if not t:
        return True
    return (t.startswith(("img_", "mg_", "photo_", "untitled", "dsc", "scan", "old photo"))
            or t.endswith(".jpg") or t.startswith("ffa") or t.startswith("_mg_")
            or bool(re.match(r"^\d+(-\d+)?$", t)))


def draft(p):
    title = (p.get("title") or "").strip()
    caption = (p.get("caption") or "").strip()
    people = (p.get("people") or "").strip()
    place = (p.get("community") or "").strip()
    subloc = (p.get("sublocation") or "").strip()
    prov = (p.get("province") or "").strip()
    year = p.get("year")
    kws = p.get("keywords") or []
    events = [k for k in kws if any(w in str(k).lower() for w in
              ["meeting", "days", "nipd", "aga", "riel", "gala", "regional"])]
    need_title = is_filenameish(title)
    need_caption = (not caption) or len(caption) < 20
    dt = title
    if need_title:
        if people and ";" in people:
            dt = people.split(";")[0].strip()
        elif people:
            dt = people
        elif place:
            dt = f"{place} photo"
        else:
            dt = ""
    dc = caption
    if need_caption:
        bits = []
        if people:
            bits.append(people)
        if subloc and subloc.lower() not in ("cemetary", ""):
            bits.append(subloc)
        if place:
            bits.append(place)
        if prov and prov.lower() not in ("manitoba", "saskatchewan"):
            bits.append(prov)
        if year:
            bits.append(str(year))
        if events:
            bits.append(str(events[0]))
        dc = f"A photo of {', '.join(bits)}. [Add the story here.]" if bits else "[Add the story here.]"
    status = []
    if need_caption:
        status.append("EMPTY/SHORT CAPTION")
    if need_title:
        status.append("FILENAME TITLE")
    if not status:
        status.append("OK")
    return dt, dc, "; ".join(status)


def build_prompt(p):
    meta = []
    people = (p.get("people") or "").strip()
    place = (p.get("community") or "").strip()
    subloc = (p.get("sublocation") or "").strip()
    prov = (p.get("province") or "").strip()
    year = p.get("year")
    caption = (p.get("caption") or "").strip()
    kws = p.get("keywords") or []
    events = [k for k in kws if any(w in str(k).lower() for w in
              ["meeting", "days", "nipd", "aga", "riel", "gala", "regional"])]
    if people:
        meta.append(f"people: {people}")
    loc = ", ".join(x for x in [subloc, place, prov] if x)
    if loc:
        meta.append(f"place: {loc}")
    if year and str(year) not in ("0", ""):
        meta.append(f"year: {year}")
    if events:
        meta.append(f"event: {events[0]}")
    if caption:
        meta.append(f"existing caption (context only): {caption[:200]}")
    prompt = (
        "Write alt text for a Red River Metis community photo archive. "
        "Describe ONLY what is visible in this photo. 1-2 sentences, "
        "under 125 characters total. Plain factual language, no filler "
        "like 'this photo shows', no speculation, no invented emotion or "
        "family relationships."
    )
    if meta:
        prompt += " KNOWN metadata (use only if it is visible in the photo; never repeat what is not shown): " + "; ".join(meta) + "."
    prompt += " Output only the alt text."
    return prompt


def encode_image(fn):
    """Downscale to MAX_SIDE and base64-encode as JPEG (vision does not need
    2048px masters; this cuts tokens and bandwidth massively)."""
    path = os.path.join(PHOTOS_DIR, fn)
    with Image.open(path) as im:
        im = im.convert("RGB")
        if max(im.size) > MAX_SIDE:
            im.thumbnail((MAX_SIDE, MAX_SIDE))
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode("ascii")


def call_gemini(prompt, b64, api_key, model):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "contents": [{"parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
        ]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 120, "candidateCount": 1},
    }
    r = requests.post(url, params={"key": api_key}, json=payload, timeout=120)
    if r.status_code == 429:
        raise RateLimited(r.text[:200])
    if r.status_code >= 500:
        raise TransientError(f"HTTP {r.status_code}: {r.text[:200]}")
    if r.status_code != 200:
        raise FatalError(f"HTTP {r.status_code}: {r.text[:200]}")
    data = r.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError):
        raise TransientError(f"unexpected response shape: {str(data)[:200]}")
    text = text.strip("\"'` \n")
    if len(text) > MAX_ALT_CHARS:
        text = text[:MAX_ALT_CHARS - 3].rsplit(" ", 1)[0] + "..."
    return text


class RateLimited(Exception):
    pass


class TransientError(Exception):
    pass


class FatalError(Exception):
    pass


def load_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return default


def save_json(path, obj):
    with open(path, "w") as f:
        json.dump(obj, f, indent=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pilot", type=int, default=0, help="stratified sample of N photos")
    ap.add_argument("--limit", type=int, default=0, help="max photos this run (0 = all)")
    ap.add_argument("--offset", type=int, default=0, help="skip first N in sorted order")
    ap.add_argument("--model", default=MODEL)
    args = ap.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set. Free key: aistudio.google.com/apikey")
        sys.exit(2)

    manifest = load_json(MANIFEST, None)
    if not manifest:
        print(f"ERROR: cannot read {MANIFEST}")
        sys.exit(2)
    photos = sorted(manifest["photos"], key=lambda p: p["src"].split("/")[-1].lower())
    approved = load_json(ALT_OVERRIDES, {})
    checkpoint = load_json(CHECKPOINT, {})

    fnames = [p["src"].split("/")[-1] for p in photos]
    if args.pilot > 0:
        step = max(1, len(fnames) // args.pilot)
        sel = sorted({fnames[i] for i in range(0, len(fnames), step)})[:args.pilot]
        fnames = sel
    elif args.limit > 0:
        fnames = fnames[args.offset:args.offset + args.limit]

    pending = [fn for fn in fnames
               if fn not in approved
               and checkpoint.get(fn, {}).get("status") != "done"]
    print(f"photos in scope: {len(fnames)} | already approved/skipped: "
          f"{len(fnames) - len(pending)} | to generate: {len(pending)}")

    by_name = {p["src"].split("/")[-1]: p for p in photos}
    ok, err, retries = 0, 0, 0
    for i, fn in enumerate(pending, 1):
        p = by_name[fn]
        prompt = build_prompt(p)
        try:
            b64 = encode_image(fn)
        except Exception as e:
            checkpoint[fn] = {"status": "error", "error": f"encode: {e}"}
            save_json(CHECKPOINT, checkpoint)
            err += 1
            print(f"[{i}/{len(pending)}] ENCODE-ERROR {fn}: {e}")
            continue
        attempt = 0
        while True:
            try:
                alt = call_gemini(prompt, b64, api_key, args.model)
                checkpoint[fn] = {"status": "done", "alt": alt}
                save_json(CHECKPOINT, checkpoint)
                ok += 1
                print(f"[{i}/{len(pending)}] OK {fn}: {alt}")
                break
            except RateLimited as e:
                attempt += 1
                if attempt > 6:
                    checkpoint[fn] = {"status": "error", "error": "rate limited"}
                    save_json(CHECKPOINT, checkpoint)
                    err += 1
                    print(f"[{i}/{len(pending)}] RATE-LIMIT-GAVE-UP {fn}")
                    break
                wait = 20 * attempt
                print(f"[{i}/{len(pending)}] 429 {fn}, backing off {wait}s")
                time.sleep(wait)
            except TransientError as e:
                attempt += 1
                if attempt > 3:
                    checkpoint[fn] = {"status": "error", "error": str(e)}
                    save_json(CHECKPOINT, checkpoint)
                    err += 1
                    print(f"[{i}/{len(pending)}] TRANSIENT-GAVE-UP {fn}: {e}")
                    break
                time.sleep(5 * attempt)
            except FatalError as e:
                checkpoint[fn] = {"status": "error", "error": str(e)}
                save_json(CHECKPOINT, checkpoint)
                err += 1
                print(f"[{i}/{len(pending)}] FATAL {fn}: {e}")
                break

    # Rebuild the worklist with Gemini alts injected (drafting logic unchanged)
    rows = []
    for i, p in enumerate(photos, 1):
        fn = p["src"].split("/")[-1]
        dt, dc, status = draft(p)
        kw = recommend_keywords(p)
        cp = checkpoint.get(fn, {})
        alt = cp.get("alt", "") if cp.get("status") == "done" else ""
        alt_status = "GEMINI" if cp.get("status") == "done" else ("ERROR" if cp.get("status") == "error" else "PENDING")
        lo = ((i - 1) // 50) * 50 + 1
        hi = min(lo + 49, len(photos))
        changes = []
        if "TITLE" in status:
            changes.append("TITLE drafted")
        if "CAPTION" in status:
            changes.append("CAPTION drafted")
        if kw:
            changes.append("KEYWORDS case-fix")
        if alt:
            changes.append("ALT (Gemini)")
        rows.append({
            "seq": i, "chunk": f"{lo}-{hi}", "filename": fn, "status": status,
            "changes": "; ".join(changes), "title_paste": dt, "caption_paste": dc,
            "keywords_paste_ready": kw,
            "keywords_current": ", ".join(str(k) for k in (p.get("keywords") or [])),
            "alt_paste": alt, "alt_status": alt_status,
            "people": (p.get("people") or "").strip(),
            "place": f"{p.get('community') or ''} {p.get('province') or ''}".strip(),
            "year": p.get("year") or "",
        })
    with open(WORKLIST, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    print(f"\nwrote {WORKLIST} rows: {len(rows)}")
    print(f"gemini drafts this run: {ok} | errors: {err} | resume: re-run same command (checkpoint keeps progress)")
    print(f"approved store: {ALT_OVERRIDES} ({len(approved)} already approved)")


if __name__ == "__main__":
    main()
