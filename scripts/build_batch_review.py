#!/usr/bin/env python3
"""Build a Shoebox batch review package: JSON + thumbnails + viewer.

Usage:
  python3 scripts/build_batch_review.py --batch 2026-09-11 \
      --export-dir /tmp/shoebox-batch1 \
      --mapping scripts/batch-2026-09-11-mapping.csv \
      --out ~/shoebox-reviews/batch-2026-09-11

Mapping CSV columns: export_file,archive_file,confidence,flags
Generates: review.json, thumbs/*.jpg (export + archive at 320px), index.html (viewer copy)
"""
import argparse, csv, json, os, shutil, subprocess, sys
from PIL import Image

REPO = '/home/bayarddevries/shoebox-v2'
MANIFEST = os.path.join(REPO, 'public/assets/shoebox/manifest.json')
ARCHIVE_DIR = os.path.join(REPO, 'public/assets/shoebox/photos')
EXIFTOOL = '/home/bayarddevries/bin/exiftool-bin'
VIEWER_SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'batch_review_viewer.html')

def exif(path, tags):
    r = subprocess.run([EXIFTOOL, '-j'] + tags + [path], capture_output=True, text=True)
    try: return json.loads(r.stdout)[0]
    except Exception: return {}

def thumb(src, dst, size=320):
    img = Image.open(src)
    img.thumbnail((size, size), Image.LANCZOS)
    img.convert('RGB').save(dst, 'JPEG', quality=72)
    return os.path.basename(dst)

def norm_place(p):
    return ', '.join(x for x in [(p.get('community') or ''), (p.get('province') or '')] if x)

def draft(p, lr):
    """Familial-voice draft from existing + LR metadata; flag anomalies, never guess."""
    title = (lr.get('title') or p.get('title') or '').strip()
    caption = (lr.get('caption') or p.get('caption') or '').strip()
    people = (p.get('people') or '').strip()
    place = (p.get('community') or '').strip()
    subloc = (p.get('sublocation') or '').strip()
    prov = (p.get('province') or '').strip()
    year = p.get('year')
    kws = p.get('keywords') or []
    events = [k for k in kws if any(w in k.lower() for w in ['meeting','days','nipd','aga','riel','gala','regional'])]
    flags = []
    # wrong-year heuristic (Ste. Mads 2026 photos showing old years)
    if year and place and 'madeleine' in place.lower() and year < 2020:
        flags.append('CHECK YEAR')
    # descriptor leak in people
    if people and any(w in people.lower() for w in ['dancing','music','uniform','family gathering',':']):
        flags.append('DESCRIPTOR LEAK')
    # filename-ish title
    low = title.lower()
    if (not title) or low.startswith(('img_','mg_','untitled','photo_','dsc','scan','ffa','_mg_')) or low.endswith('.jpg') or json and False:
        flags.append('FILENAME TITLE')
    # build draft title
    dt = title if 'FILENAME TITLE' not in flags else ''
    if not dt:
        if people and ';' in people: dt = people.split(';')[0].strip()
        elif people: dt = people
        elif place: dt = f'{place} photo'
        else: dt = ''
    # build draft caption
    dc = caption
    if not dc or len(dc) < 20:
        bits = []
        if people: bits.append(people)
        if subloc and subloc.lower() not in ('cemetary',''): bits.append(subloc)
        if place: bits.append(place)
        if prov and prov.lower() not in ('manitoba','saskatchewan'): bits.append(prov)
        if year: bits.append(str(year))
        if events: bits.append(events[0])
        dc = f'A photo of {", ".join(bits)}. [Add the story here.]' if bits else '[Add the story here.]'
        flags.append('EMPTY CAPTION')
    return {'title': dt, 'caption': dc, 'keywords': ', '.join(kws)}, flags

def size_mb(v):
    if not v: return 0.0
    s = str(v).strip().lower()
    try:
        if s.endswith('kb'): return round(float(s[:-2].strip())/1024, 1)
        if s.endswith('mb'): return round(float(s[:-2].strip()), 1)
        return round(float(s)/1048576, 1)
    except Exception: return 0.0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--batch', required=True)
    ap.add_argument('--export-dir', required=True)
    ap.add_argument('--mapping', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    manifest = json.load(open(MANIFEST))
    manifest_by_fn = {p['src'].split('/')[-1]: p for p in manifest['photos']}

    rows = list(csv.DictReader(open(args.mapping)))
    out_dir = os.path.expanduser(args.out)
    thumbs_dir = os.path.join(out_dir, 'thumbs')
    os.makedirs(thumbs_dir, exist_ok=True)

    photos = []
    for r in rows:
        exp_file = r['export_file'].strip()
        arch_file = r['archive_file'].strip()
        conf = r.get('confidence','MED').strip()
        flags = [f.strip() for f in (r.get('flags') or '').split(';') if f.strip()]
        exp_path = os.path.join(args.export_dir, exp_file)
        arch_path = os.path.join(ARCHIVE_DIR, arch_file)
        if not os.path.exists(exp_path):
            print(f'!! missing export {exp_file}', file=sys.stderr); continue
        if arch_file not in manifest_by_fn:
            print(f'!! archive {arch_file} not in manifest', file=sys.stderr); continue
        p = manifest_by_fn[arch_file]
        d = exif(exp_path, ['-IPTC:ObjectName','-XMP-dc:Title','-IPTC:Caption-Abstract','-XMP-dc:Description',
                            '-IPTC:Keywords','-IPTC:City','-IPTC:Sub-location','-IPTC:Province-State',
                            '-ImageWidth','-ImageHeight','-FileType','-FileSize'])
        lr = {
            'title': (d.get('ObjectName') or d.get('Title') or '').strip(),
            'caption': (d.get('Caption-Abstract') or d.get('Description') or '').strip(),
            'keywords': ', '.join(str(k) for k in (d.get('Keywords') or [])) if isinstance(d.get('Keywords'), list) else str(d.get('Keywords') or ''),
            'place': ', '.join(x for x in [(d.get('City') or ''), (d.get('Province-State') or '')] if x),
            'width': d.get('ImageWidth'), 'height': d.get('ImageHeight'),
            'type': d.get('FileType'), 'size_mb': size_mb(d.get('FileSize')),
        }
        suggested, draft_flags = draft(p, lr)
        all_flags = flags + draft_flags
        # thumbnails
        exp_thumb = thumb(exp_path, os.path.join(thumbs_dir, 'exp__' + exp_file.replace(' ', '_').replace('/', '_') + '.jpg'))
        arch_thumb = thumb(arch_path, os.path.join(thumbs_dir, 'arch__' + arch_file.replace(' ', '_').replace('/', '_') + '.jpg'))
        photos.append({
            'archive_file': arch_file,
            'archive_id': p['id'],
            'export_file': exp_file,
            'confidence': conf,
            'flags': list(dict.fromkeys(all_flags)),
            'archive': {
                'title': (p.get('title') or '').strip(),
                'caption': (p.get('caption') or '').strip(),
                'keywords': ', '.join(p.get('keywords') or []),
                'place': norm_place(p),
                'year': p.get('year') or '',
                'thumb': arch_thumb,
            },
            'lr': lr,
            'suggested': suggested,
            'decision': '',
            'notes': '',
        })

    review = {'batch': args.batch, 'generated': __import__('datetime').date.today().isoformat(),
              'photos': photos, 'count': len(photos)}
    with open(os.path.join(out_dir, 'review.json'), 'w', encoding='utf-8') as f:
        json.dump(review, f, ensure_ascii=False, indent=1)
    if os.path.exists(VIEWER_SRC):
        shutil.copy(VIEWER_SRC, os.path.join(out_dir, 'index.html'))
    print(f'wrote {len(photos)} photos -> {out_dir}')
    n_flag = sum(1 for p in photos if p['flags'])
    print(f'flagged: {n_flag}')

if __name__ == '__main__':
    main()
