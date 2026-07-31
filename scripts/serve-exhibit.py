#!/usr/bin/env python3
"""Métis Kin Exhibit - static file server with no-cache headers.

Same as `python3 -m http.server` but sends Cache-Control: no-store so the
tablet/phone always gets the latest controller/projector HTML after a
reload (mobile browsers otherwise serve stale copies, which shows up as
"my changes aren't there").
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8082
ROOT = os.path.expanduser('~/projects/Shoebox V2/public')


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
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
