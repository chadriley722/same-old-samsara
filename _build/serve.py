#!/usr/bin/env python3
"""Local preview server for the site. Nothing here goes live (Jekyll skips folders starting with _).

  python3 _build/serve.py                 -> http://127.0.0.1:8811/   (this Mac only)
  python3 _build/serve.py 8812 0.0.0.0    -> also reachable from a phone on the same wi-fi

Files are sent with no-cache headers so a reload always shows the newest build.

Dev only: with --shots <folder> (and only when bound to 127.0.0.1) the page may POST a PNG to
/__shot?name=<name> and it is written into that folder. The walk uses this to save its own still prints.
"""
import http.server, pathlib, re, socketserver, sys, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:]]
shots = None
if "--shots" in args:
    i = args.index("--shots")
    shots = pathlib.Path(args[i + 1]).expanduser().resolve()
    del args[i:i + 2]
port = int(args[0]) if args else 8811
bind = args[1] if len(args) > 1 else "127.0.0.1"
if bind != "127.0.0.1":
    shots = None   # never accept uploads from the network


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript", ".webp": "image/webp",
                      ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json"}

    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def send_head(self):
        # on the wi-fi, serve only what GitHub Pages would: no dot files, no folders that start with _
        if bind != "127.0.0.1" and re.search(r"(^|/)[._]", urllib.parse.urlparse(self.path).path.lstrip("/")):
            self.send_error(404); return None
        # an iPhone asks for a video a piece at a time and won't play it unless the server can answer that way (GitHub Pages can)
        self._left = None
        want = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", "").strip())
        path = pathlib.Path(self.translate_path(self.path))
        if want and (want.group(1) or want.group(2)) and path.is_file():
            size = path.stat().st_size
            if want.group(1): start, end = int(want.group(1)), int(want.group(2) or size - 1)
            else: start, end = max(size - int(want.group(2)), 0), size - 1          # "the last n bytes"
            end = min(end, size - 1)
            if start > end:
                self.send_error(416); return None
            f = path.open("rb"); f.seek(start)
            self.send_response(206)
            self.send_header("Content-Type", self.guess_type(str(path)))
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", str(end - start + 1))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            self._left = end - start + 1
            return f
        return super().send_head()

    def copyfile(self, source, out):
        left = getattr(self, "_left", None)
        if left is None: return super().copyfile(source, out)
        while left > 0:
            chunk = source.read(min(65536, left))
            if not chunk: break
            out.write(chunk); left -= len(chunk)

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        if not shots or url.path != "/__shot":
            self.send_error(404); return
        name = urllib.parse.parse_qs(url.query).get("name", ["shot"])[0]
        name = re.sub(r"[^a-z0-9._-]", "-", name.lower())[:80] or "shot"
        size = int(self.headers.get("Content-Length", "0"))
        if size <= 0 or size > 40_000_000:
            self.send_error(413); return
        shots.mkdir(parents=True, exist_ok=True)
        (shots / (name + ".png")).write_bytes(self.rfile.read(size))
        self.send_response(204); self.end_headers()

    def log_message(self, fmt, *a):
        if "--quiet" not in sys.argv:
            super().log_message(fmt, *a)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with Server((bind, port), Handler) as httpd:
        print(f"serving {ROOT} at http://{bind}:{port}/" + (f"  (shots -> {shots})" if shots else ""), flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
