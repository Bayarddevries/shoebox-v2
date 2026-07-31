#!/usr/bin/env python3
"""Métis Kin Exhibit — State Relay Server

A lightweight HTTP server that sits between the pedestal tablet (controller)
and the big screen (display). Holds the current exhibit state in memory:
which photos are showing, current index, speed, transition, etc.

Endpoints:
  GET  /health      → { ok: true, uptime }
  GET  /state       → Full current state
  POST /state       → Partial state update (returns full state)
  GET  /manifest    → The photo manifest (proxied)
  GET  /search?q=X  → Search people field in manifest
  GET  /presets     → Curated theme presets from exhibit-themes.json

Dependencies: stdlib only.
Run: python3 exhibit-server.py
"""

import json
import os
import time
import threading
from http.server import HTTPServer, ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = 8081
MANIFEST_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'shoebox', 'manifest.json')
THEMES_PATH = os.path.join(os.path.dirname(__file__), 'exhibit-themes.json')

# ─── Load data ────────────────────────────────────────────────────────────

def load_manifest():
    with open(MANIFEST_PATH) as f:
        data = json.load(f)
    return data.get('photos', data)

def load_themes():
    if os.path.exists(THEMES_PATH):
        with open(THEMES_PATH) as f:
            return json.load(f)
    return {"themes": []}

MANIFEST = load_manifest()
THEMES = load_themes()
START_TIME = time.time()

# Build a lookup dict for quick photo access by index
PHOTO_LOOKUP = {p.get('id', f'photo_{i}'): p for i, p in enumerate(MANIFEST)}

# ─── Filter logic (matches projector.html semantics) ─────────────────────

def filter_photos(filters):
    """Apply filters to the full manifest. Returns filtered list."""
    if not filters:
        return MANIFEST[:]
    cats = {k: v for k, v in filters.items() if v}
    if not cats:
        return MANIFEST[:]

    result = []
    for p in MANIFEST:
        ok = True
        for key, vals in cats.items():
            if not vals:
                continue
            match = False
            if key == 'community':
                match = p.get('community') in vals
            elif key == 'people':
                p_people = [x.strip() for x in p.get('people', '').split(';') if x.strip()]
                match = any(v in p_people for v in vals)
            elif key == 'decade':
                year = p.get('year')
                if year:
                    y = (int(float(year)) // 10) * 10
                    match = any(int(float(v)) == y for v in vals)
            elif key == 'id':
                match = p.get('id') in vals
            elif key == 'keyword':
                p_kw = [k.lower() for k in p.get('keywords', [])]
                match = any(v.lower() in p_kw for v in vals)
            if not match:
                ok = False
                break
        if ok:
            result.append(p)
    return result

def search_all(query):
    """Search people, title, description, location/community, and keywords. Returns matching photos."""
    q = query.lower().strip()
    if not q:
        return []
    scored = []
    for p in MANIFEST:
        people = p.get('people', '')
        people_l = people.lower()
        title = (p.get('title') or '').lower()
        desc = ((p.get('caption') or '') + ' ' + (p.get('description') or '')).lower()
        loc = ' '.join(str(x) for x in [p.get('location'), p.get('community'), p.get('province')] if x).lower()
        kws = ' '.join(p.get('keywords', [])).lower()
        if any(n.strip().lower() == q for n in people.split(';')):
            score = 0          # exact person name
        elif q in people_l:
            score = 1          # partial person name
        elif q in title or q in desc or q in loc or q in kws:
            score = 2          # other fields (keyword, community, caption)
        else:
            continue
        scored.append((score, p.get('year') or 9999, p))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [p for _, _, p in scored]

# ─── State ─────────────────────────────────────────────────────────────────

state = {
    "filters": {},
    "photoIds": [p.get('id', f'photo_{i}') for i, p in enumerate(MANIFEST)],
    "currentIndex": 0,
    "currentPhoto": None,
    "speed": 5000,
    "transition": "kenburns",
    "captionMode": 0,
    "shuffle": True,
    "faceTrack": False,
    "playing": True,
    "serverTime": time.time(),
}
state_lock = threading.Lock()

def rebuild_state(filters=None):
    """Recompute photoIds and currentPhoto based on filters."""
    global state
    f = filters if filters is not None else state.get("filters", {})
    filtered = filter_photos(f)
    photo_ids = [p.get('id', f'photo_{i}') for i, p in enumerate(filtered)]
    current_id = photo_ids[0] if photo_ids else None
    state.update({
        "filters": f,
        "photoIds": photo_ids,
        "currentIndex": 0,  # filter change always starts from the first photo
        "currentPhoto": PHOTO_LOOKUP.get(current_id) if current_id else None,
        "serverTime": time.time(),
    })

# Initialize
rebuild_state({})

# ─── HTTP Handler ─────────────────────────────────────────────────────────

class ExhibitHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'  # keep-alive: halves TCP churn for 2s polling

    def _send_json(self, data, status=200):
        body = json.dumps(data, default=str).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        params = parse_qs(parsed.query)

        if path == '/health':
            self._send_json({"ok": True, "uptime": round(time.time() - START_TIME)})

        elif path == '/state':
            with state_lock:
                s = dict(state)
            s['serverTime'] = time.time()
            self._send_json(s)

        elif path == '/manifest':
            self._send_json({"photoCount": len(MANIFEST), "photos": MANIFEST})

        elif path == '/search':
            q = params.get('q', [''])[0]
            results = search_all(q)
            self._send_json({"query": q, "count": len(results), "results": results})

        elif path == '/presets':
            self._send_json(THEMES)

        else:
            self._send_json({"error": "not found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path == '/state':
            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len) if content_len else b'{}'
            try:
                updates = json.loads(body)
            except json.JSONDecodeError:
                self._send_json({"error": "invalid JSON"}, 400)
                return

            with state_lock:
                # Apply updates
                for key in ['speed', 'transition', 'captionMode', 'shuffle',
                            'faceTrack', 'playing']:
                    if key in updates:
                        state[key] = updates[key]

                # Explicit photoIds override (e.g. related-photo sets from the controller)
                if 'photoIds' in updates:
                    valid = [i for i in updates['photoIds'] if i in PHOTO_LOOKUP]
                    state['photoIds'] = valid or state['photoIds']
                    state['currentIndex'] = 0

                # If filters changed, rebuild and start from photo 0
                if 'filters' in updates:
                    rebuild_state(updates['filters'])
                else:
                    # Clamp and apply index change, resolve currentPhoto
                    if 'currentIndex' in updates:
                        ids = state['photoIds']
                        idx = int(updates['currentIndex'])
                        if ids:
                            idx = max(0, min(idx, len(ids) - 1))
                        else:
                            idx = 0
                        state['currentIndex'] = idx
                        cid = ids[idx] if ids else None
                        state['currentPhoto'] = PHOTO_LOOKUP.get(cid)
                    state['serverTime'] = time.time()

                s = dict(state)

            self._send_json(s)

        else:
            self._send_json({"error": "not found"}, 404)

    def log_message(self, format, *args):
        # Quieter logging for the exhibit
        if '/health' not in args[0]:
            print(f"[{time.strftime('%H:%M:%S')}] {args[0]}")

# ─── Main ──────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    server = ThreadingHTTPServer(('0.0.0.0', PORT), ExhibitHandler)
    # Threading so a slow phone request never blocks the display's polling
    print(f"Exhibit server running on http://0.0.0.0:{PORT}")
    print(f"  {len(MANIFEST)} photos loaded")
    print(f"  {len(THEMES.get('themes', []))} themes loaded")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()
