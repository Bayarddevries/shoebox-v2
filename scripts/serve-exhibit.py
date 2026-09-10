#!/usr/bin/env python3
"""Métis Kin Exhibit - static file server with smart cache headers.

- .html / .js / .css / .json (controller, projector, manifest, presets):
  `Cache-Control: no-store` so the tablet/phone always gets the latest code
  after a reload (mobile browsers otherwise serve stale copies, which shows
  up as "my changes aren't there").
- photos/, thumbs/, audio/ (the 380 MB archive): `Cache-Control: public,
  max-age=86400`. The full-res JPEGs are large and the slideshow cycles the
  whole archive; without a cache every slide re-fetches its full file from
  the network (avg 716 KB, up to 9.4 MB). One day is long enough that a
  full show pass caches everything, short enough that a replaced photo file
  (same filename) is picked up the next day. If you swap a photo mid-event
  with the SAME filename and want it immediate, bump the version in the
  filename instead.
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8082
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public'))

# Big static assets that are safe to cache for a day. Filenames are stable
# (the manifest references them), so a cache hit is always correct.
CACHEABLE_MARKERS = ('/photos/', '/thumbs/', '/audio/')


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        path = self.path.split('?')[0]
        if any(m in path for m in CACHEABLE_MARKERS):
            self.send_header('Cache-Control', 'public, max-age=86400')
        else:
            self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, format, *args):
        pass  # keep the console quiet


if __name__ == '__main__':
    os.chdir(ROOT)
    handler = partial(NoCacheHandler, directory=ROOT)
    server = ThreadingHTTPServer(('0.0.0.0', PORT), handler)
    print(f'Exhibit static server (no-cache) on http://0.0.0.0:{PORT} serving {ROOT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
